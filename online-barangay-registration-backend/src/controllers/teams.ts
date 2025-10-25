// src/controllers/teams.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from "../utils/otp";
import { logger } from "../utils/logger";
import { sendSMS } from "../utils/sms";

/**
 * Helper: get profile id for currently authenticated user
 */
const getProfileForUser = async (userId: string) => {
  if (!userId) return null;
  return prisma.profile.findUnique({ where: { userId } });
};

/**
 * POST /teams
 * Body: {
 *   eventId: string,
 *   name: string,
 *   members: string[] // array of profileIds (must include captain)
 *   // optional: customFieldResponses: [{ fieldId, value }] -> stored as registrationFieldResponse (team-level)
 * }
 *
 * Requires authentication. The authenticated user's profile must be present in `members` (be the captain).
 */
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = (req as any).validatedData ?? req.body;
    const { eventId, name, members = [], customFieldResponses = [] } = payload;

    if (!eventId || !name) throw new AppError("eventId and name are required", 400);
    if (!Array.isArray(members) || members.length === 0) {
      throw new AppError("At least one member (the captain) must be provided", 400);
    }

    // Auth check: must be logged in
    const user = (req as any).user;
    if (!user) throw new AppError("Authentication required", 401);

    // Find profile for authenticated user
    const userProfile = await getProfileForUser(user.id);
    if (!userProfile) throw new AppError("User profile not found. Create profile first.", 400);

    // Ensure user's profile is one of the members (captain)
    if (!members.includes(userProfile.id)) {
      throw new AppError("Your profile must be included in members and act as the team captain.", 400);
    }

    // Load event and its constraints + customFields
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, registrationMode: true, teamMemberSlots: true, customFields: true, managerId: true },
    });
    if (!event) throw new AppError("Event not found", 404);
    if (event.registrationMode !== "team") {
      throw new AppError("This event does not accept team registrations.", 400);
    }

    const maxSlots = event.teamMemberSlots || 1;
    if (members.length > maxSlots) {
      throw new AppError(`This event allows up to ${maxSlots} members per team.`, 400);
    }

    // Validate each supplied profileId exists
    const uniqueMemberIds = Array.from(new Set(members));
    const profiles = await prisma.profile.findMany({ where: { id: { in: uniqueMemberIds } } });
    if (profiles.length !== uniqueMemberIds.length) {
      throw new AppError("One or more provided member profiles do not exist", 400);
    }

    // Validate customFieldResponses if provided: should correspond to event.customFields if any
    const fieldValidationErrors: string[] = [];
    const validFieldResponses: { fieldId: string; value: string }[] = [];

    const eventFields = (event.customFields || []) as any[];
    if (Array.isArray(customFieldResponses) && customFieldResponses.length && eventFields.length) {
      // create map for quick lookup
      const fieldMap = new Map<string, any>();
      for (const f of eventFields) fieldMap.set(f.id, f);

      for (const r of customFieldResponses) {
        const { fieldId, value } = r as any;
        if (!fieldId) {
          fieldValidationErrors.push("FieldId is required on each customFieldResponses item");
          continue;
        }
        const fld = fieldMap.get(fieldId);
        if (!fld) {
          fieldValidationErrors.push(`Field ${fieldId} does not belong to this event`);
          continue;
        }
        // required check
        if (fld.required && (value === null || value === undefined || String(value).trim() === "")) {
          fieldValidationErrors.push(`Field "${fld.name}" is required`);
          continue;
        }
        // type check
        if (fld.type === "number" && value !== null && value !== undefined && String(value).trim() !== "" && isNaN(Number(value))) {
          fieldValidationErrors.push(`Field "${fld.name}" expects a number`);
          continue;
        }
        // select/radio check
        if ((fld.type === "select" || fld.type === "radio") && Array.isArray(fld.options)) {
          const allowed = fld.options.map((o: any) => String(o.value));
          if (!allowed.includes(String(value))) {
            fieldValidationErrors.push(`Field "${fld.name}" has invalid option: ${value}`);
            continue;
          }
        }
        validFieldResponses.push({ fieldId, value: String(value ?? "") });
      }
    }

    if (fieldValidationErrors.length) throw new AppError(fieldValidationErrors.join("; "), 400);

    // All validations passed. Create team, members, registration, field responses, OTP in a transaction.
    const actor = user || null;
    const txResult = await prisma.$transaction(async (tx) => {
      // create team
      const team = await tx.team.create({
        data: {
          eventId,
          name,
        },
      });

      // create team members
      const createMembersPayload = uniqueMemberIds.map((pid) => ({
        teamId: team.id,
        profileId: pid,
      }));
      // create many
      await tx.teamMember.createMany({ data: createMembersPayload });

      // create single registration for the team (team-level registration)
      const registration = await tx.registration.create({
        data: {
          eventId,
          // team-level: store team name inside customValues or leave customValues null
          customValues: { teamName: name },
          status: "PENDING",
        },
      });

      // create field responses (team-level)
      if (validFieldResponses.length) {
        await tx.registrationFieldResponse.createMany({
          data: validFieldResponses.map((r) => ({
            registrationId: registration.id,
            fieldId: r.fieldId,
            value: r.value,
          })),
        });
      }

      // create OTP for the registration (one OTP for the team)
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

      // audit log - team create + registration
      await tx.auditLog.create({
        data: {
          actorId: actor?.id ?? null,
          action: "CREATE",
          targetType: "TEAM",
          targetId: team.id,
          metadata: { eventId, teamName: name, memberCount: uniqueMemberIds.length },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor?.id ?? null,
          action: "CREATE",
          targetType: "REGISTRATION",
          targetId: registration.id,
          metadata: { eventId, teamId: team.id },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });

      // return payload
      return { team, registrationId: registration.id, otp };
    });

    // After commit: send OTP to captain's contact (captain is authenticated user's profile)
    try {
      const captainProfile = userProfile;
      const contact = captainProfile.contact ?? null;
      if (contact) {
        const sent = await sendSMS(contact, `Your team registration OTP is ${txResult.otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`);
        if (sent) logger.info(`📩 Team OTP sent via SMS to ${contact}`);
        else logger.warn(`⚠️ Failed to send team OTP to ${contact} (registration ${txResult.registrationId})`);
      } else {
        logger.info(`ℹ️ Captain has no contact; OTP for team registration ${txResult.registrationId}: ${txResult.otp}`);
      }
    } catch (smsErr) {
      logger.warn(`⚠️ SMS error for team registration ${txResult.registrationId}: ${smsErr}`);
    }

    // return created team info
    const teamFull = await prisma.team.findUnique({
      where: { id: txResult.team.id },
      include: { members: { include: { profile: true } } },
    });

    res.status(201).json({
      success: true,
      data: { team: teamFull, registrationId: txResult.registrationId },
      message: "Team created and registration created (OTP sent to captain if contact available).",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /teams/:eventId
 * Admin/event-manager/staff view: list teams for an event (with members)
 */
export const listTeamsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const user = (req as any).user;

    if (!eventId) throw new AppError("eventId required", 400);

    // If EVENT_MANAGER, ensure the event belongs to them
    if (user?.role === "EVENT_MANAGER") {
      const event = await prisma.event.findUnique({ where: { id: eventId }, select: { managerId: true } });
      if (!event || event.managerId !== user.id) throw new AppError("Forbidden: Not your assigned event", 403);
    }

    // Only SUPER_ADMIN, EVENT_MANAGER, STAFF allowed to call this route (enforced at route layer)
    const teams = await prisma.team.findMany({
      where: { eventId },
      include: {
        members: {
          include: { profile: { select: { id: true, firstName: true, lastName: true, contact: true, barangay: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: teams });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /teams/:teamId/members
 * Body: { members: [profileId1, profileId2, ...] }
 * Only the team captain (first member created) or SUPER_ADMIN can add members.
 * Enforces teamMemberSlots limit.
 */
export const addTeamMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId } = req.params;
    const { members = [] } = (req as any).validatedData ?? req.body;

    if (!teamId) throw new AppError("teamId required", 400);
    if (!Array.isArray(members) || members.length === 0) throw new AppError("members array required", 400);

    const user = (req as any).user;
    if (!user) throw new AppError("Authentication required", 401);

    // fetch team and event to check teamMemberSlots
    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { event: { select: { teamMemberSlots: true, id: true } }, members: true } });
    if (!team) throw new AppError("Team not found", 404);

    // identify captain: the earliest TeamMember by createdAt (we assume first member is captain)
    const captainMember = await prisma.teamMember.findFirst({
      where: { teamId },
      orderBy: { id: "asc" }, // earliest member (by id) is treated as captain
    });

    const isCaptain = captainMember && (await prisma.profile.findUnique({ where: { id: captainMember.profileId } }))?.userId === user.id;
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (!isCaptain && !isSuperAdmin) throw new AppError("Only the team captain or a SUPER_ADMIN can add members", 403);

    // check available slots
    const currentCount = team.members.length;
    const maxSlots = team.event.teamMemberSlots || 1;
    if (currentCount + members.length > maxSlots) {
      throw new AppError(`Cannot add members: would exceed team limit of ${maxSlots}`, 400);
    }

    // validate profiles exist
    const uniqueMemberIds = Array.from(new Set(members));
    const foundProfiles = await prisma.profile.findMany({ where: { id: { in: uniqueMemberIds } } });
    if (foundProfiles.length !== uniqueMemberIds.length) {
      throw new AppError("One or more provided member profiles do not exist", 400);
    }

    // create team members
    const createPayload = uniqueMemberIds.map((pid) => ({ teamId, profileId: pid }));
    await prisma.teamMember.createMany({ data: createPayload });

    // audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "CREATE",
        targetType: "TEAM",
        targetId: teamId,
        metadata: { addedMemberCount: createPayload.length },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
      },
    });

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: { include: { profile: true } } },
    });

    res.status(201).json({ success: true, data: updatedTeam, message: "Members added" });
  } catch (err) {
    next(err);
  }
};
