import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { logger } from "../utils/logger";
import { AppError } from "./errorHandler";

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
        profile?: {
          firstName?: string | null;
          lastName?: string | null;
          barangay?: string | null;
        };
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return next(new AppError("Access token required", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Fetch user via Prisma
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { profile: true },
    });

    if (!user || !user.isActive) {
      return next(new AppError("Invalid token - user not found or inactive", 401));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role, // 👈 comes directly from enum UserRole
      profile: {
        firstName: user.profile?.firstName,
        lastName: user.profile?.lastName,
        barangay: user.profile?.barangay,
      },
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError("Invalid token", 401));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError("Token expired", 401));
    }
    logger.error("Authentication error:", error);
    next(new AppError("Authentication failed", 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by ${req.user.email} to ${req.originalUrl}`, {
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl,
        method: req.method,
      });

      return next(new AppError("Insufficient permissions", 403));
    }

    next();
  };
};

// Optional authentication - doesn’t fail if no token provided
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { profile: true },
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: {
            firstName: user.profile?.firstName,
            lastName: user.profile?.lastName,
            barangay: user.profile?.barangay,
          },
        };
      }
    }

    next();
  } catch (error) {
    // optional auth just ignores errors
    next();
  }
};
