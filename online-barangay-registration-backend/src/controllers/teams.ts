// src/controllers/teams.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import crypto from "crypto";
import { logger } from "../utils/logger";
import { sendSMS } from "../utils/sms";
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from "../utils/otp";

/* -------------------------------------------------------------------------- */
/* 🧩 CREATE TEAM (Captain creates + OTP generation)                          */
/* -------------------------------------------------------------------------- */
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, name, captainProfileId, members = [] } = req.body;

    if (!eventId || !name || !captainProfileId) {
      throw new AppError("Missing required fields: eventId, name, captainProfileId", 400);
    }

    // ✅ Validate event
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError("Event not found", 404);
    if (event.registrationMode !== "team" && event.registrationMode !== "both") {
      throw new AppError("This event does not allow team registrations", 400);
    }

    // ✅ Create team with captain as first member
    const team = await prisma.team.create({
      data: {
        eventId,
        name,
        members: {
          create: [
            {
              profileId: captainProfileId,
            },
            // Add other members if provided
            ...members
              .filter((m: any) => m.profileId && m.profileId !== captainProfileId)
              .map((m: any) => ({ profileId: m.profileId })),
          ],
        },
      },
      include: { members: true },
    });

    // ✅ Generate OTP for captain verification
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // ✅ Create registration for the captain
    const registration = await prisma.registration.create({
      data: {
        eventId,
        profileId: captainProfileId,
        otpCodeHash: otpHash,
        otpExpiresAt: otpExpires,
        status: "PENDING",
      },
    });

    // ✅ Send OTP to captain (if contact info available)
    const captainProfile = await prisma.profile.findUnique({
      where: { id: captainProfileId },
    });

    if (captainProfile?.contact) {
      try {
        await sendSMS(
          captainProfile.contact,
          `Your team registration OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
        );
        logger.info(`📩 OTP sent to ${captainProfile.contact}`);
      } catch (err) {
        logger.warn(`⚠️ Failed to send SMS to ${captainProfile.contact}: ${err}`);
      }
    } else {
      logger.info(`ℹ️ Captain has no contact info. OTP: ${otp}`);
    }

    logger.info(`✅ Created team "${name}" for event ${eventId} (Captain ${captainProfileId})`);
    res.status(201).json({
      success: true,
      message: "Team created successfully. OTP sent to captain.",
      data: { team, otp }, // NOTE: Only visible in dev mode; hide in prod
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 🔐 VERIFY TEAM OTP (Captain verification)                                  */
/* -------------------------------------------------------------------------- */
export const verifyTeamOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { captainProfileId, otp } = req.body;
    if (!captainProfileId || !otp)
      throw new AppError("Missing required fields: captainProfileId, otp", 400);

    const registration = await prisma.registration.findFirst({
      where: { profileId: captainProfileId },
    });

    if (!registration || !registration.otpCodeHash) {
      throw new AppError("OTP not found. Please create a team first.", 404);
    }

    if (registration.otpExpiresAt && registration.otpExpiresAt < new Date()) {
      throw new AppError("OTP expired. Please request a new one.", 400);
    }

    const hashedInput = hashOTP(otp);
    if (hashedInput !== registration.otpCodeHash) {
      throw new AppError("Invalid OTP", 400);
    }

    // ✅ Clear OTP fields after successful verification
    await prisma.registration.update({
      where: { id: registration.id },
      data: { otpCodeHash: null, otpExpiresAt: null, status: "APPROVED" },
    });

    logger.info(`✅ Team captain verified successfully (${captainProfileId})`);
    res.json({ success: true, message: "Team captain verified successfully." });
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
    if (!teamId || !profileId)
      throw new AppError("Missing required fields: teamId, profileId", 400);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { event: true, members: true },
    });
    if (!team) throw new AppError("Team not found", 404);

    // ✅ Enforce max slots
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
      message: "Member added successfully",
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
