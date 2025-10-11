// src/controllers/otp.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { hashOTP, OTP_EXPIRY_MINUTES, MAX_OTP_ATTEMPTS } from '../utils/otp';

// QR settings (mock)
const QR_EXPIRES_DAYS = Number(process.env.QR_EXPIRES_DAYS || '7');
const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'qr_fallback_secret';

/**
 * POST /otp/verify
 * Body: { registrationId, code }
 *
 * On success (Behavior B):
 *  - marks otp_requests.isUsed = true
 *  - updates registration.status = APPROVED
 *  - create qr_code entry and return qr token
 */
export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationId, code } = req.body;
    if (!registrationId || !code) throw new AppError('registrationId and code required', 400);

    // Fetch latest OTP for the registration
    const otpRecord = await prisma.otpRequest.findFirst({
      where: { registrationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) throw new AppError('OTP record not found', 404);
    if (otpRecord.isUsed) throw new AppError('OTP already used', 400);
    if (new Date(otpRecord.expiresAt) < new Date()) throw new AppError('OTP expired', 400);
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) throw new AppError('Max OTP attempts exceeded', 429);

    const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
    if (hashedInput !== otpRecord.codeHash) {
      // increment attempts and throw
      await prisma.otpRequest.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppError('Invalid OTP', 400);
    }

    // Mark OTP used
    await prisma.otpRequest.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Behavior B: update registration status => APPROVED
    const registration = await prisma.registration.update({
      where: { id: registrationId },
      data: { status: 'APPROVED' },
      include: { event: true },
    });

    // Create a mock QR payload (JWT) and persist to qr_codes table
    const payload = {
      registrationId: registration.id,
      eventId: registration.eventId,
      iat: Math.floor(Date.now() / 1000),
    };
    const qrToken = jwt.sign(payload, QR_SECRET, { expiresIn: `${QR_EXPIRES_DAYS}d` });

    // Save QR record
    const expiresAt = new Date(Date.now() + QR_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const qrRecord = await prisma.qrCode.create({
      data: {
        registrationId: registration.id,
        codeValue: qrToken,
        imagePath: null, // TODO: generate PNG and store to S3 or disk
        expiresAt,
      },
    });

    logger.info(`✅ Registration ${registrationId} approved and QR created (${qrRecord.id})`);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        registrationId: registration.id,
        qr: {
          token: qrToken,
          expiresAt: expiresAt.toISOString(),
          // For mock/demo purposes we include a trivial data URL placeholder
          imagePlaceholder: `data:image/png;base64,${Buffer.from(`QR:${qrToken}`).toString('base64')}`,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /otp/resend
 * Body: { registrationId }
 */
export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationId } = req.body;
    if (!registrationId) throw new AppError('registrationId required', 400);

    // Generate new OTP
    const otp = (Math.floor(Math.random() * 900000) + 100000).toString();
    const codeHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Insert new otp request record
    await prisma.otpRequest.create({
      data: {
        registrationId,
        codeHash,
        expiresAt,
      },
    });

    // Try to find a phone number to send to
    const reg = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { profile: true },
    });

    const phone = reg?.profile?.contact || (reg?.customValues && (reg.customValues as any).phone) || null;
    if (phone) {
      try {
        const sent = await (await import('../utils/sms')).sendSMS(phone, `Your new OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`);
        if (sent) logger.info(`OTP resent to ${phone}`);
        else logger.warn(`OTP resend failed for ${phone}`);
      } catch (err) {
        logger.warn(`OTP resend sendSMS error: ${err}`);
      }
    } else {
      logger.info(`Resent OTP for registration ${registrationId}: ${otp} (no phone)`);
    }

    res.json({ success: true, message: 'OTP resent successfully (if phone available)' });
  } catch (error) {
    next(error);
  }
};
