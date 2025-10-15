import { Router } from 'express';
import * as eventsController from '../controllers/events';
import * as registrationsController from '../controllers/registrations';
import { CreateEventSchema, UpdateEventSchema, QueryEventsSchema, validateRequest } from '../utils/validation';
import { authenticateToken, authorize, optionalAuth } from '../middleware/auth';

const router = Router();

// Public list (with query support)
router.get('/', validateRequest(QueryEventsSchema), optionalAuth, eventsController.listEvents);

// Public: single event
router.get('/:id', optionalAuth, eventsController.getEvent);

// ✅ New: list registrants for a specific event (admin/event_manager only)
router.get(
  '/:eventId/registrants',
  authenticateToken,
  authorize('SUPER_ADMIN', 'EVENT_MANAGER', 'STAFF'),
  registrationsController.listRegistrantsForEvent
);

// Protected: create event (super_admin or event_manager)
router.post('/', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), validateRequest(CreateEventSchema), eventsController.createEvent);

// Protected: update event
router.patch('/:id', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), validateRequest(UpdateEventSchema), eventsController.updateEvent);

// Protected: delete event
router.delete('/:id', authenticateToken, authorize('SUPER_ADMIN'), eventsController.deleteEvent);

export default router;
