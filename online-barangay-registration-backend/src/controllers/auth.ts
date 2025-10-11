import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
// Helpers
// --------------------------
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateAccessToken = (payload: object): string => {
  const secret = process.env.JWT_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
  };
  return jwt.sign(payload, secret, options);
};

const generateRefreshToken = (payload: object): string => {
  const secret = process.env.JWT_REFRESH_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
  };
  return jwt.sign(payload, secret, options);
};
// REGISTER (Standalone Event)
// --------------------------
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { eventId, firstName, lastName, age, address, barangay, phone, photoTempId, customValues } =
       (req as any).validatedData;  // ✅ Use validatedData

    if (!eventId || !firstName || !lastName) {
      throw new AppError('Missing required registration fields', 400);
    }
    const registrationData = {
      firstName,
      lastName,
      age: age ? Number(age) : null,
      address,
      barangay,
      contact: phone,
      ...(customValues || {})
    };
    // Create registration without profile
    const registration = await prisma.registration.create({
      data: {
        eventId,
        profileId: null, // No profile for standalone registrations
        photoPath: photoTempId ? `/uploads/${photoTempId}` : null,
        customValues: registrationData, // Store all form data as JSON
      },
      include: {
        event: true,
      },
    });
    logger.info(`✅ Registration created for ${firstName} ${lastName} - Event: ${registration.event?.title}`);
    res.status(201).json({ message: 'Registration successful', registration });
    } catch (error) {
    logger.error('❌ Registration failed', error);
    next(error);
  }
};

export const registerAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) throw new AppError("Email and password required", 400);

    const bcrypt = await import("bcrypt");
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashed,
        role: role || "STAFF",
        isActive: true,
      },
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
// --------------------------
// LOGIN (For Admin/Staff Accounts)
// --------------------------
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) throw new AppError('Email and password required', 400);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) throw new AppError('Invalid credentials', 401);
    if (!user.isActive) throw new AppError('Account inactive', 403);

    const bcrypt = await import('bcrypt');
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new AppError('Invalid credentials', 401);

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const hashed = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store refresh token using token as unique identifier
    await prisma.refreshToken.upsert({
      where: { 
        token: hashed // Using token as unique identifier
      },
      update: {
        expiresAt,
        createdAt: new Date(),
      },
      create: {
        userId: user.id,
        token: hashed,
        expiresAt,
      },
    });

    res.json({
      success: true,
      data: { accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
};
// --------------------------
// REFRESH TOKEN
// --------------------------
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) throw new AppError('Refresh token required', 400);

    const hashed = hashToken(token);
    const stored = await prisma.refreshToken.findFirst({
      where: { token: hashed },
      include: { user: true },
    });

    if (!stored) throw new AppError('Invalid refresh token', 401);

    const payload = { userId: stored.user.id, email: stored.user.email, role: stored.user.role };
    const newAccessToken = generateAccessToken(payload);

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
};
// --------------------------
// LOGOUT
// --------------------------
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) throw new AppError('Refresh token required', 400);

    const hashed = hashToken(token);
    await prisma.refreshToken.deleteMany({ where: { token: hashed } });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};
// --------------------------
// ME (Profile Info for Authenticated User)
// --------------------------
export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Type assertion for req.user - you might want to extend the Request type properly
    const userFromToken = req.user as { userId: string; email: string; role: string } | undefined;
    
    if (!userFromToken) throw new AppError('Unauthorized', 401);

    const user = await prisma.user.findUnique({
      where: { id: userFromToken.userId },
      include: { profile: true },
    });

    if (!user) throw new AppError('User not found', 404);

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.profile?.firstName || null,
      lastName: user.profile?.lastName || null,
      phone: user.profile?.contact || null,
    });
  } catch (error) {
    next(error);
  }
};