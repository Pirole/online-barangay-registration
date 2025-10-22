import { Router } from "express";
import express from "express";
import * as eventsController from "../controllers/events";
import * as registrationsController from "../controllers/registrations";
import { CreateEventSchema, UpdateEventSchema, QueryEventsSchema, validateRequest } from "../utils/validation";
import { authenticateToken, authorize, optionalAuth } from "../middleware/auth";

const router = Router();

// ✅ Create event FIRST (before any dynamic route)
router.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  express.json(),
  validateRequest(CreateEventSchema),
  eventsController.createEvent
);

// ✅ Public list (with query support)
router.get("/", validateRequest(QueryEventsSchema), optionalAuth, eventsController.listEvents);

// ✅ Public: single event
router.get("/:id", optionalAuth, eventsController.getEvent);

// ✅ List registrants for a specific event
router.get(
  "/:eventId/registrants",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"),
  registrationsController.listRegistrantsForEvent
);

// ✅ Update event
router.patch(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  validateRequest(UpdateEventSchema),
  eventsController.updateEvent
);

// ✅ Delete event
router.delete("/:id", authenticateToken, authorize("SUPER_ADMIN"), eventsController.deleteEvent);

export default router;
