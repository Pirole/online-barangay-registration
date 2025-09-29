import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const dashboardSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await query(`SELECT COUNT(*) as total FROM events`);
    const registrations = await query(`SELECT COUNT(*) as total FROM registrations`);
    res.json({ success: true, data: { totalEvents: Number(events.rows[0].total), totalRegistrations: Number(registrations.rows[0].total) } });
  } catch (error) {
    next(error);
  }
};

export const listAllEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(`SELECT * FROM events ORDER BY start_date DESC`);
    res.json({ success: true, data: rows.rows });
  } catch (error) {
    next(error);
  }
};

export const assignEventManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, userId } = req.params;
    // check event exists
    await query(`UPDATE events SET manager_id = $1, updated_at = NOW() WHERE id = $2`, [userId, eventId]);
    res.json({ success: true, message: 'Manager assigned' });
  } catch (error) {
    next(error);
  }
};

export const purgeData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Safety: require confirm=YES body
    const { confirm } = req.body;
    if (confirm !== 'YES') throw new AppError('Provide confirm=YES to purge', 400);

    await query('DELETE FROM otp_requests');
    await query('DELETE FROM qr_codes');
    await query('DELETE FROM registrations');
    await query('DELETE FROM teams');
    await query('DELETE FROM team_members');
    // don't delete users/events in this purge
    res.json({ success: true, message: 'Purge completed' });
  } catch (error) {
    next(error);
  }
};
