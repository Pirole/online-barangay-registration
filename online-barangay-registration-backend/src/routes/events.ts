// src/routes/events.ts
import { Router } from "express";
import * as eventsController from "../controllers/events";
import * as registrationsController from "../controllers/registrations";
import { authenticateToken, authorize, optionalAuth } from "../middleware/auth";
import { uploadEventPhoto } from "../config/multer";

const router = Router();

/* -------------------------------------------------------------------------- */
/* 🧭 EVENT ROUTES                                                            */
/* -------------------------------------------------------------------------- */

/**
 * 🔹 Create Event (SUPER_ADMIN only)
 * Multipart form-data supported via Multer
 */
router.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  uploadEventPhoto.single("photo"),
  eventsController.createEvent
);

/**
 * 🔹 Public: List all events
 */
router.get("/", optionalAuth, eventsController.listEvents);

/**
 * 🔹 Public: Get single event by ID
 */
router.get("/:id", optionalAuth, eventsController.getEvent);

/**
 * 🔹 Update Event (SUPER_ADMIN, EVENT_MANAGER)
 */
router.patch(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  uploadEventPhoto.single("photo"),
  eventsController.updateEvent
);

/**
 * 🔹 Delete Event (SUPER_ADMIN only)
 */
router.delete(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  eventsController.deleteEvent
);

/* -------------------------------------------------------------------------- */
/* 🧩 CUSTOM FIELD ROUTES (SUPER_ADMIN only)                                  */
/* -------------------------------------------------------------------------- */

/**
 * 🔹 List custom fields for a specific event
 * Public (read-only)
 */
router.get(
  "/:eventId/custom-fields",
  optionalAuth,
  eventsController.listCustomFieldsForEvent
);

/**
 * 🔹 Create a custom field for an event (SUPER_ADMIN only)
 */
router.post(
  "/:eventId/custom-fields",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  eventsController.createCustomField
);

/**
 * 🔹 Update a custom field (SUPER_ADMIN only)
 */
router.put(
  "/:eventId/custom-fields/:fieldId",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  eventsController.updateCustomField
);

/**
 * 🔹 Delete a custom field (SUPER_ADMIN only)
 */
router.delete(
  "/:eventId/custom-fields/:fieldId",
  authenticateToken,
  authorize("SUPER_ADMIN"),
  eventsController.deleteCustomField
);

/* -------------------------------------------------------------------------- */
/* 🧍‍♂️ REGISTRANT ROUTES                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 🔹 List all registrants for an event
 * (SUPER_ADMIN, EVENT_MANAGER, STAFF)
 */
router.get(
  "/:eventId/registrants",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER", "STAFF"),
  registrationsController.listRegistrantsForEvent
);

/* -------------------------------------------------------------------------- */
/* ✅ EXPORT                                                                 */
/* -------------------------------------------------------------------------- */
export default router;
