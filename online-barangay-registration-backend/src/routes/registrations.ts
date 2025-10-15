// src/routes/registrations.ts
import { Router } from "express";
import * as registrationsController from "../controllers/registrations";
import { authenticateToken, authorize } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

// Create registration (public)
router.post("/", upload.single("photo"), registrationsController.createRegistration);

// Admin view all registrations (with optional ?status=pending)
router.get("/", authenticateToken, authorize("SUPER_ADMIN", "EVENT_MANAGER"), registrationsController.listRegistrations);

// View registrants for specific event
router.get("/event/:eventId", authenticateToken, registrationsController.listRegistrantsForEvent);

// View specific registration
router.get("/:id", authenticateToken, registrationsController.getRegistration);

// Approve / Reject registration
router.post(
  "/:id/approval",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  registrationsController.approveOrRejectRegistration
);

// Check-in (QR-based)
router.post(
  "/:id/checkin",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"),
  registrationsController.markCheckin
);

export default router;
