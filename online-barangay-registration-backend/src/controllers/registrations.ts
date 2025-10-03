  import { Request, Response, NextFunction } from 'express';
  import { query } from '../config/database';
  import { AppError } from '../middleware/errorHandler';
  import { logger } from '../utils/logger';
  import crypto from 'crypto';
  import { generateOTP, hashOTP } from '../utils/otp'; // you have otp utils

  // Helper to make uuid-like token for temp photo or other
  const randomId = () => crypto.randomUUID();

  export const createRegistration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      const { eventId, profileId, customValues } = body;

      // If file uploaded, save path
      let photoPath = null;
      if ((req as any).file) {
        photoPath = (req as any).file.path;
      }

      // insert registration
      const inserted = await query(
        `INSERT INTO registrations (event_id, profile_id, status, photo_path, custom_values, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id`,
        [eventId, profileId || null, 'PENDING', photoPath, customValues ? JSON.stringify(customValues) : null]
      );

      const registrationId = inserted.rows[0].id;

      // Generate OTP (6-digit) and store hashed
      const otp = generateOTP();
      const hashed = hashOTP(otp);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      await query(
        `INSERT INTO otp_requests (registration_id, code_hash, expires_at, attempts, is_used, created_at)
        VALUES ($1,$2,$3,0,false,NOW())`,
        [registrationId, hashed, expiresAt]
      );

      // Attempt to send SMS if phone available in profile
      const profileRes = await query(`SELECT p.contact, p.first_name FROM profiles p WHERE p.id = $1`, [profileId]);
      const contact = profileRes.rows[0]?.contact;
      if (contact) {
        // try to call sms util
        try {
          // dynamic import to avoid failing when sms util missing
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const sms = require('../utils/sms');
          if (sms && typeof sms.sendSMS === 'function') {
            await sms.sendSMS(contact, `Your registration OTP is ${otp}. It expires in 5 minutes.`);
          } else {
            logger.info(`OTP for ${contact}: ${otp} (sms util not available)`);
          }
        } catch (err) {
          logger.info(`OTP for ${contact}: ${otp} (sms send failed)`);
        }
      } else {
        logger.info(`OTP for registration ${registrationId} -> ${otp} (no phone on profile)`);
      }

      res.status(201).json({ success: true, data: { registrationId }, message: 'Registration created - OTP sent if phone available' });
    } catch (error) {
      next(error);
    }
  };

  export const submitRegistration = async (req: Request, res: Response, next: NextFunction) => {
    // If you have a multi-step flow — accept a temp photo ID, merge and finalize registration
    try {
      const { registrationId } = req.body;
      if (!registrationId) throw new AppError('registrationId required', 400);
      // For now just return registration
      const r = await query('SELECT * FROM registrations WHERE id = $1', [registrationId]);
      if (r.rows.length === 0) throw new AppError('Registration not found', 404);
      res.json({ success: true, data: r.rows[0] });
    } catch (error) {
      next(error);
    }
  };

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
        ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, Number(limit), offset]
      );

      const totalRes = await query(`SELECT COUNT(*) as count FROM registrations WHERE event_id = $1 ${statusClause ? 'AND status = $2' : ''}`, statusClause ? [eventId, status.toUpperCase()] : [eventId]);

      res.json({
        success: true,
        data: rows.rows,
        pagination: { page: Number(page), limit: Number(limit), total: Number(totalRes.rows[0].count) },
      });
    } catch (error) {
      next(error);
    }
  };

  export const getRegistration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const r = await query(`SELECT r.*, p.first_name, p.last_name FROM registrations r LEFT JOIN profiles p ON r.profile_id = p.id WHERE r.id = $1`, [id]);
      if (r.rows.length === 0) throw new AppError('Not found', 404);
      res.json({ success: true, data: r.rows[0] });
    } catch (error) {
      next(error);
    }
  };

  export const approveOrRejectRegistration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const { status, reason } = req.body;
      if (!['approved','rejected'].includes(status)) throw new AppError('Invalid status', 400);
      await query(`UPDATE registrations SET status = $1, updated_at = NOW() WHERE id = $2`, [status.toUpperCase(), id]);
      // audit log could be inserted here
      res.json({ success: true, message: `Registration ${status}` });
    } catch (error) {
      next(error);
    }
  };

  export const markCheckin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      // implement check-in: you may want a attendance log table. For now update registration with checked_in timestamp column if exists
      await query(`UPDATE registrations SET updated_at = NOW() WHERE id = $1`, [id]);
      res.json({ success: true, message: 'Checked in' });
    } catch (error) {
      next(error);
    }
  };
