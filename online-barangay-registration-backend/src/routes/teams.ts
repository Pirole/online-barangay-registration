// src/routes/teams.ts
import { Router } from "express";
import * as teamsController from "../controllers/teams";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

/**
 * Create team (authenticated users)
 * Body: { eventId, name, members: [profileId1, profileId2...], customFieldResponses? }
 * The authenticated user's profile must be included in members (be captain).
 */
router.post("/", authenticateToken, teamsController.createTeam);

/**
 * List teams for an event - admin / event manager / staff
 */
router.get("/:eventId", authenticateToken, authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"), teamsController.listTeamsForEvent);

/**
 * Add members to existing team
 * Body: { members: [profileId1, profileId2...] }
 * Only captain or SUPER_ADMIN can call
 */
router.post("/:teamId/members", authenticateToken, teamsController.addTeamMembers);

export default router;
