// src/controllers/registrations.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from "../utils/otp";
import { logger } from "../utils/logger";
import { sendSMS } from "../utils/sms";

/**
 * ======================================================
 * Helper: Internal registration creator (with OTP)
 * ======================================================
 */
export const createRegistrationInternal = async (opts: {
  eventId: string;
  profileId?: string | null;
  customValues?: any;
  photoPath?: string | null;
}) => {
  const { eventId, profileId = null, customValues = null, photoPath = null } = opts;
  if (!eventId) throw new AppError("eventId required", 400);

  // Create registration record
  const registration = await prisma.registration.create({
    data: {
      eventId,
      profileId,
      photoPath,
      customValues,
      // Defaults to PENDING in Prisma schema
    },
  });

  // Generate OTP
  const otp = generateOTP();
  const codeHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpRequest.create({
    data: {
      registrationId: registration.id,
      codeHash,
      expiresAt,
    },
  });

  logger.info(`✅ OTP inserted for registration ${registration.id}`);
  console.log(`✅ OTP for registration ${registration.id}: ${otp}`);

  // Try sending SMS if available
  try {
    let contact: string | null = null;
    if (profileId) {
      const profile = await prisma.profile.findUnique({ where: { id: profileId } });
      contact = profile?.contact ?? null;
    } else if (customValues && typeof customValues === "object") {
      contact = (customValues.phone || customValues.contact || null) as string | null;
    }

    if (contact) {
      const sent = await sendSMS(
        contact,
        `Your registration OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
      );
      if (sent) logger.info(`📩 OTP sent via SMS to ${contact}`);
      else logger.warn(`⚠️ SMS provider failed to send OTP to ${contact}. OTP: ${otp}`);
    } else {
      logger.info(`ℹ️ No contact available for registration ${registration.id}. OTP: ${otp}`);
    }
  } catch (smsErr) {
    logger.warn(`⚠️ SMS step error for registration ${registration.id}: ${smsErr}`);
  }

  return { registration, otp };
};

/**
 * ======================================================
 * POST /registrations — Create registration
 * ======================================================
 */
export const createRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = (req as any).validatedData ?? req.body;
    const { eventId, profileId } = payload;

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
      message: "Registration created and OTP generated.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ======================================================
 * GET /registrations — Admin view all
 * Supports ?status=pending&page=1&limit=50
 * ======================================================
 */
export const listRegistrations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status = "all", limit = 50, page = 1 } = req.query as any;
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {};
    if (status && status.toLowerCase() !== "all") {
      where.status = status.toString().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          event: { select: { title: true, location: true, startDate: true } },
          profile: { select: { firstName: true, lastName: true, barangay: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.registration.count({ where }),
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ======================================================
 * GET /events/:eventId/registrants — Event-specific view
 * ======================================================
 */
export const listRegistrantsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const { status = "all", limit = 50, page = 1 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { eventId };
    if (status && status.toLowerCase() !== "all") {
      where.status = status.toUpperCase();
    }

    const [rows, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          profile: { select: { firstName: true, lastName: true, barangay: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.registration.count({ where }),
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /registrations/:id — View single registration
 */
export const getRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        event: true,
        profile: { select: { firstName: true, lastName: true, barangay: true } },
      },
    });
    if (!registration) throw new AppError("Registration not found", 404);
    res.json({ success: true, data: registration });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /registrations/:id/approval — Approve/Reject
 */
export const approveOrRejectRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    if (!["approved", "rejected"].includes((status || "").toLowerCase())) {
      throw new AppError("Invalid status", 400);
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { status: status.toUpperCase() },
    });

    res.json({ success: true, message: `Registration ${status}`, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /registrations/:id/checkin — Mark attendance
 */
export const markCheckin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const updated = await prisma.registration.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    res.json({ success: true, message: "Checked in", data: updated });
  } catch (error) {
    next(error);
  }
};
