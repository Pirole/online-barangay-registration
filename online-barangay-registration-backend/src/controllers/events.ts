// src/controllers/events.ts
import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import prisma from "../config/prisma"; // ✅ for audit logging only

/**
 * Helper: Save uploaded event photo
 */
const saveEventPhoto = (file?: Express.Multer.File): string | null => {
  if (!file) return null;

  const uploadsDir = path.join(process.cwd(), "uploads", "events");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, file.buffer);
  return `/uploads/events/${fileName}`;
};

/**
 * GET /events
 * Returns list of events with registrant counts + optional filtering
 */
export const listEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status = "upcoming", search, page = 1, limit = 20, managerId } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    const whereClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (search) {
      whereClauses.push(`(e.title ILIKE $${idx} OR e.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (managerId) {
      whereClauses.push(`e.manager_id = $${idx}`);
      params.push(managerId);
      idx++;
    }

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
 */
export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    // Accept both camelCase and snake_case from frontend
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
    } = req.body;

    // Normalize to the correct variable names for SQL
    const finalStartDate = startDate || start_date;
    const finalEndDate = endDate || end_date;

    if (!title || !location || !finalStartDate || !finalEndDate || !categoryId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields (title, location, startDate, endDate, categoryId)",
      });
    }

    const photoPath = saveEventPhoto(req.file);

    const result = await query(
      `
      INSERT INTO events (
        id, title, description, location, start_date, end_date,
        capacity, age_min, age_max, category_id, manager_id,
        photo_path, is_active, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, true, NOW(), NOW()
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
      ]
    );

    const newEventId = result.rows[0].id;

    // ✅ Audit Log
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
    return next(error);
  }
};

/**
 * PUT /events/:id
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

    // ✅ Handle photo upload (if provided)
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

    await query(
      `UPDATE events SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
      vals
    );

    // ✅ Audit Log
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

    // ✅ Audit Log
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
