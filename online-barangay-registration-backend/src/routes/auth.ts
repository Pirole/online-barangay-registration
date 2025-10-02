import { Router } from 'express';
import * as authController from '../controllers/auth';
import { LoginSchema, RegisterSchema, validateRequest } from '../utils/validation';
import { optionalAuth, authenticateToken } from '../middleware/auth';

const router = Router();

// Register (create account)
router.post('/register', validateRequest(RegisterSchema), authController.register);

// Register Admin (create admin account) - Standalone route without validation for simplicity
router.post("/register-admin", authController.registerAdmin);

// Login
router.post('/login', validateRequest(LoginSchema), authController.login);

// Refresh token
router.post('/refresh-token', authController.refreshToken);

// Logout
router.post('/logout', authenticateToken, authController.logout);

// Who am I / profile
router.get('/me', optionalAuth, authController.me);

export default router;
