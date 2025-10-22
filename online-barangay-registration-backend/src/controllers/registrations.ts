// src/controllers/registrations.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from "../utils/otp";
import { logger } from "../utils/logger";
import path from "path";
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
      status: "PENDING",
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

    // Convert Windows path to relative URL path
  const photoPath = (req as any).file
  ? `/uploads/photos/${path.basename((req as any).file.path)}`
  : null; 

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
 * Includes photo, contact info, age, address, QR code
 * ======================================================
 */
export const listRegistrantsForEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;
    const user = (req as any).user;

    // ✅ Authorization: Event Managers can only access their own events
    if (user?.role === "EVENT_MANAGER") {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { managerId: true },
      });

      if (!event || event.managerId !== user.id) {
        throw new AppError(
          "Forbidden: You can only view registrants for your assigned events.",
          403
        );
      }
    }

    // ✅ Pagination and filtering
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const status = (req.query.status as string)?.toUpperCase() || "ALL";
    const offset = (page - 1) * limit;

    const whereClause: any = { eventId };
    if (status !== "ALL") whereClause.status = status;

    // ✅ Fetch registrations
    const [rows, total] = await Promise.all([
      prisma.registration.findMany({
        where: whereClause,
        include: {
          profile: {
            select: {
              firstName: true,
              lastName: true,
              barangay: true,
              contact: true,
              age: true,
              address: true,
            },
          },
          event: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.registration.count({ where: whereClause }),
    ]);

    // ✅ Format and merge custom values
    const result = rows.map((r) => {
      let customVals: Record<string, any> = {};

      if (typeof r.customValues === "string") {
        try {
          customVals = JSON.parse(r.customValues);
        } catch {
          customVals = {};
        }
      } else if (
        r.customValues &&
        typeof r.customValues === "object" &&
        !Array.isArray(r.customValues)
      ) {
        customVals = r.customValues as Record<string, any>;
      }

      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        eventId: r.eventId,
        eventTitle: r.event?.title || null,
        profile: r.profile
          ? {
              firstName: r.profile.firstName,
              lastName: r.profile.lastName,
              contact: r.profile.contact || customVals.contact || null,
              age: r.profile.age || customVals.age || null,
              address: r.profile.address || customVals.address || null,
              barangay: r.profile.barangay || customVals.barangay || null,
            }
          : {
              firstName: customVals.firstName || null,
              lastName: customVals.lastName || null,
              contact: customVals.contact || null,
              age: customVals.age || null,
              address: customVals.address || null,
              barangay: customVals.barangay || null,
            },
        photoPath: r.photoPath || customVals.photo || null,
        qrCodeUrl: customVals.qrCodeUrl || customVals.qr || null,
        customValues: customVals,
      };
    });

    // ✅ Response
    res.json({
      success: true,
      data: result,
      pagination: { page, limit, total },
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
export const approveOrRejectRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // ✅ Validate status input
    const normalizedStatus = (status || "").toLowerCase();
    if (!["approved", "rejected"].includes(normalizedStatus)) {
      throw new AppError("Invalid status. Must be 'approved' or 'rejected'.", 400);
    }

    // ✅ Fetch registration first (so we know eventId for middleware checks)
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: { id: true, eventId: true, status: true },
    });

    if (!registration) {
      throw new AppError("Registration not found.", 404);
    }

    // ✅ Attach eventId to request for downstream middlewares (if needed)
    (req as any).eventId = registration.eventId;

    // ✅ Update the registration status
    const updated = await prisma.registration.update({
      where: { id },
      data: { status: normalizedStatus.toUpperCase() },
    });

    res.json({
      success: true,
      message: `Registration ${normalizedStatus}`,
      data: updated,
    });
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
