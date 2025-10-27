// src/controllers/registrations.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from "../utils/otp";
import { logger } from "../utils/logger";
import path from "path";
import { sendSMS } from "../utils/sms";

/* -------------------------------------------------------------------------- */
/* 🧠 Helper: Internal Registration Creator with OTP                          */
/* -------------------------------------------------------------------------- */
export const createRegistrationInternal = async (opts: {
  eventId: string;
  profileId?: string | null;
  customValues?: any;
  photoPath?: string | null;
}) => {
  const { eventId, profileId = null, customValues = {}, photoPath = null } = opts;
  if (!eventId) throw new AppError("eventId is required", 400);

  // ✅ Create registration record
  const registration = await prisma.registration.create({
    data: {
      eventId,
      profileId,
      customValues,
      photoPath,
      status: "PENDING",
    },
  });

  // ✅ Generate OTP and store hashed
  const otp = generateOTP();
  const otpHash = hashOTP(otp);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.registration.update({
    where: { id: registration.id },
    data: { otpCodeHash: otpHash, otpExpiresAt },
  });

  logger.info(`✅ OTP created for registration ${registration.id}`);
  console.log(`🔐 OTP for registration ${registration.id}: ${otp}`);

  // ✅ Send OTP via SMS (if contact available)
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
      if (sent) logger.info(`📩 OTP sent to ${contact}`);
      else logger.warn(`⚠️ Failed to send OTP SMS to ${contact}. OTP: ${otp}`);
    } else {
      logger.info(`ℹ️ No contact available for registration ${registration.id}. OTP: ${otp}`);
    }
  } catch (err) {
    logger.warn(`⚠️ SMS sending failed for registration ${registration.id}: ${err}`);
  }

  return { registration, otp };
};

/* -------------------------------------------------------------------------- */
/* 📝 POST /registrations — Create Individual or Captain Registration         */
/* -------------------------------------------------------------------------- */
export const createRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    const { eventId, profileId, customValues, customFieldResponses } = payload;

    if (!eventId) throw new AppError("Missing eventId", 400);

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { customFields: true },
    });
    if (!event) throw new AppError("Event not found", 404);

    // ✅ TEAM or BOTH (captain registration first)
    if (event.registrationMode === "team" || event.registrationMode === "both") {
      const { captainName, captainContact } = customValues || {};
      if (!captainName || !captainContact) {
        throw new AppError("Captain name and contact are required for team events.", 400);
      }

      const registration = await prisma.registration.create({
        data: {
          eventId,
          customValues: { captainName, captainContact },
          status: "PENDING",
        },
      });

      const otp = generateOTP();
      const otpHash = hashOTP(otp);
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await prisma.registration.update({
        where: { id: registration.id },
        data: { otpCodeHash: otpHash, otpExpiresAt },
      });

      await sendSMS(
        captainContact,
        `Your captain verification OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
      );

      logger.info(`📩 OTP sent to team captain ${captainContact}`);

      return res.status(201).json({
        success: true,
        message: "Captain registration created. OTP sent for verification.",
        data: { registrationId: registration.id },
      });
    }

    // ✅ INDIVIDUAL REGISTRATION FLOW
    const validResponses: any[] = [];
    if (Array.isArray(customFieldResponses) && event.customFields.length > 0) {
      for (const field of event.customFields) {
        const match = customFieldResponses.find((r: any) => r.fieldId === field.id);
        if (field.required && (!match || match.value === "" || match.value == null)) {
          throw new AppError(`Missing required field: ${field.name}`, 400);
        }
        if (match) validResponses.push({ fieldId: field.id, value: String(match.value) });
      }
    }

    const photoPath = (req as any).file
      ? `/uploads/photos/${path.basename((req as any).file.path)}`
      : null;

    const { registration, otp } = await prisma.$transaction(async (tx) => {
      const registration = await tx.registration.create({
        data: {
          eventId,
          profileId,
          customValues,
          photoPath,
          status: "PENDING",
        },
      });

      if (validResponses.length > 0) {
        await tx.registrationFieldResponse.createMany({
          data: validResponses.map((r) => ({
            registrationId: registration.id,
            fieldId: r.fieldId,
            value: r.value,
          })),
        });
      }

      const otp = generateOTP();
      const codeHash = hashOTP(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await tx.registration.update({
        where: { id: registration.id },
        data: { otpCodeHash: codeHash, otpExpiresAt: expiresAt },
      });

      return { registration, otp };
    });

    try {
      let contact: string | null = null;
      if (profileId) {
        const profile = await prisma.profile.findUnique({ where: { id: profileId } });
        contact = profile?.contact ?? null;
      } else if (customValues && typeof customValues === "object") {
        contact = (customValues.phone || customValues.contact || null) as string | null;
      }

      if (contact) {
        await sendSMS(
          contact,
          `Your registration OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
        );
      }
    } catch (smsErr) {
      logger.warn(`⚠️ SMS failed for registration ${registration.id}: ${smsErr}`);
    }

    return res.status(201).json({
      success: true,
      data: { registrationId: registration.id },
      message: "Registration created. OTP sent.",
    });
  } catch (err) {
    next(err);
    return; // ✅ this line fixes TS7030
  }
};


/* -------------------------------------------------------------------------- */
/* 📋 GET /registrations — Admin List                                         */
/* -------------------------------------------------------------------------- */
export const listRegistrations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status = "all", page = 1, limit = 50 } = req.query as any;
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {};
    if (status.toLowerCase() !== "all") where.status = status.toUpperCase();

    const [rows, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          event: { select: { title: true, location: true } },
          profile: { select: { firstName: true, lastName: true, barangay: true } },
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.registration.count({ where }),
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: { page: Number(page), total, limit: take },
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 🎫 GET /events/:eventId/registrants — Event-Specific View                  */
/* -------------------------------------------------------------------------- */
export const listRegistrantsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const user = (req as any).user;

    // Authorization for event managers
    if (user?.role === "EVENT_MANAGER") {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { managerId: true },
      });
      if (!event || event.managerId !== user.id) {
        throw new AppError("Forbidden: not your event.", 403);
      }
    }

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const status = (req.query.status as string)?.toUpperCase() || "ALL";
    const skip = (page - 1) * limit;

    const where: any = { eventId };
    if (status !== "ALL") where.status = status;

    const [rows, total] = await Promise.all([
      prisma.registration.findMany({
        where,
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
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.registration.count({ where }),
    ]);

    const result = rows.map((r) => {
      let customVals: any = {};
      try {
        customVals =
          typeof r.customValues === "string" ? JSON.parse(r.customValues) : r.customValues;
      } catch {
        customVals = {};
      }

      return {
        id: r.id,
        eventId: r.eventId,
        status: r.status,
        profile: r.profile || customVals,
        photoPath: r.photoPath || customVals.photo || null,
        createdAt: r.createdAt,
      };
    });

    res.json({
      success: true,
      data: result,
      pagination: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 🔍 GET /registrations/:id — Single View                                    */
/* -------------------------------------------------------------------------- */
export const getRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        event: true,
        profile: { select: { firstName: true, lastName: true, barangay: true } },
      },
    });
    if (!registration) throw new AppError("Registration not found", 404);
    res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* ✅ POST /registrations/:id/approval — Approve or Reject                    */
/* -------------------------------------------------------------------------- */
export const approveOrRejectRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const normalized = (status || "").toLowerCase();

    if (!["approved", "rejected"].includes(normalized)) {
      throw new AppError("Invalid status. Must be 'approved' or 'rejected'.", 400);
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { status: normalized.toUpperCase() },
    });

    res.json({
      success: true,
      message: `Registration ${normalized}`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 🎟️ POST /registrations/:id/checkin — Mark Attendance                      */
/* -------------------------------------------------------------------------- */
export const markCheckin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updated = await prisma.registration.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    res.json({ success: true, message: "Checked in", data: updated });
  } catch (err) {
    next(err);
  }
};
