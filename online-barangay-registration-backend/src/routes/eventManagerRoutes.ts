import { Router, Request, Response, NextFunction } from "express";
import {
  getAllEventManagers,
  createEventManager,
  updateEventManager,
  deleteEventManager,
} from "../controllers/eventManagerController";
import { authenticateToken } from "../middleware/auth"; // ✅ this exists in your project

const router = Router();

/**
 * Middleware to restrict routes to SUPER_ADMIN users only
 */
const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;

  if (!user || user.role !== "SUPER_ADMIN") {
    return res
      .status(403)
      .json({ success: false, message: "Access denied. SUPER_ADMIN only." });
  }

  next();
};

// ✅ Get all Event Managers
router.get("/", authenticateToken, requireSuperAdmin, getAllEventManagers);

// ✅ Create a new Event Manager
router.post("/", authenticateToken, requireSuperAdmin, createEventManager);

// ✅ Update Event Manager by ID
router.put("/:id", authenticateToken, requireSuperAdmin, updateEventManager);

// ✅ Delete Event Manager by ID
router.delete("/:id", authenticateToken, requireSuperAdmin, deleteEventManager);

export default router;
