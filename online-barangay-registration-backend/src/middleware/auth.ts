
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from './errorHandler';

interface JwtPayload {
  userId: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        roleId: string;
        profile?: any;
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return next(new AppError('Access token required', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    
    // Get user details from database
    const userResult = await query(`
      SELECT u.id, u.email, u.role_id, u.is_active, r.name as role_name,
             p.first_name, p.last_name, p.barangay
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1 AND u.is_active = true
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return next(new AppError('Invalid token - user not found or inactive', 401));
    }

    const user = userResult.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role_name,
      roleId: user.role_id,
      profile: {
        firstName: user.first_name,
        lastName: user.last_name,
        barangay: user.barangay,
      },
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401));
    }
    logger.error('Authentication error:', error);
    next(new AppError('Authentication failed', 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by ${req.user.email} to ${req.originalUrl}`, {
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl,
        method: req.method,
      });
      
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      
      const userResult = await query(`
        SELECT u.id, u.email, u.role_id, u.is_active, r.name as role_name,
               p.first_name, p.last_name, p.barangay
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = $1 AND u.is_active = true
      `, [decoded.userId]);

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role_name,
          roleId: user.role_id,
          profile: {
            firstName: user.first_name,
            lastName: user.last_name,
            barangay: user.barangay,
          },
        };
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    next();
  }
};