import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// Helpers
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const generateAccessToken = (payload: object) => {
  const secret = process.env.JWT_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) || '15m',
  };
  return jwt.sign(payload, secret, options);
};

const generateRefreshToken = (payload: object) => {
  const secret = process.env.JWT_REFRESH_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn']) || '7d',
  };
  return jwt.sign(payload, secret, options);
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone, barangay } = req.body;

    // check existing
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // insert user
    const insertUser = await query(
      `INSERT INTO users (email, phone, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW()) RETURNING id, email, role`,
      [email, phone || null, passwordHash, 'RESIDENT']
    );

    const user = insertUser.rows[0];

    // insert profile
    await query(
      `INSERT INTO profiles (user_id, first_name, last_name, barangay, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [user.id, firstName, lastName, barangay || null]
    );

    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      data: { id: user.id, email: user.email },
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // logic: validate refresh token, issue new access token
    res.json({ success: true, message: 'Refresh token endpoint placeholder' });
  } catch (error) {
    next(error);
  }
};

// Logout
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // logic: remove refresh token from DB
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// Me (profile)
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: req.user });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      `SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = result.rows[0];

    if (!user.is_active) throw new AppError('Account inactive', 403);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new AppError('Invalid credentials', 401);

    const payload = { userId: user.id, email: user.email, role: user.role };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // store hashed refresh token
    const hashed = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [user.id, hashed, expiresAt]
    );

    res.json({
      success: true,
      data: { accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
};

