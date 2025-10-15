import express from "express";
import {
  getAllEventManagers,
  createEventManager,
  updateEventManager,
  deleteEventManager,
} from "../controllers/eventManagerController";
import { verifyToken, requireRole } from "../middleware/auth";

const router = express.Router();

router.use(verifyToken);
router.use(requireRole("SUPER_ADMIN")); // Only super admins can manage event managers

router.get("/", getAllEventManagers);
router.post("/", createEventManager);
router.put("/:id", updateEventManager);
router.delete("/:id", deleteEventManager);

export default router;
