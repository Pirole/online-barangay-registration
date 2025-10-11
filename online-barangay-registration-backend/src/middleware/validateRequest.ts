import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError, ZodIssue, ZodType } from 'zod';
import { AppError } from './errorHandler';

export const validateRequest = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues
          .map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');

        return next(new AppError(message, 400));
      }
      next(error);
    }
  };
};
