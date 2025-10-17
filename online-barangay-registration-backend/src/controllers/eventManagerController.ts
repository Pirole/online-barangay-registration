// src/controllers/eventManagerController.ts
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
    const managers = await prisma.user.findMany({
      where: { role: "EVENT_MANAGER" },
      include: {
        profile: true, // ✅ include related profile info
      },
      orderBy: { createdAt: "desc" },
    });

    const result = managers.map((m) => ({
      id: m.id,
      email: m.email,
      firstName: m.profile?.firstName || "",
      lastName: m.profile?.lastName || "",
      createdAt: m.createdAt,
    }));

    res.json({ success: true, data: result });
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
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password) throw new AppError("Email and password are required", 400);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError("Email already exists", 400);

    const hashedPassword = await bcrypt.hash(password, 10);

    const newManager = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        role: "EVENT_MANAGER",
        phone: phone || null,
        profile: {
          create: {
            firstName: firstName || "",
            lastName: lastName || "",
          },
        },
      },
      include: { profile: true },
    });

    logger.info(`✅ Created Event Manager: ${newManager.email}`);

    res.status(201).json({
      success: true,
      data: {
        id: newManager.id,
        email: newManager.email,
        firstName: newManager.profile?.firstName,
        lastName: newManager.profile?.lastName,
        createdAt: newManager.createdAt,
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

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!existing || existing.role !== "EVENT_MANAGER")
      throw new AppError("Event Manager not found", 404);

    const data: any = {};

    if (email) data.email = email;
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      include: { profile: true },
    });

    // ✅ Update profile separately
    if (firstName || lastName) {
      await prisma.profile.upsert({
        where: { userId: id },
        update: {
          firstName: firstName ?? existing.profile?.firstName ?? "",
          lastName: lastName ?? existing.profile?.lastName ?? "",
        },
        create: {
          userId: id,
          firstName: firstName ?? "",
          lastName: lastName ?? "",
        },
      });
    }

    const refreshed = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    res.json({
      success: true,
      data: {
        id: refreshed?.id,
        email: refreshed?.email,
        firstName: refreshed?.profile?.firstName,
        lastName: refreshed?.profile?.lastName,
      },
    });
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

    // Cascade delete handled by Prisma if relations are set
    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: "Event Manager deleted" });
  } catch (error) {
    next(error);
  }
};
