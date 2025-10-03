import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES, MAX_OTP_ATTEMPTS } from '../utils/otp';
import { logger } from '../utils/logger';

const nowPlus = (mins: number) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  return d;
};

// ==============================
// Send OTP
// ==============================
export const sendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationId } = req.body;
    if (!registrationId) throw new AppError('registrationId required', 400);

    const otp = generateOTP();
    const codeHash = hashOTP(otp);
    const expiresAt = nowPlus(OTP_EXPIRY_MINUTES);

    await query(
      `INSERT INTO otp_requests (registration_id, code_hash, expires_at, attempts, is_used, created_at)
       VALUES ($1,$2,$3,0,false,NOW())`,
      [registrationId, codeHash, expiresAt]
    );

    // Try to fetch contact from profile linked to registration
    const p = await query(
      `SELECT p.contact 
       FROM profiles p 
       JOIN registrations r ON r.profile_id = p.id 
       WHERE r.id = $1`,
      [registrationId]
    );

    const phone = p.rows[0]?.contact;
    if (phone) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sms = require('../utils/sms');
        if (sms && typeof sms.sendSMS === 'function') {
          await sms.sendSMS(
            phone,
            `Your registration OTP is ${otp}. Expires in ${OTP_EXPIRY_MINUTES} minutes.`
          );
        } else {
          logger.info(`OTP for ${phone}: ${otp} (sms util not available)`);
        }
      } catch (err) {
        logger.info(`OTP for ${phone}: ${otp} (send failed)`);
      }
    } else {
      logger.info(`OTP for registration ${registrationId}: ${otp} (no phone)`);
    }

    res.json({ success: true, message: 'OTP generated and sent if phone available' });
  } catch (error) {
    next(error);
  }
};

// ==============================
// Verify OTP
// ==============================
export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationId, code } = req.body;
    if (!registrationId || !code) throw new AppError('registrationId and code required', 400);

    const r = await query(
      `SELECT id, code_hash, expires_at, attempts, is_used 
       FROM otp_requests 
       WHERE registration_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [registrationId]
    );

    if (r.rows.length === 0) throw new AppError('OTP record not found', 404);

    const row = r.rows[0];
    if (row.is_used) throw new AppError('OTP already used', 400);
    if (new Date(row.expires_at) < new Date()) throw new AppError('OTP expired', 400);
    if (row.attempts >= MAX_OTP_ATTEMPTS) throw new AppError('Max OTP attempts exceeded', 429);

    const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
    if (hashedInput !== row.code_hash) {
      await query(`UPDATE otp_requests SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
      throw new AppError('Invalid OTP', 400);
    }

    // Mark as used
    await query(`UPDATE otp_requests SET is_used = true WHERE id = $1`, [row.id]);

    // Optionally update registration status
    res.json({ success: true, message: 'OTP verified' });
  } catch (error) {
    next(error);
  }
};

// ==============================
// Resend OTP
// ==============================
export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationId } = req.body;
    if (!registrationId) throw new AppError('registrationId required', 400);

    const otp = generateOTP();
    const codeHash = hashOTP(otp);
    const expiresAt = nowPlus(OTP_EXPIRY_MINUTES);

    await query(
      `INSERT INTO otp_requests (registration_id, code_hash, expires_at, attempts, is_used, created_at) 
       VALUES ($1,$2,$3,0,false,NOW())`,
      [registrationId, codeHash, expiresAt]
    );

    const p = await query(
      `SELECT p.contact 
       FROM profiles p 
       JOIN registrations r ON r.profile_id = p.id 
       WHERE r.id = $1`,
      [registrationId]
    );

    const phone = p.rows[0]?.contact;
    if (phone) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sms = require('../utils/sms');
        if (sms && typeof sms.sendSMS === 'function') {
          await sms.sendSMS(
            phone,
            `Your registration OTP (resend) is ${otp}. Expires in ${OTP_EXPIRY_MINUTES} minutes.`
          );
        } else {
          logger.info(`OTP resend for ${phone}: ${otp}`);
        }
      } catch (err) {
        logger.info(`OTP resend for ${phone}: ${otp} (sms fail)`);
      }
    }

    res.json({ success: true, message: 'OTP resent (if phone available)' });
  } catch (error) {
    next(error);
  }
};
