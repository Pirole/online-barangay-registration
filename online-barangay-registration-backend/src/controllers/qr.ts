import { Request, Response, NextFunction } from 'express';
import qrcode from 'qrcode';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const generateCodeValue = () => crypto.randomUUID();

export const generateQr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationId } = req.body;
    if (!registrationId) throw new AppError('registrationId required', 400);

    // create code value
    const codeValue = generateCodeValue();
    const expiresAt = new Date();
    // keep for 30 days or adjust per event - for now one month
    expiresAt.setDate(expiresAt.getDate() + 30);

    const payload = { registrationId, codeValue, iat: Date.now() };
    // Generate QR image as data URL
    const dataUrl = await qrcode.toDataURL(JSON.stringify(payload));

    // store image to uploads/qr-<uuid>.png (strip prefix)
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const filename = `qr-${codeValue}.png`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'qr');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));

    const insert = await query(
      `INSERT INTO qr_codes (registration_id, code_value, image_path, expires_at, created_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING id, code_value`,
      [registrationId, codeValue, filepath, expiresAt]
    );

    res.json({ success: true, data: { id: insert.rows[0].id, codeValue, imagePath: filepath } });
  } catch (error) {
    next(error);
  }
};

export const scanQr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrValue } = req.body;
    if (!qrValue) throw new AppError('qrValue required', 400);

    const r = await query(`SELECT * FROM qr_codes WHERE code_value = $1`, [qrValue]);
    if (r.rows.length === 0) throw new AppError('QR not recognized', 404);
    const qr = r.rows[0];
    if (new Date(qr.expires_at) < new Date()) throw new AppError('QR expired', 400);

    // load registration info
    const reg = await query(`SELECT r.*, p.first_name, p.last_name FROM registrations r LEFT JOIN profiles p ON r.profile_id = p.id WHERE r.id = $1`, [qr.registration_id]);
    if (reg.rows.length === 0) throw new AppError('Registration for QR not found', 404);

    // mark scanned / create attendance log if you have such table (not present in schema). For now return registrant info
    res.json({ success: true, data: { registration: reg.rows[0], qr } });
  } catch (error) {
    next(error);
  }
};

export const downloadQrImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const r = await query(`SELECT image_path FROM qr_codes WHERE id = $1`, [id]);
    if (r.rows.length === 0) throw new AppError('QR not found', 404);
    const p = r.rows[0].image_path as string;
    if (!fs.existsSync(p)) throw new AppError('QR image not found', 404);
    res.download(p);
  } catch (error) {
    next(error);
  }
};
