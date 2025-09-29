import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const listEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic filtering: status, search, managerId, pagination
    const { status = 'upcoming', search, page = 1, limit = 20, managerId } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (search) {
      whereClauses.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (managerId) {
      whereClauses.push(`manager_id = $${idx}`);
      params.push(managerId);
      idx++;
    }

    const now = new Date();
    if (status === 'upcoming') {
      whereClauses.push(`start_date > NOW()`);
    } else if (status === 'ongoing') {
      whereClauses.push(`start_date <= NOW() AND end_date >= NOW()`);
    } else if (status === 'completed') {
      whereClauses.push(`end_date < NOW()`);
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalRes = await query(`SELECT COUNT(*) as count FROM events ${where}`, params);
    const total = Number(totalRes.rows[0].count);

    const rows = await query(
      `SELECT id, title, description, location, start_date, end_date, capacity, age_min, age_max, is_active, created_at, updated_at
       FROM events ${where} ORDER BY start_date ASC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: rows.rows,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)), hasNextPage: offset + Number(limit) < total },
    });
  } catch (error) {
    next(error);
  }
};

export const getEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const result = await query(`SELECT * FROM events WHERE id = $1`, [id]);
    if (result.rows.length === 0) throw new AppError('Event not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, location, startDate, endDate, capacity, ageMin, ageMax, categoryId, managerId } = req.body;
    const result = await query(
      `INSERT INTO events (title, description, location, start_date, end_date, capacity, age_min, age_max, category_id, manager_id, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,NOW(),NOW()) RETURNING id`,
      [title, description || null, location, startDate, endDate, capacity || null, ageMin || null, ageMax || null, categoryId || null, managerId || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const allowed: string[] = ['title','description','location','startDate','endDate','capacity','ageMin','ageMax','isActive','managerId'];
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const key of Object.keys(req.body)) {
      if (!allowed.includes(key)) continue;
      const column = key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
      sets.push(`${column} = $${idx++}`);
      vals.push((req.body as any)[key]);
    }
    if (sets.length === 0) return res.json({ success: true, message: 'No changes' });
    vals.push(id);
    await query(`UPDATE events SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, vals);
    res.json({ success: true, message: 'Event updated' });
  } catch (error) {
    next(error);
  }
};

export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    await query(`DELETE FROM events WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    next(error);
  }
};
