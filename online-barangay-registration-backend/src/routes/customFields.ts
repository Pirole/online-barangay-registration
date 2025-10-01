import { Router } from 'express';
import * as cfController from '../controllers/customFields';
import { validateRequest } from '../utils/validation';
import { authenticateToken, authorize } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Create custom field for an event (event manager or super admin)
const createSchema = z.object({
  body: z.object({
    eventId: z.string().uuid(),
    name: z.string().min(1),
    type: z.string(),
    required: z.boolean().optional(),
    predefined: z.boolean().optional(),
  }),
});

router.post('/', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), validateRequest(createSchema), cfController.createCustomField);

// List fields for an event
router.get('/event/:eventId', authenticateToken, cfController.listCustomFieldsForEvent);

// Update field
router.patch('/:id', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), cfController.updateCustomField);

// Delete field
router.delete('/:id', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), cfController.deleteCustomField);

export default router;
