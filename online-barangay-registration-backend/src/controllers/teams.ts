import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, name, leaderProfileId, members } = req.body;
    const insert = await query(`INSERT INTO teams (event_id, name, created_at) VALUES ($1,$2,NOW()) RETURNING id`, [eventId, name]);
    const teamId = insert.rows[0].id;
    if (leaderProfileId) {
      await query(`INSERT INTO team_members (team_id, profile_id) VALUES ($1,$2)`, [teamId, leaderProfileId]);
    }
    if (Array.isArray(members)) {
      for (const m of members) {
        await query(`INSERT INTO team_members (team_id, profile_id) VALUES ($1,$2)`, [teamId, m.profileId]);
      }
    }
    res.status(201).json({ success: true, data: { id: teamId } });
  } catch (error) {
    next(error);
  }
};

export const listTeamsForEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId;
    const rows = await query(`SELECT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count FROM teams t WHERE t.event_id = $1`, [eventId]);
    res.json({ success: true, data: rows.rows });
  } catch (error) {
    next(error);
  }
};

export const addTeamMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.params.teamId;
    const { profileId } = req.body;
    await query(`INSERT INTO team_members (team_id, profile_id) VALUES ($1,$2)`, [teamId, profileId]);
    res.json({ success: true, message: 'Member added' });
  } catch (error) {
    next(error);
  }
};

export const removeTeamMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, memberId } = req.params;
    await query(`DELETE FROM team_members WHERE id = $1 AND team_id = $2`, [memberId, teamId]);
    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    next(error);
  }
};
