// src/controllers/teams.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import crypto from "crypto";
import { logger } from "../utils/logger";

// Utility: generate a 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Utility: hash OTP
function hashOTP(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* 🧩 CREATE TEAM (Captain creates)                                           */
/* -------------------------------------------------------------------------- */
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, name, captainProfileId } = req.body;

    if (!eventId || !name || !captainProfileId) {
      throw new AppError("Missing required fields: eventId, name, captainProfileId", 400);
    }

    // Check event exists and allows team registration
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError("Event not found", 404);
    if (event.registrationMode !== "team" && event.registrationMode !== "both") {
      throw new AppError("This event does not allow team registrations", 400);
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Create team
    const team = await prisma.team.create({
      data: {
        eventId,
        name,
        members: {
          create: {
            profileId: captainProfileId,
          },
        },
      },
      include: { members: true },
    });

    // Store OTP in a related Registration entry for verification tracking
    await prisma.registration.create({
      data: {
        eventId,
        profileId: captainProfileId,
        otpCodeHash: otpHash,
        otpExpiresAt: otpExpires,
      },
    });

    logger.info(`🧩 Created team "${name}" for event ${eventId} (Captain ${captainProfileId})`);
    res.status(201).json({
      success: true,
      message: "Team created successfully. Use OTP to verify.",
      data: { team, otp }, // in production, you wouldn’t expose the OTP directly
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 🔐 VERIFY TEAM OTP                                                        */
/* -------------------------------------------------------------------------- */
export const verifyTeamOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { captainProfileId, otp } = req.body;

    if (!captainProfileId || !otp) {
      throw new AppError("Missing required fields: captainProfileId, otp", 400);
    }

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

    await prisma.registration.update({
      where: { id: registration.id },
      data: { otpCodeHash: null, otpExpiresAt: null },
    });

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

    if (!teamId || !profileId) {
      throw new AppError("Missing required fields: teamId, profileId", 400);
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { event: true, members: true },
    });

    if (!team) throw new AppError("Team not found", 404);

    const memberCount = team.members.length;
    if (team.event.teamMemberSlots && memberCount >= team.event.teamMemberSlots) {
      throw new AppError("Team is already full", 400);
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: { teamId, profileId },
    });
    if (existingMember) throw new AppError("This profile is already in the team", 400);

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
    const teams = await prisma.team.findMany({
      where: { eventId },
      include: { members: { include: { profile: true } } },
    });

    res.json({ success: true, data: teams });
  } catch (err) {
    next(err);
  }
};
