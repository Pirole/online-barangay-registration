// src/routes/events.ts
import { Router } from 'express';
import * as eventsController from '../controllers/events';
import * as registrationsController from '../controllers/registrations'; // ✅ add this
import { CreateEventSchema, UpdateEventSchema, QueryEventsSchema, validateRequest } from '../utils/validation';
import { authenticateToken, authorize, optionalAuth } from '../middleware/auth';

const router = Router();

// Public list (with query support)
router.get('/', validateRequest(QueryEventsSchema), optionalAuth, eventsController.listEvents);

// Public: single event
router.get('/:id', optionalAuth, eventsController.getEvent);

// ✅ FIX: Add this route so dashboard can load registrants per event
router.get(
  '/:eventId/registrants',
  authenticateToken,
  registrationsController.listRegistrantsForEvent
);

// Protected: create event
router.post('/', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), validateRequest(CreateEventSchema), eventsController.createEvent);

// Protected: update event
router.patch('/:id', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), validateRequest(UpdateEventSchema), eventsController.updateEvent);

// Protected: delete event
router.delete('/:id', authenticateToken, authorize('SUPER_ADMIN'), eventsController.deleteEvent);

export default router;
