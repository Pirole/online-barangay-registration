import { Router } from 'express';
import * as usersController from '../controllers/users';
import { CreateUserSchema, UpdateUserSchema, validateRequest } from '../utils/validation';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// List users (admin only)
router.get('/', authenticateToken, authorize('SUPER_ADMIN'), usersController.listUsers);

// Create user (admin)
router.post('/', authenticateToken, authorize('SUPER_ADMIN'), validateRequest(CreateUserSchema), usersController.createUser);

// Get single user (admin or self)
router.get('/:id', authenticateToken, usersController.getUser);

// Update user (admin or self)
router.patch('/:id', authenticateToken, validateRequest(UpdateUserSchema), usersController.updateUser);

// Delete user (admin)
router.delete('/:id', authenticateToken, authorize('SUPER_ADMIN'), usersController.deleteUser);

export default router;
