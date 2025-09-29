import { Router } from 'express';
import * as adminController from '../controllers/admin';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// Dashboard summary (super admin)
router.get('/summary', authenticateToken, authorize('SUPER_ADMIN'), adminController.dashboardSummary);

// List events for admin dashboard
router.get('/events', authenticateToken, authorize('SUPER_ADMIN'), adminController.listAllEvents);

// Assign event manager
router.post('/events/:eventId/assign-manager/:userId', authenticateToken, authorize('SUPER_ADMIN'), adminController.assignEventManager);

// Purge data (dangerous — super admin only)
router.post('/purge', authenticateToken, authorize('SUPER_ADMIN'), adminController.purgeData);

export default router;
