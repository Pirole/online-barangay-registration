import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const createCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, name, type, required = false, predefined = false } = req.body;
    const insert = await query(
      `INSERT INTO custom_fields (event_id, name, type, required, predefined, created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id`,
      [eventId, name, type, required, predefined]
    );
    res.status(201).json({ success: true, data: insert.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const listCustomFieldsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId;
    const rows = await query(`SELECT * FROM custom_fields WHERE event_id = $1 ORDER BY created_at`, [eventId]);
    res.json({ success: true, data: rows.rows });
  } catch (error) {
    next(error);
  }
};

export const updateCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { name, type, required } = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); vals.push(name); }
    if (type !== undefined) { fields.push(`type = $${idx++}`); vals.push(type); }
    if (required !== undefined) { fields.push(`required = $${idx++}`); vals.push(required); }
    if (fields.length === 0) return res.json({ success: true, message: 'No change' });
    vals.push(id);
    await query(`UPDATE custom_fields SET ${fields.join(', ')}, created_at = created_at WHERE id = $${idx}`, vals); // preserve created_at
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    await query(`DELETE FROM custom_fields WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};
