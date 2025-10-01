import { Router } from 'express';
import { validateRequest } from '../utils/validation';
import * as teamsController from '../controllers/teams';
import { authenticateToken, authorize } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const createTeamSchema = z.object({
  body: z.object({
    eventId: z.string().uuid(),
    name: z.string().min(1),
    leaderProfileId: z.string().uuid().optional(),
    members: z.array(z.object({ profileId: z.string().uuid() })).optional(),
  }),
});

router.post('/', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), validateRequest(createTeamSchema), teamsController.createTeam);

// List teams for event
router.get('/event/:eventId', authenticateToken, teamsController.listTeamsForEvent);

// Add team member
router.post('/:teamId/members', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), teamsController.addTeamMember);

// Remove team member
router.delete('/:teamId/members/:memberId', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), teamsController.removeTeamMember);

export default router;
