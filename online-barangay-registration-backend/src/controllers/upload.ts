import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import path from 'path';
import fs from 'fs';

export const uploadPhoto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(req as any).file) throw new AppError('No file uploaded', 400);
    const file = (req as any).file;
    // Optionally store metadata in a temp_photos table or return a temp id
    const tempId = file.filename;
    // If you have a temp_photos table, insert record. For now return filepath and filename
    res.status(201).json({ success: true, data: { tempId, filename: file.filename, path: file.path } });
  } catch (error) {
    next(error);
  }
};

export const uploadMultiplePhotos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(req as any).files || (req as any).files.length === 0) throw new AppError('No files uploaded', 400);
    const files = (req as any).files;
    const data = files.map((f: any) => ({ filename: f.filename, path: f.path, size: f.size, mimetype: f.mimetype }));
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
