// src/routes/registrations.ts
import { Router } from "express";
import * as registrationsController from "../controllers/registrations";
import {
  authenticateToken,
  authorize,
  restrictToAssignedEvents, // ✅ added middleware import
} from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

/**
 * ======================================================
 * Public: Create Registration
 * ======================================================
 * Anyone can register for an event.
 */
router.post("/", upload.single("photo"), registrationsController.createRegistration);

/**
 * ======================================================
 * Admin: View All Registrations (Super Admin / Event Manager)
 * ======================================================
 */
router.get(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  registrationsController.listRegistrations
);

/**
 * ======================================================
 * Event-Specific: View Registrants for a Given Event
 * ======================================================
 * Super Admins can view all.
 * Event Managers and Staff are restricted to their assigned events only.
 */
router.get(
  "/event/:eventId",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"),
  restrictToAssignedEvents, // ✅ event scoping
  registrationsController.listRegistrantsForEvent
);

/**
 * ======================================================
 * View Single Registration (by ID)
 * ======================================================
 */
router.get(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"),
  restrictToAssignedEvents, // ✅ protects individual lookup
  registrationsController.getRegistration
);

/**
 * ======================================================
 * Approve / Reject Registration
 * ======================================================
 * Only Super Admins or the Event Manager assigned to that event.
 */
router.post(
  "/:id/approval",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  restrictToAssignedEvents, // ✅ ensures manager owns the event
  registrationsController.approveOrRejectRegistration
);

/**
 * ======================================================
 * Check-In (QR-based)
 * ======================================================
 * Super Admins, Event Managers, and Staff can check in,
 * but Managers and Staff are restricted to their assigned events.
 */
router.post(
  "/:id/checkin",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"),
  restrictToAssignedEvents, // ✅ ensures event assignment matches
  registrationsController.markCheckin
);

export default router;
