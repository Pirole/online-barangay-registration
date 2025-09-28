import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Extend Error type for cases like Postgres, Multer, JWT
interface ExtendedError extends Error {
  code?: string | number;
  errors?: ZodIssue[];
}

export const errorHandler = (
  err: ExtendedError,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  // Log the error
  logger.error(`Error ${req.method} ${req.originalUrl}`, {
    error: err.message,
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Zod validation error
  if (err instanceof ZodError) {
    const message = err.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message,
      details: err.issues,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid Token',
      message: 'Please provide a valid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token Expired',
      message: 'Your session has expired, please login again',
    });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File Too Large',
      message: 'File size exceeds the maximum allowed limit',
    });
  }

  // Database errors
  if (err.code === '23505') { // unique violation
    return res.status(409).json({
      success: false,
      error: 'Duplicate Entry',
      message: 'A record with this information already exists',
    });
  }

  if (err.code === '23503') { // FK violation
    return res.status(400).json({
      success: false,
      error: 'Invalid Reference',
      message: 'Referenced record does not exist',
    });
  }

  // Application errors
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Fallback
  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
