// src/controllers/events.ts
import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import prisma from "../config/prisma"; // Prisma client for audit logs and custom fields

/**
 * Helper: Save uploaded event photo (disk-safe version)
 */
const saveEventPhoto = (file?: Express.Multer.File): string | null => {
  if (!file) return null;

  const uploadsDir = path.join(process.cwd(), "uploads", "events");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // If multer already saved the file, just move or rename it
  if ((file as any).path && !(file as any).buffer) {
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    const destPath = path.join(uploadsDir, fileName);
    fs.renameSync((file as any).path, destPath);
    return `/uploads/events/${fileName}`;
  }

  // Otherwise, write from buffer (for memoryStorage)
  if ((file as any).buffer) {
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    const destPath = path.join(uploadsDir, fileName);
    fs.writeFileSync(destPath, (file as any).buffer);
    return `/uploads/events/${fileName}`;
  }

  return null;
};

/**
 * GET /events
 * Returns list of events with registrant counts + optional filtering
 */
export const listEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status = "upcoming", search, page = 1, limit = 20, managerId } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    const user = (req as any).user; // from JWT middleware
    const whereClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    // Optional search filter
    if (search) {
      whereClauses.push(`(e.title ILIKE $${idx} OR e.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    // Role-based scoping
    if (user?.role === "EVENT_MANAGER") {
      whereClauses.push(`e.manager_id = $${idx}`);
      params.push(user.id);
      idx++;
    } else if (managerId && user?.role === "SUPER_ADMIN") {
      whereClauses.push(`e.manager_id = $${idx}`);
      params.push(managerId);
      idx++;
    }

    // Status filter
    if (status === "upcoming") {
      whereClauses.push(`e.start_date > NOW()`);
    } else if (status === "ongoing") {
      whereClauses.push(`e.start_date <= NOW() AND e.end_date >= NOW()`);
    } else if (status === "completed") {
      whereClauses.push(`e.end_date < NOW()`);
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const totalRes = await query(`SELECT COUNT(*) AS count FROM events e ${where}`, params);
    const total = Number(totalRes.rows[0].count);

    const rows = await query(
      `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.location,
        e.start_date,
        e.end_date,
        e.capacity,
        e.age_min,
        e.age_max,
        e.is_active,
        e.manager_id,
        e.category_id,
        e.photo_path,
        e.registration_mode,
        e.team_member_slots,
        e.created_at,
        e.updated_at,
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
  } catch (error) {
    next(error);
  }
};

/**
 * GET /events/:id
 */
export const getEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const result = await query(`SELECT * FROM events WHERE id = $1`, [id]);
    if (result.rows.length === 0) throw new AppError("Event not found", 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /events
 * Note: only SUPER_ADMIN allowed (controller enforces)
 */
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
    } = req.body;

    const finalStartDate = startDate || start_date;
    const finalEndDate = endDate || end_date;

    if (!title || !location || !finalStartDate || !finalEndDate || !categoryId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (title, location, startDate, endDate, categoryId)",
      });
    }

    const photoPath = saveEventPhoto(req.file);

    const result = await query(
      `
      INSERT INTO events (
        id, title, description, location, start_date, end_date,
        capacity, age_min, age_max, category_id, manager_id,
        photo_path, registration_mode, team_member_slots,
        is_active, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        true, NOW(), NOW()
      )
      RETURNING id
      `,
      [
        title,
        description || null,
        location,
        finalStartDate,
        finalEndDate,
        capacity || null,
        ageMin || null,
        ageMax || null,
        categoryId,
        managerId || null,
        photoPath,
        registrationMode,
        teamMemberSlots,
      ]
    );

    const newEventId = result.rows[0].id;
    const actor = (req as any).user;

    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "CREATE",
          targetType: "EVENT",
          targetId: newEventId,
          metadata: { title },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    logger.info(`✅ Created new event: ${title} by ${actor?.email || "unknown"}`);
    return res.status(201).json({
      success: true,
      data: { id: newEventId },
      message: "Event created successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /events/:id
 */
export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
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

    for (const key of Object.keys(req.body)) {
      if (!allowed.includes(key)) continue;
      const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      sets.push(`${column} = $${idx++}`);
      vals.push((req.body as any)[key]);
    }

    const newPhotoPath = saveEventPhoto(req.file);
    if (newPhotoPath) {
      sets.push(`photo_path = $${idx++}`);
      vals.push(newPhotoPath);
    }

    if (sets.length === 0) {
      res.json({ success: true, message: "No changes" });
      return;
    }

    vals.push(id);
    await query(`UPDATE events SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx}`, vals);

    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "UPDATE",
          targetType: "EVENT",
          targetId: id,
          metadata: { updatedFields: sets },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    logger.info(`✏️ Updated event ${id} by ${actor?.email || "unknown"}`);
    res.json({ success: true, message: "Event updated" });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /events/:id
 */
export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const existing = await query(`SELECT title FROM events WHERE id = $1`, [id]);
    if (existing.rows.length === 0) throw new AppError("Event not found", 404);

    await query(`DELETE FROM events WHERE id = $1`, [id]);

    const actor = (req as any).user;
    if (actor) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE",
          targetType: "EVENT",
          targetId: id,
          metadata: { title: existing.rows[0].title },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent") || "",
        },
      });
    }

    logger.info(`🗑️ Deleted event ${id} by ${actor?.email || "unknown"}`);
    res.json({ success: true, message: "Event deleted" });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                          CUSTOM FIELD CONTROLLERS                           */
/* -------------------------------------------------------------------------- */

/**
 * GET /events/:eventId/custom-fields
 * Public (optionalAuth). Returns array of custom fields for the event.
 */
export const listCustomFieldsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;

    // fetch event with its customFields ordered by sortOrder
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { customFields: { orderBy: { sortOrder: "asc" } } },
    });

    if (!event) throw new AppError("Event not found", 404);

    res.json({ success: true, data: event.customFields });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /events/:eventId/custom-fields
 * Only SUPER_ADMIN allowed (extra-safeguard)
 * Body: { name, type, required?, predefined?, options?, sortOrder? }
 */
export const createCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Enforce role at controller-level (defense in depth)
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admins only" });
    }

    const { eventId } = req.params;
    const { name, type, required = false, predefined = false, options, sortOrder = 0 } = req.body;

    if (!name || !type) throw new AppError("Missing required fields: name, type", 400);

    // Ensure event exists
    const ev = await prisma.event.findUnique({ where: { id: eventId } });
    if (!ev) throw new AppError("Event not found", 404);

    const newField = await prisma.customField.create({
      data: {
        eventId,
        name,
        type,
        required: Boolean(required),
        predefined: Boolean(predefined),
        // cast options to any to satisfy types if needed; Prisma accepts Json types
        options: options ? (options as any) : undefined,
        sortOrder: Number(sortOrder) || 0,
      },
    });

    // Audit log
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
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /events/:eventId/custom-fields/:fieldId
 * Only SUPER_ADMIN allowed
 */
export const updateCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admins only" });
    }

    const { eventId, fieldId } = req.params;
    const patch = req.body;

    const existing = await prisma.customField.findFirst({ where: { id: fieldId, eventId } });
    if (!existing) throw new AppError("Custom field not found", 404);

    const updated = await prisma.customField.update({
      where: { id: fieldId },
      data: {
        name: patch.name ?? existing.name,
        type: patch.type ?? existing.type,
        required: patch.required !== undefined ? Boolean(patch.required) : existing.required,
        predefined: patch.predefined !== undefined ? Boolean(patch.predefined) : existing.predefined,
        options: patch.options !== undefined ? (patch.options as any) : existing.options,
        sortOrder: patch.sortOrder !== undefined ? Number(patch.sortOrder) : existing.sortOrder,
      },
    });

    // Audit log
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
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /events/:eventId/custom-fields/:fieldId
 * Only SUPER_ADMIN allowed
 */
export const deleteCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admins only" });
    }

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
  } catch (error) {
    next(error);
  }
};
