// src/controllers/events.ts
import { Request, Response, NextFunction } from "express";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import path from "path";
import fs from "fs";

/**
 * Utility: Ensure /uploads/events exists
 */
const eventUploadDir = path.join(__dirname, "..", "uploads", "events");
if (!fs.existsSync(eventUploadDir)) {
  fs.mkdirSync(eventUploadDir, { recursive: true });
}

/**
 * Utility: Build image path
 */
const buildEventImagePath = (file?: Express.Multer.File) => {
  if (!file) return null;
  return `/uploads/events/${file.filename}`;
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

    // Optional search filter
    if (search) {
      whereClauses.push(`(e.title ILIKE $${idx} OR e.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    // Optional manager filter
    if (managerId) {
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

    // Total count
    const totalRes = await query(`SELECT COUNT(*) AS count FROM events e ${where}`, params);
    const total = Number(totalRes.rows[0].count);

    // Get events + registrant counts
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
 * (Super Admin only)
 */
export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title,
      description,
      location,
      startDate,
      endDate,
      capacity,
      ageMin,
      ageMax,
      categoryId,
      managerId,
    } = req.body;

    // Handle optional file upload
    const photoPath = req.file ? buildEventImagePath(req.file) : null;

    // Validate managerId
    if (managerId) {
      const managerCheck = await query(
        `SELECT id, role FROM users WHERE id = $1 AND role = 'EVENT_MANAGER'`,
        [managerId]
      );
      if (managerCheck.rowCount === 0) {
        throw new AppError("Invalid manager ID. Must be an EVENT_MANAGER.", 400);
      }
    }

    // Insert event
    const result = await query(
      `
      INSERT INTO events (
        id, title, description, location, start_date, end_date,
        capacity, age_min, age_max, category_id, manager_id,
        is_active, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        true, NOW(), NOW()
      )
      RETURNING id, title
      `,
      [
        title,
        description || null,
        location,
        startDate,
        endDate,
        capacity || null,
        ageMin || null,
        ageMax || null,
        categoryId,
        managerId || null,
      ]
    );

    const eventId = result.rows[0].id;

    // Audit log
    await query(
      `
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata, ip_address, user_agent, created_at)
      VALUES (gen_random_uuid(), $1, 'CREATE', 'Event', $2, $3, $4, $5, NOW())
      `,
      [
        req.user?.id || null,
        eventId,
        JSON.stringify({ title, managerId, photoPath }),
        req.ip,
        req.get("user-agent") || "unknown",
      ]
    );

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: { id: eventId },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /events/:id
 * (Super Admin only)
 */
export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;

    // Check if event exists
    const existing = await query(`SELECT * FROM events WHERE id = $1`, [id]);
    if (existing.rowCount === 0) throw new AppError("Event not found", 404);

    const {
      title,
      description,
      location,
      startDate,
      endDate,
      capacity,
      ageMin,
      ageMax,
      isActive,
      managerId,
    } = req.body;

    const photoPath = req.file ? buildEventImagePath(req.file) : undefined;

    // Validate managerId if present
    if (managerId) {
      const managerCheck = await query(
        `SELECT id, role FROM users WHERE id = $1 AND role = 'EVENT_MANAGER'`,
        [managerId]
      );
      if (managerCheck.rowCount === 0) {
        throw new AppError("Invalid manager ID. Must be an EVENT_MANAGER.", 400);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const pushUpdate = (col: string, val: any) => {
      updates.push(`${col} = $${idx++}`);
      values.push(val);
    };

    if (title) pushUpdate("title", title);
    if (description) pushUpdate("description", description);
    if (location) pushUpdate("location", location);
    if (startDate) pushUpdate("start_date", startDate);
    if (endDate) pushUpdate("end_date", endDate);
    if (capacity) pushUpdate("capacity", capacity);
    if (ageMin) pushUpdate("age_min", ageMin);
    if (ageMax) pushUpdate("age_max", ageMax);
    if (isActive !== undefined) pushUpdate("is_active", isActive);
    if (managerId) pushUpdate("manager_id", managerId);
    if (photoPath) pushUpdate("photo_path", photoPath);

    if (updates.length === 0)
      return res.json({ success: true, message: "No changes" });

    values.push(id);
    await query(
      `UPDATE events SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
      values
    );

    await query(
      `
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata, ip_address, user_agent, created_at)
      VALUES (gen_random_uuid(), $1, 'UPDATE', 'Event', $2, $3, $4, $5, NOW())
      `,
      [
        req.user?.id || null,
        id,
        JSON.stringify({ title, managerId }),
        req.ip,
        req.get("user-agent") || "unknown",
      ]
    );

    res.json({ success: true, message: "Event updated successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /events/:id
 * (Super Admin only)
 */
export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;

    const existing = await query(`SELECT title FROM events WHERE id = $1`, [id]);
    if (existing.rowCount === 0) throw new AppError("Event not found", 404);

    await query(`DELETE FROM events WHERE id = $1`, [id]);

    await query(
      `
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata, ip_address, user_agent, created_at)
      VALUES (gen_random_uuid(), $1, 'DELETE', 'Event', $2, $3, $4, $5, NOW())
      `,
      [
        req.user?.id || null,
        id,
        JSON.stringify({ title: existing.rows[0].title }),
        req.ip,
        req.get("user-agent") || "unknown",
      ]
    );

    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    next(error);
  }
};
