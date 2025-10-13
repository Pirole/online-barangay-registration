// src/controllers/registrations.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from '../utils/otp';
import { logger } from '../utils/logger';
import { sendSMS } from '../utils/sms';

export const createRegistrationInternal = async (opts: {
  eventId: string;
  profileId?: string | null;
  customValues?: any;
  photoPath?: string | null;
}) => {
  const { eventId, profileId = null, customValues = null, photoPath = null } = opts;

  // Validate required inputs (caller should check too)
  if (!eventId) throw new AppError('eventId required', 400);

  // Create the registration
  const registration = await prisma.registration.create({
    data: {
      eventId,
      profileId,
      photoPath,
      customValues,
      // status defaults to PENDING in Prisma schema
    },
  });

  // Generate OTP
  const otp = generateOTP();
  const codeHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Persist OTP record
  const otpRecord = await prisma.otpRequest.create({
    data: {
      registrationId: registration.id,
      codeHash,
      expiresAt,
      // attempts default 0, isUsed default false
    },
  });

  logger.info(`✅ OTP inserted for registration ${registration.id}`);
  // Console output helps when provider is not configured (mock flow)
  // eslint-disable-next-line no-console
  console.log(`✅ OTP for registration ${registration.id}: ${otp}`);

  // Attempt to send SMS if profile contact exists
  try {
    let contact: string | undefined | null = null;
    if (profileId) {
      const profile = await prisma.profile.findUnique({ where: { id: profileId } });
      contact = profile?.contact ?? null;
    } else {
      // Try to find contact inside customValues (if frontend sends phone)
      if (customValues && typeof customValues === 'object') {
        contact = (customValues.phone || customValues.contact || null) as string | null;
      }
    }

    if (contact) {
      const sent = await sendSMS(contact, `Your registration OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`);
      if (sent) {
        logger.info(`📩 OTP sent via SMS to ${contact}`);
      } else {
        logger.warn(`⚠️ SMS provider failed to send OTP to ${contact}. OTP: ${otp}`);
      }
    } else {
      logger.info(`ℹ️ No contact available for registration ${registration.id}. OTP: ${otp}`);
    }
  } catch (smsErr) {
    // Non-fatal: log and continue
    logger.warn(`⚠️ SMS step error for registration ${registration.id}: ${smsErr}`);
  }

  return { registration, otpRecord, otp /* plain for mock/logging */ };
};

/**
 * Controller: POST /registrations
 * Create a registration (step-based friendly). Uses createRegistrationInternal.
 */
// src/controllers/registrations.ts
export const createRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = (req as any).validatedData ?? req.body;
    const { eventId, profileId } = payload;

    // ✅ Parse stringified customValues if needed
    let customValues = payload.customValues;
    if (typeof customValues === "string") {
      try {
        customValues = JSON.parse(customValues);
      } catch {
        customValues = {};
      }
    }

    const photoPath = (req as any).file ? (req as any).file.path : null;

    const { registration } = await createRegistrationInternal({
      eventId,
      profileId,
      customValues,
      photoPath,
    });

    res.status(201).json({
      success: true,
      data: { registrationId: registration.id },
      message: "Registration created - OTP generated (sent via SMS if available)",
    });
  } catch (error) {
    next(error);
  }
};
/**
 * Controller: finalize / submit registration (step-based)
 * POST /registrations/submit
 */
export const submitRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationId } = req.body;
    if (!registrationId) throw new AppError('registrationId required', 400);

    const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!registration) throw new AppError('Registration not found', 404);

    res.json({ success: true, data: registration });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /events/:eventId/registrants
 */
export const listRegistrantsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const page = Number((req.query.page as string) || '1');
    const limit = Number((req.query.limit as string) || '50');
    const status = (req.query.status as string) || 'all';
    const offset = (page - 1) * limit;

    const whereClause: any = { eventId };
    if (status && status.toLowerCase() !== 'all') {
      whereClause.status = status.toUpperCase();
    }

    const [rows, total] = await Promise.all([
      prisma.registration.findMany({
        where: whereClause,
        include: {
          profile: {
            select: { firstName: true, lastName: true, barangay: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.registration.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /registrations/:id
 */
export const getRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        profile: { select: { firstName: true, lastName: true } },
        qrCodes: true,
      },
    });
    if (!registration) throw new AppError('Not found', 404);
    res.json({ success: true, data: registration });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /registrations/:id/approve
 * Approve or reject registration (admin action)
 */
export const approveOrRejectRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes((status || '').toLowerCase())) throw new AppError('Invalid status', 400);

    const newStatus = status.toUpperCase();
    await prisma.registration.update({
      where: { id },
      data: { status: newStatus },
    });

    res.json({ success: true, message: `Registration ${newStatus}` });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /registrations/:id/checkin
 * Mark check-in (attendance)
 */
export const markCheckin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    // For now we just update updatedAt; you may want to add an attendance_logs table later
    const updated = await prisma.registration.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    res.json({ success: true, message: 'Checked in', data: updated });
  } catch (error) {
    next(error);
  }
};

