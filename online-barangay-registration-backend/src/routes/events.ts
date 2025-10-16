import { Router } from "express";
import * as eventsController from "../controllers/events";
import * as registrationsController from "../controllers/registrations";
import {
  CreateEventSchema,
  UpdateEventSchema,
  QueryEventsSchema,
  validateRequest,
} from "../utils/validation";
import {
  authenticateToken,
  authorize,
  optionalAuth,
} from "../middleware/auth";
import { uploadEventPhoto } from "../config/multer";

const router = Router();

/**
 * 🧾 Public list of events (with query support)
 * Accessible to everyone — residents included
 */
router.get(
  "/",
  validateRequest(QueryEventsSchema),
  optionalAuth,
  eventsController.listEvents
);

/**
 * 📍 Public: Single event details
 */
router.get("/:id", optionalAuth, eventsController.getEvent);

/**
 * 👥 List registrants for a specific event
 * Restricted to SUPER_ADMIN / EVENT_MANAGER / STAFF
 */
router.get(
  "/:eventId/registrants",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"),
  registrationsController.listRegistrantsForEvent
);

/**
 * 🏗️ Create event
 * SUPER_ADMIN only — Event Managers can’t directly create new events
 * (for now, as per your current phase)
 */
router.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  uploadEventPhoto.single("photo"),
  validateRequest(CreateEventSchema),
  eventsController.createEvent
);

/**
 * ✏️ Update event
 * SUPER_ADMIN only
 */
router.patch(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  uploadEventPhoto.single("photo"),
  validateRequest(UpdateEventSchema),
  eventsController.updateEvent
);

/**
 * 🗑️ Delete event
 * SUPER_ADMIN only (hard delete)
 */
router.delete(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  eventsController.deleteEvent
);

export default router;
