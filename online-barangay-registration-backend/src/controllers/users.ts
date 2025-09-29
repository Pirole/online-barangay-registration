import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`SELECT id, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role, phone, barangay } = req.body;
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) throw new AppError('Email already exists', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const insert = await query(
      `INSERT INTO users (email, phone, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW()) RETURNING id, email, role`,
      [email, phone || null, passwordHash, role.toUpperCase()]
    );

    const user = insert.rows[0];
    // create profile
    await query(`INSERT INTO profiles (user_id, first_name, last_name, barangay, created_at) VALUES ($1,$2,$3,$4,NOW())`,
      [user.id, name.split(' ')[0] || '', name.split(' ').slice(1).join(' ') || '', barangay || null]);

    res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const result = await query(
      `SELECT u.id,u.email,u.phone,u.role,u.is_active,p.first_name,p.last_name,p.barangay
       FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new AppError('User not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { email, name, role, phone, barangay } = req.body;

    // Update users
    if (email || role || phone) {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (email) { fields.push(`email = $${idx++}`); values.push(email); }
      if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
      if (role) { fields.push(`role = $${idx++}`); values.push(role.toUpperCase()); }
      fields.push(`updated_at = NOW()`);
      await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, [...values, id]);
    }

    // Update profile name/barangay
    if (name || barangay) {
      const firstName = name ? name.split(' ')[0] : undefined;
      const lastName = name ? name.split(' ').slice(1).join(' ') : undefined;
      const profileFields: string[] = [];
      const pvals: any[] = [];
      let pidx = 1;
      if (firstName !== undefined) { profileFields.push(`first_name = $${pidx++}`); pvals.push(firstName); }
