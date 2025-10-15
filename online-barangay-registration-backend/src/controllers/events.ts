// src/controllers/events.ts
import { Request, Response, NextFunction } from "express";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";

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

    // Get total count
    const totalRes = await query(`SELECT COUNT(*) AS count FROM events e ${where}`, params);
    const total = Number(totalRes.rows[0].count);

    // Get events with registrant counts
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
 */
export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, location, startDate, endDate, capacity, ageMin, ageMax, categoryId, managerId } = req.body;
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
      RETURNING id
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

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /events/:id
 */
export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const allowed: string[] = [
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

    if (sets.length === 0) {
      return res.json({ success: true, message: "No changes" });
    }

    vals.push(id);

    await query(
      `UPDATE events SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
      vals
    );

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
    await query(`DELETE FROM events WHERE id = $1`, [id]);
    res.json({ success: true, message: "Event deleted" });
  } catch (error) {
    next(error);
  }
};
