import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";

/**
 * GET /events/:id/custom-fields
 * Public listing of fields for a specific event
 */
export const listEventCustomFields = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;

    const fields = await prisma.customField.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        required: true,
        predefined: true,
      },
    });

    res.json({ success: true, data: fields });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /events/:id/custom-fields
 */
export const createEventCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id;
    const { name, type, required, predefined } = req.body;

    if (!name || !type) {
      throw new AppError("name and type are required", 400);
    }

    const created = await prisma.customField.create({
      data: {
        eventId,
        name,
        type,
        required: required === "true" || required === true,
        predefined: predefined === "true" || predefined === true,
      },
    });

    // ✅ Audit log
    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "CREATE",
          targetType: "CUSTOM_FIELD",
          targetId: created.id,
          metadata: { name, type },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /events/:id/custom-fields/:fieldId
 */
export const updateEventCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: eventId, fieldId } = req.params as any;
    const { name, type, required, predefined } = req.body;

    const field = await prisma.customField.findUnique({ where: { id: fieldId } });
    if (!field || field.eventId !== eventId) throw new AppError("Custom field not found", 404);

    const updated = await prisma.customField.update({
      where: { id: fieldId },
      data: {
        name: name ?? field.name,
        type: type ?? field.type,
        required: required ?? field.required,
        predefined: predefined ?? field.predefined,
      },
    });

    // ✅ Audit log
    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "UPDATE",
          targetType: "CUSTOM_FIELD",
          targetId: fieldId,
          metadata: { before: field, after: updated },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /events/:id/custom-fields/:fieldId
 */
export const deleteEventCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: eventId, fieldId } = req.params as any;

    const field = await prisma.customField.findUnique({ where: { id: fieldId } });
    if (!field || field.eventId !== eventId) throw new AppError("Custom field not found", 404);

    await prisma.customField.delete({ where: { id: fieldId } });

    // ✅ Audit log
    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE",
          targetType: "CUSTOM_FIELD",
          targetId: fieldId,
          metadata: { name: field.name },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    res.json({ success: true, message: "Custom field deleted" });
  } catch (err) {
    next(err);
  }
};
export default {
  listEventCustomFields,
  createEventCustomField,
  updateEventCustomField,
  deleteEventCustomField,
};