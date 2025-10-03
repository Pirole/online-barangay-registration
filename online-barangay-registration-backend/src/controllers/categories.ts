// controllers/categories.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, description FROM event_categories ORDER BY name ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};
