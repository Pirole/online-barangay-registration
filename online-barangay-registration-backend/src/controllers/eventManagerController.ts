import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger";
/**
 * Get all Event Managers
 */
export const getAllEventManagers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Fetch all users with role = EVENT_MANAGER
    const managers = await prisma.user.findMany({
      where: { role: "EVENT_MANAGER" },
      // Only select safe fields that are guaranteed to exist
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: managers });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Event Manager
 */
export const createEventManager = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError("Email already exists", 400);

    const hashedPassword = await bcrypt.hash(password, 10);

    const newManager = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword, // ✅ FIXED HERE
        role: "EVENT_MANAGER",
        // optional fields
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      },
    });

    logger.info(`✅ Created Event Manager: ${newManager.email}`);

    res.status(201).json({
      success: true,
      data: {
        id: newManager.id,
        email: newManager.email,
        role: newManager.role,
      },
      message: "Event Manager created successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an Event Manager
 */
export const updateEventManager = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { email, password, firstName, lastName } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.role !== "EVENT_MANAGER")
      throw new AppError("Event Manager not found", 404);

    const data: any = {};

    if (email) data.email = email;
    if (password) data.password = await bcrypt.hash(password, 10);
    if ("firstName" in prisma.user.fields && firstName)
      data.firstName = firstName;
    if ("lastName" in prisma.user.fields && lastName)
      data.lastName = lastName;

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an Event Manager
 */
export const deleteEventManager = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.role !== "EVENT_MANAGER")
      throw new AppError("Event Manager not found", 404);

    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: "Event Manager deleted" });
  } catch (error) {
    next(error);
  }
};
