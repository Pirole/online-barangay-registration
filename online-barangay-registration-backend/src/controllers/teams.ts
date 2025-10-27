// src/controllers/teams.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { sendSMS } from "../utils/sms";
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from "../utils/otp";

/* -------------------------------------------------------------------------- */
/* 🧩 CREATE TEAM (Captain registration already done via OTP)                 */
/* -------------------------------------------------------------------------- */
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, name, captainRegistrationId, members = [] } = req.body;

    if (!eventId || !name || !captainRegistrationId) {
      throw new AppError(
        "Missing required fields: eventId, name, captainRegistrationId",
        400
      );
    }

    // ✅ Validate event
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError("Event not found", 404);
    if (event.registrationMode !== "team" && event.registrationMode !== "both") {
      throw new AppError("This event does not allow team registrations", 400);
    }

    // ✅ Verify captain's registration
    const registration = await prisma.registration.findUnique({
      where: { id: captainRegistrationId },
    });
    if (!registration) throw new AppError("Captain registration not found", 404);
    if (registration.eventId !== eventId) {
      throw new AppError("Captain registration does not belong to this event", 400);
    }
    if (registration.status !== "APPROVED") {
      throw new AppError("Captain must complete OTP verification before creating a team", 400);
    }

    // ✅ Create team linked to captain registration
    const team = await prisma.team.create({
      data: {
        eventId,
        name,
        captainRegistrationId,
        members: {
          create: members
            .filter((m: any) => !!m.profileId)
            .map((m: any) => ({
              profileId: m.profileId,
            })),
        },
      },
      include: {
        members: {
          include: {
            profile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                contact: true,
                barangay: true,
              },
            },
          },
        },
      },
    });

    logger.info(
      `✅ Team "${name}" created for event ${eventId} (captain registration ${captainRegistrationId})`
    );

    res.status(201).json({
      success: true,
      message: "Team created successfully.",
      data: { team },
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 🔐 VERIFY CAPTAIN OTP (Registration-based)                                */
/* -------------------------------------------------------------------------- */
export const verifyTeamOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { captainRegistrationId, otp } = req.body;
    if (!captainRegistrationId || !otp) {
      throw new AppError("Missing required fields: captainRegistrationId, otp", 400);
    }

    const registration = await prisma.registration.findUnique({
      where: { id: captainRegistrationId },
    });

    if (!registration || !registration.otpCodeHash) {
      throw new AppError("OTP not found. Please register first.", 404);
    }

    if (registration.otpExpiresAt && registration.otpExpiresAt < new Date()) {
      throw new AppError("OTP expired. Please request a new one.", 400);
    }

    const hashedInput = hashOTP(otp);
    if (hashedInput !== registration.otpCodeHash) {
      throw new AppError("Invalid OTP", 400);
    }

    // ✅ Mark verified
    await prisma.registration.update({
      where: { id: captainRegistrationId },
      data: { otpCodeHash: null, otpExpiresAt: null, status: "APPROVED" },
    });

    logger.info(`✅ Captain registration verified (${captainRegistrationId})`);
    res.json({ success: true, message: "Captain OTP verified successfully." });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 👥 ADD TEAM MEMBER                                                        */
/* -------------------------------------------------------------------------- */
export const addTeamMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, profileId } = req.body;
    if (!teamId || !profileId) {
      throw new AppError("Missing required fields: teamId, profileId", 400);
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { event: true, members: true },
    });
    if (!team) throw new AppError("Team not found", 404);

    // ✅ Enforce team slot limits
    const memberCount = team.members.length;
    if (team.event.teamMemberSlots && memberCount >= team.event.teamMemberSlots) {
      throw new AppError("Team is already full", 400);
    }

    // ✅ Prevent duplicates
    const existing = await prisma.teamMember.findFirst({
      where: { teamId, profileId },
    });
    if (existing) throw new AppError("This profile is already in the team", 400);

    const newMember = await prisma.teamMember.create({
      data: { teamId, profileId },
    });

    res.status(201).json({
      success: true,
      message: "Member added successfully.",
      data: newMember,
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 📋 LIST TEAMS PER EVENT                                                   */
/* -------------------------------------------------------------------------- */
export const listTeamsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    if (!eventId) throw new AppError("Missing eventId", 400);

    const teams = await prisma.team.findMany({
      where: { eventId },
      include: {
        members: {
          include: {
            profile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                contact: true,
                barangay: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: teams });
  } catch (err) {
    next(err);
  }
};
