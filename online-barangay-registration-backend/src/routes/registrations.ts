import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import * as registrationsController from '../controllers/registrations';
import { RegisterSchema, QueryRegistrantsSchema, ApprovalSchema } from '../utils/validation';
import { authenticateToken, authorize, optionalAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Create registration (public or authenticated). Accept photo upload or temp photo id.
// If using file upload: field name 'photo'
router.post(
  '/',
  upload.single('photo'),
  validateRequest(RegisterSchema),
  registrationsController.createRegistration
);

// Send registration (if multi-step with photo stored earlier)
router.post('/submit', validateRequest(RegisterSchema), registrationsController.submitRegistration);

// Get registrants for an event (protected: event manager & admin & staff read policies)
router.get('/event/:eventId', authenticateToken, validateRequest(QueryRegistrantsSchema), registrationsController.listRegistrantsForEvent);

// Get single registration (protected)
router.get('/:id', authenticateToken, registrationsController.getRegistration);

// Approve/reject registration (event manager or super admin)
router.post('/:id/approval', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), validateRequest(ApprovalSchema), registrationsController.approveOrRejectRegistration);

// Check-in (QR check-in) — internal; QR scanning logic will call this endpoint
router.post('/:id/checkin', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER', 'STAFF'), registrationsController.markCheckin);

export default router;
