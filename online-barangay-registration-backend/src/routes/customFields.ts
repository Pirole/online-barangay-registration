// src/routes/customFields.ts
import { Router } from "express";
import * as cfController from "../controllers/events"; // ✅ use events controller
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

/**
 * 🔹 Create new custom field (SUPER_ADMIN, EVENT_MANAGER)
 */
router.post(
  "/",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  cfController.createCustomField
);

/**
 * 🔹 List all custom fields for an event
 */
router.get(
  "/event/:eventId",
  authenticateToken,
  cfController.listCustomFieldsForEvent
);

/**
 * 🔹 Update a custom field (SUPER_ADMIN, EVENT_MANAGER)
 */
router.patch(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  cfController.updateCustomField
);

/**
 * 🔹 Delete a custom field (SUPER_ADMIN, EVENT_MANAGER)
 */
router.delete(
  "/:id",
  authenticateToken,
  authorize("SUPER_ADMIN", "EVENT_MANAGER"),
  cfController.deleteCustomField
);

export default router;
