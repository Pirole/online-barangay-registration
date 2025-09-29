import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// Helpers
const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateAccessToken = (payload: object) => {
  const secret = process.env.JWT_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN as string) || '15m',
  };
  return jwt.sign(payload, secret, options);
};

const generateRefreshToken = (payload: object) => {
  const secret = process.env.JWT_REFRESH_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  };
  return jwt.sign(payload, secret, options);
};

// =============================
// REGISTER (EVENT REGISTRATION)
// =============================
export async function register(req: Request, res: Response) {
  try {
    const {
      eventId,
      firstName,
      lastName,
      age,
      address,
      barangay,
      phone,
      photoTempId,
    } = req.body;

    // Check if profile already exists for this phone
    let profile = await prisma.profile.findUnique({
      where: { contact: phone },
    });

    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          firstName,
          lastName,
          age,
          address,
          barangay,
          contact: phone,
        },
      });
    }

    // Create the registration
    const registration = await prisma.registration.create({
      data: {
        eventId,
        profileId: profile.id,
        photoPath: photoTempId ? `/uploads/${photoTempId}` : null,
      },
      include: {
        event: true,
        profile: true,
      },
    });

    logger.info(`✅ Registration created for ${profile.firstName} ${profile.lastName}`);
    return res.status(201).json({ message: 'Registration successful', registration });
  } catch (error) {
    logger.error('❌ Registration failed', error);
    return res.status(500).json({ error: 'Registration failed', details: error });
  }
}

// =============================
// LOGIN (ACCOUNT-BASED)
// =============================
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) throw new AppError('Invalid credentials', 401);
    if (!user.isActive) throw new AppError('Account inactive', 403);

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new AppError('Invalid credentials', 401);

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const hashed = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.upsert({
      where: { userId: user.id },
      update: { token: hashed, expiresAt, createdAt: new Date() },
      create: { userId: user.id, token: hashed, expiresAt },
    });

    res.json({
      success: true,
      data: { accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
};

// =============================
// REFRESH TOKEN
// =============================
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, message: 'Refresh token endpoint placeholder' });
  } catch (error) {
    next(error);
  }
};

// =============================
// LOGOUT
// =============================
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Prisma delete refresh token logic here
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// =============================
// ME (PROFILE)
// =============================
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id, email, role } = req.user;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    return res.json({
      id,
      email,
      role,
      firstName: user?.profile?.firstName || null,
      lastName: user?.profile?.lastName || null,
      phone: user?.profile?.contact || null,
    });
  } catch (err) {
    return next(err);
  }
};
