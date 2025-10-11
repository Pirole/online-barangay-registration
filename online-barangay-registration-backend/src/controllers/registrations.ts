import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES, MAX_OTP_ATTEMPTS } from '../utils/otp';
import { logger } from '../utils/logger';

// Helper: generate random ID
const randomId = () => crypto.randomUUID();

/**
 * Create new event registration + generate OTP
 */
export const createRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, profileId, customValues } = req.body;
    let photoPath: string | null = null;

    // Handle uploaded photo if present
    if ((req as any).file) {
      photoPath = (req as any).file.path;
    }

    // Insert registration
    const inserted = await query(
      `INSERT INTO registrations (event_id, profile_id, status, photo_path, custom_values, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id`,
      [
        eventId,
        profileId || null,
        'PENDING',
        photoPath,
        customValues ? JSON.stringify(customValues) : null,
      ]
    );

    const registrationId = inserted.rows[0].id;

    // Generate OTP (6 digits)
    const otp = generateOTP();
    const hashedOtp = hashOTP(otp);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // ✅ Always insert OTP in DB first
    await query(
      `INSERT INTO otp_requests (registration_id, code_hash, expires_at, attempts, is_used, created_at)
       VALUES ($1,$2,$3,0,false,NOW())`,
      [registrationId, hashedOtp, expiresAt]
    );

    logger.info(`✅ OTP inserted for registration ${registrationId}`);
    console.log(`✅ OTP for registration ${registrationId}: ${otp}`);

    // ✅ Attempt to send SMS (optional)
    try {
      if (profileId) {
        const profileRes = await query(
          `SELECT contact, first_name FROM profiles WHERE id = $1`,
          [profileId]
        );

        const contact = profileRes.rows[0]?.contact;
        if (contact) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const sms = require('../utils/sms');
            if (sms && typeof sms.sendSMS === 'function') {
              await sms.sendSMS(
                contact,
                `Your registration OTP is ${otp}. It expires in 5 minutes.`
              );
              logger.info(`📩 OTP sent via SMS to ${contact}`);
            } else {
              logger.info(`OTP for ${contact}: ${otp} (sms util not available)`);
            }
          } catch (err) {
            logger.warn(`⚠️ SMS sending failed for ${contact}. OTP: ${otp}`);
          }
        } else {
          logger.info(`ℹ️ No contact found for profile ${profileId}. OTP: ${otp}`);
        }
      } else {
        logger.info(`ℹ️ No profile linked to registration ${registrationId}. OTP: ${otp}`);
      }
    } catch (smsErr) {
      logger.warn(`⚠️ SMS step failed for registration ${registrationId}: ${smsErr}`);
    }

    // ✅ Return success regardless of SMS outcome
    res.status(201).json({
      success: true,
      data: { registrationId },
      message: 'Registration created - OTP generated (sent via SMS if available)',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit registration (finalize multi-step flow)
 */
export const submitRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationId } = req.body;
    if (!registrationId) throw new AppError('registrationId required', 400);

    const r = await query('SELECT * FROM registrations WHERE id = $1', [registrationId]);
    if (r.rows.length === 0) throw new AppError('Registration not found', 404);

    res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * List all registrants for an event
 */
export const listRegistrantsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 50, status = 'all' } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    const params: any[] = [eventId];
    let statusClause = '';
    if (status && status !== 'all') {
      statusClause = 'AND r.status = $2';
      params.push(status.toUpperCase());
    }

    const rows = await query(
      `SELECT r.*, p.first_name, p.last_name, p.barangay
       FROM registrations r LEFT JOIN profiles p ON r.profile_id = p.id
       WHERE r.event_id = $1 ${statusClause}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );

    const totalRes = await query(
      `SELECT COUNT(*) as count FROM registrations WHERE event_id = $1 ${statusClause ? 'AND status = $2' : ''}`,
      statusClause ? [eventId, status.toUpperCase()] : [eventId]
    );

    res.json({
      success: true,
      data: rows.rows,
      pagination: { page: Number(page), limit: Number(limit), total: Number(totalRes.rows[0].count) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single registration by ID
 */
export const getRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const r = await query(
      `SELECT r.*, p.first_name, p.last_name 
       FROM registrations r 
       LEFT JOIN profiles p ON r.profile_id = p.id 
       WHERE r.id = $1`,
      [id]
    );

    if (r.rows.length === 0) throw new AppError('Not found', 404);
    res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve or reject registration
 */
export const approveOrRejectRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) throw new AppError('Invalid status', 400);

    await query(
      `UPDATE registrations SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status.toUpperCase(), id]
    );

    res.json({ success: true, message: `Registration ${status}` });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark registration as checked-in (attendance)
 */
export const markCheckin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    await query(`UPDATE registrations SET updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Checked in' });
  } catch (error) {
    next(error);
  }
};
