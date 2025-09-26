import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, JwtPayload } from '../types/auth';
import { logger } from '../utils/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token is required',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
};

export const authorize = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.',
      });
      return;
    }

    next();
  };
};

// Specific role middleware functions
export const requireSuperAdmin = authorize([UserRole.SUPER_ADMIN]);
export const requireEventManager = authorize([UserRole.SUPER_ADMIN, UserRole.EVENT_MANAGER]);
export const requireStaff = authorize([UserRole.SUPER_ADMIN, UserRole.EVENT_MANAGER, UserRole.STAFF]);
export const requireAuth = authenticate;
