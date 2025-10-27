// src/routes/teams.ts
import { Router } from "express";
import { authenticateToken, authorize } from "../middleware/auth";
import * as teamController from "../controllers/teams";

const router = Router();

// Create a new team (Captain)
router.post("/", authenticateToken, authorize("RESIDENT", "STAFF"), teamController.createTeam);

// Verify team OTP
router.post("/verify-otp", authenticateToken, authorize("RESIDENT", "STAFF"), teamController.verifyTeamOTP);

// Add a member to team
router.post("/add-member", authenticateToken, authorize("RESIDENT", "STAFF"), teamController.addTeamMember);

// List all teams for an event
router.get("/event/:eventId", authenticateToken, authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"), teamController.listTeamsForEvent);

export default router;
