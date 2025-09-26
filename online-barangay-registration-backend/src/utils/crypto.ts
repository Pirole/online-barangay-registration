import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/auth';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateTokens = (payload: Omit<JwtPayload, 'iat' | 'exp'>) => {
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
};