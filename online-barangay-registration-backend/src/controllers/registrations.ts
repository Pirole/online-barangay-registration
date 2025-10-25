// src/controllers/registrations.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from "../utils/otp";
import { logger } from "../utils/logger";
import path from "path";
import { sendSMS } from "../utils/sms";

/* ======================================================
 * Helper: Internal registration creator (with OTP)
 * ====================================================== */
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

/* ======================================================
 * POST /registrations — Create individual registration
 * ====================================================== */
export const createRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = (req as any).validatedData ?? req.body;
    const { eventId, profileId, customFieldResponses } = payload;

    if (!eventId) throw new AppError("Missing eventId", 400);

    // ✅ Check event & registration mode
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { customFields: true },
    });
    if (!event) throw new AppError("Event not found", 404);
    if (event.registrationMode === "team") {
      throw new AppError("This event requires team registration. Please register via your team.", 400);
    }

    // ✅ Validate custom field responses (if provided)
    const validResponses: any[] = [];
    if (Array.isArray(customFieldResponses) && event.customFields.length > 0) {
      for (const field of event.customFields) {
        const match = customFieldResponses.find((r) => r.fieldId === field.id);

        if (field.required && (!match || match.value === "" || match.value == null)) {
          throw new AppError(`Missing required field: ${field.name}`, 400);
        }

        if (match) {
          // Basic type validation
          if (field.type === "number" && isNaN(Number(match.value))) {
            throw new AppError(`Field ${field.name} must be a number.`, 400);
          }
          validResponses.push({ fieldId: field.id, value: String(match.value) });
        }
      }
    }

    // ✅ Handle file uploads
    const photoPath = (req as any).file
      ? `/uploads/photos/${path.basename((req as any).file.path)}`
      : null;

    // ✅ Parse customValues if sent as string
    let customValues = payload.customValues;
    if (typeof customValues === "string") {
      try {
        customValues = JSON.parse(customValues);
      } catch {
        customValues = {};
      }
    }

    // ✅ Run transaction: registration + field responses + OTP + audit
    const result = await prisma.$transaction(async (tx) => {
      // Create registration
      const registration = await tx.registration.create({
        data: {
          eventId,
          profileId,
          photoPath,
          customValues,
          status: "PENDING",
        },
      });

      // Create field responses (if any)
      if (validResponses.length > 0) {
        await tx.registrationFieldResponse.createMany({
          data: validResponses.map((r) => ({
            registrationId: registration.id,
            fieldId: r.fieldId,
            value: r.value,
          })),
        });
      }

      // Create OTP
      const otp = generateOTP();
      const codeHash = hashOTP(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      await tx.otpRequest.create({
        data: {
          registrationId: registration.id,
          codeHash,
          expiresAt,
        },
      });

      // Audit log
      const actor = (req as any).user;
      if (actor) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "CREATE",
            targetType: "REGISTRATION",
            targetId: registration.id,
            metadata: { eventId, profileId, fieldCount: validResponses.length },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent") || "",
          },
        });
      }

      return { registration, otp };
    });

    // ✅ Try sending OTP SMS after commit
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
          `Your registration OTP is ${result.otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
        );
        if (sent) logger.info(`📩 OTP sent via SMS to ${contact}`);
        else logger.warn(`⚠️ SMS provider failed to send OTP to ${contact}. OTP: ${result.otp}`);
      }
    } catch (smsErr) {
      logger.warn(`⚠️ SMS step error for registration ${result.registration.id}: ${smsErr}`);
    }

    res.status(201).json({
      success: true,
      data: { registrationId: result.registration.id },
      message: "Registration created and OTP generated.",
    });
  } catch (error) {
    next(error);
  }
};

/* ======================================================
 * GET /registrations — Admin view all
 * ====================================================== */
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
