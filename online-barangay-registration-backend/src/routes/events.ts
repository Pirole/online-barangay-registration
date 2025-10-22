// src/routes/events.ts
import { Router } from "express";
import * as eventsController from "../controllers/events";
import * as registrationsController from "../controllers/registrations";
import { authenticateToken, authorize, optionalAuth } from "../middleware/auth";
import { uploadEventPhoto } from "../config/multer";

const router = Router();

// ✅ Create event (multipart form-data supported)
router.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  uploadEventPhoto.single("photo"), // 🔥 multer parses form-data
  eventsController.createEvent // 🔥 skip validation for now
);

// ✅ Public list
router.get("/", optionalAuth, eventsController.listEvents);

// ✅ Public: single event
router.get("/:id", optionalAuth, eventsController.getEvent);

// ✅ List registrants
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
  uploadEventPhoto.single("photo"), // allow updates with image
  eventsController.updateEvent
);

// ✅ Delete event
router.delete(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  eventsController.deleteEvent
);

export default router;
