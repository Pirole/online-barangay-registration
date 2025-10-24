// src/controllers/events.ts
import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import prisma from "../config/prisma";

/* -------------------------------------------------------------------------- */
/* 📸 HELPER: Save Uploaded Event Photo                                       */
/* -------------------------------------------------------------------------- */

const saveEventPhoto = (file?: Express.Multer.File): string | null => {
  if (!file) return null;
  const uploadsDir = path.join(process.cwd(), "uploads", "events");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
  const destPath = path.join(uploadsDir, fileName);

  if (file.path && !file.buffer) fs.renameSync(file.path, destPath);
  else if (file.buffer) fs.writeFileSync(destPath, file.buffer);

  return `/uploads/events/${fileName}`;
};

/* -------------------------------------------------------------------------- */
/* 📋 LIST EVENTS                                                            */
/* -------------------------------------------------------------------------- */

export const listEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status = "upcoming", search, page = 1, limit = 20, managerId } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);
    const user = (req as any).user;
    const whereClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (search) {
      whereClauses.push(`(e.title ILIKE $${idx} OR e.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (user?.role === "EVENT_MANAGER") {
      whereClauses.push(`e.manager_id = $${idx}`);
      params.push(user.id);
      idx++;
    } else if (managerId && user?.role === "SUPER_ADMIN") {
      whereClauses.push(`e.manager_id = $${idx}`);
      params.push(managerId);
      idx++;
    }

    if (status === "upcoming") whereClauses.push(`e.start_date > NOW()`);
    else if (status === "ongoing") whereClauses.push(`e.start_date <= NOW() AND e.end_date >= NOW()`);
    else if (status === "completed") whereClauses.push(`e.end_date < NOW()`);

    const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const totalRes = await query(`SELECT COUNT(*) AS count FROM events e ${where}`, params);
    const total = Number(totalRes.rows[0].count);

    const rows = await query(
      `
      SELECT 
        e.id, e.title, e.description, e.location,
        e.start_date, e.end_date, e.capacity,
        e.age_min, e.age_max, e.is_active, e.manager_id,
        e.category_id, e.photo_path, e.registration_mode, e.team_member_slots,
        e.created_at, e.updated_at,
        COUNT(r.id) AS registrant_count
      FROM events e
      LEFT JOIN registrations r ON r.event_id = e.id
      ${where}
      GROUP BY e.id
      ORDER BY e.start_date ASC
      LIMIT $${idx} OFFSET $${idx + 1}
      `,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: rows.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasNextPage: offset + Number(limit) < total,
      },
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 📘 GET SINGLE EVENT                                                       */
/* -------------------------------------------------------------------------- */

export const getEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const event = await prisma.event.findUnique({
      where: { id },
      include: { customFields: { orderBy: { sortOrder: "asc" } } },
    });
    if (!event) throw new AppError("Event not found", 404);
    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* 🏗️ CREATE EVENT (with optional customFields[])                            */
/* -------------------------------------------------------------------------- */

export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admins only" });
    }

    const {
      title,
      description,
      location,
      startDate,
      endDate,
      start_date,
      end_date,
      capacity,
      ageMin,
      ageMax,
      categoryId,
      managerId,
      registrationMode = "individual",
      teamMemberSlots = 1,
      customFields = [],
    } = req.body;

    const finalStartDate = startDate || start_date;
    const finalEndDate = endDate || end_date;
    if (!title || !location || !finalStartDate || !finalEndDate || !categoryId)
      throw new AppError("Missing required fields (title, location, startDate, endDate, categoryId)", 400);

    const photoPath = saveEventPhoto(req.file);
    const actor = (req as any).user;

    const event = await prisma.$transaction(async (tx) => {
      const newEvent = await tx.event.create({
        data: {
          title,
          description,
          location,
          startDate: new Date(finalStartDate),
          endDate: new Date(finalEndDate),
          capacity: capacity ? Number(capacity) : null,
          ageMin: ageMin ? Number(ageMin) : null,
          ageMax: ageMax ? Number(ageMax) : null,
          categoryId,
          managerId: managerId || null,
          registrationMode,
          teamMemberSlots: Number(teamMemberSlots),
          photoPath,
          isActive: true,
        },
      });

      // create custom fields if provided
      if (Array.isArray(customFields) && customFields.length) {
        await tx.customField.createMany({
          data: customFields.map((f: any, i: number) => ({
            eventId: newEvent.id,
            name: f.name,
            type: f.type,
            required: !!f.required,
            predefined: !!f.predefined,
            options: f.options ?? null,
            sortOrder: f.sortOrder ?? i,
          })),
        });
      }

      // audit log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "CREATE",
          targetType: "EVENT",
          targetId: newEvent.id,
          metadata: { title },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });

      return newEvent;
    });

    const fullEvent = await prisma.event.findUnique({
      where: { id: event.id },
      include: { customFields: { orderBy: { sortOrder: "asc" } } },
    });

    logger.info(`✅ Created new event: ${title} by ${actor?.email}`);
    res.status(201).json({ success: true, data: fullEvent });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* ✏️ UPDATE EVENT (merge-style customFields)                                 */
/* -------------------------------------------------------------------------- */

export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const {
      customFields = [],
      ...updates
    } = req.body;

    const allowed = [
      "title",
      "description",
      "location",
      "startDate",
      "endDate",
      "capacity",
      "ageMin",
      "ageMax",
      "isActive",
      "managerId",
      "categoryId",
      "registrationMode",
      "teamMemberSlots",
    ];

    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      sets.push(`${column} = $${idx++}`);
      vals.push((updates as any)[key]);
    }

    const newPhotoPath = saveEventPhoto(req.file);
    if (newPhotoPath) {
      sets.push(`photo_path = $${idx++}`);
      vals.push(newPhotoPath);
    }

    vals.push(id);
    const actor = (req as any).user;

    const updatedEvent = await prisma.$transaction(async (tx) => {
      // update event core data
      await query(`UPDATE events SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx}`, vals);

      // merge-style custom fields
      if (Array.isArray(customFields) && customFields.length) {
        for (const field of customFields) {
          if (field.id) {
            await tx.customField.update({
              where: { id: field.id },
              data: {
                name: field.name,
                type: field.type,
                required: !!field.required,
                predefined: !!field.predefined,
                options: field.options ?? null,
                sortOrder: field.sortOrder ?? 0,
              },
            });
          } else {
            await tx.customField.create({
              data: {
                eventId: id,
                name: field.name,
                type: field.type,
                required: !!field.required,
                predefined: !!field.predefined,
                options: field.options ?? null,
                sortOrder: field.sortOrder ?? 0,
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "UPDATE",
          targetType: "EVENT",
          targetId: id,
          metadata: { updatedFields: Object.keys(updates) },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });

      return tx.event.findUnique({
        where: { id },
        include: { customFields: { orderBy: { sortOrder: "asc" } } },
      });
    });

    logger.info(`✏️ Updated event ${id} by ${actor?.email}`);
    res.json({ success: true, message: "Event updated", data: updatedEvent });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /events/:id
 * Automatically removes event photo file (if exists)
 */
export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;

    // ✅ Fetch event info first
    const existing = await query(
      `SELECT title, photo_path FROM events WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) throw new AppError("Event not found", 404);

    const { title, photo_path: photoPath } = existing.rows[0];

    // 🧹 Try deleting photo from disk if exists
    if (photoPath) {
      const absolutePath = path.join(process.cwd(), photoPath);
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath);
          logger.info(`🧹 Deleted photo file for event ${id}`);
        } catch (fileErr) {
          logger.warn(`⚠️ Failed to delete event photo: ${absolutePath}`, fileErr);
        }
      }
    }

    // 🗑️ Delete event itself
    await query(`DELETE FROM events WHERE id = $1`, [id]);

    // 🧾 Audit Log
    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE",
          targetType: "EVENT",
          targetId: id,
          metadata: { title },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    logger.info(`🗑️ Deleted event ${id} (${title}) by ${actor?.email || "unknown"}`);
    res.json({ success: true, message: "Event and photo deleted successfully" });
  } catch (error) {
    next(error);
  }
};


/* -------------------------------------------------------------------------- */
/* 🧩 CUSTOM FIELD ENDPOINTS (for completeness)                              */
/* -------------------------------------------------------------------------- */

export const listCustomFieldsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { customFields: { orderBy: { sortOrder: "asc" } } },
    });
    if (!event) throw new AppError("Event not found", 404);
    res.json({ success: true, data: event.customFields });
  } catch (err) {
    next(err);
  }
};

export const createCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const { name, type, required = false, predefined = false, options, sortOrder = 0 } = req.body;
    if (!name || !type) throw new AppError("Missing required fields: name, type", 400);

    const newField = await prisma.customField.create({
      data: { eventId, name, type, required, predefined, options, sortOrder: Number(sortOrder) || 0 },
    });

    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "CREATE",
          targetType: "CUSTOM_FIELD",
          targetId: newField.id,
          metadata: { eventId, name, type },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    res.status(201).json({ success: true, data: newField });
  } catch (err) {
    next(err);
  }
};

export const updateCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, fieldId } = req.params;
    const patch = req.body;

    const existing = await prisma.customField.findFirst({ where: { id: fieldId, eventId } });
    if (!existing) throw new AppError("Custom field not found", 404);

    const updated = await prisma.customField.update({
      where: { id: fieldId },
      data: {
        name: patch.name ?? existing.name,
        type: patch.type ?? existing.type,
        required: patch.required ?? existing.required,
        predefined: patch.predefined ?? existing.predefined,
        options: patch.options ?? existing.options,
        sortOrder: patch.sortOrder ?? existing.sortOrder,
      },
    });

    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "UPDATE",
          targetType: "CUSTOM_FIELD",
          targetId: updated.id,
          metadata: { eventId, updated },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    res.json({ success: true, message: "Custom field updated", data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, fieldId } = req.params;
    const existing = await prisma.customField.findFirst({ where: { id: fieldId, eventId } });
    if (!existing) throw new AppError("Custom field not found", 404);

    await prisma.customField.delete({ where: { id: fieldId } });

    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE",
          targetType: "CUSTOM_FIELD",
          targetId: fieldId,
          metadata: { eventId, name: existing.name },
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
