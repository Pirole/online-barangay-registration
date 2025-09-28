import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/database';
import { logger } from './logger';

interface TokenPayload {
  userId: string;
  role: string;
  email: string;
}

export const generateTokens = (payload: TokenPayload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
};

export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const storeRefreshToken = async (userId: string, refreshToken: string): Promise<void> => {
  try {
    // Hash the refresh token before storing
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    // Store with expiration timestamp
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       ON CONFLICT (user_id) 
       DO UPDATE SET token_hash = $2, expires_at = $3, created_at = NOW()`,
      [userId, hashedToken, expiresAt]
    );
    
    logger.info(`Refresh token stored for user ${userId}`);
  } catch (error) {
    logger.error('Error storing refresh token:', error);
    throw new Error('Failed to store refresh token');
  }
};

export const validateRefreshToken = async (userId: string, refreshToken: string): Promise<boolean> => {
  try {
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const result = await query(
      `SELECT token_hash, expires_at FROM refresh_tokens 
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const storedHash = result.rows[0].token_hash;
    return storedHash === hashedToken;
  } catch (error) {
    logger.error('Error validating refresh token:', error);
    return false;
  }
};

export const revokeRefreshToken = async (userId: string): Promise<void> => {
  try {
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    logger.info(`Refresh token revoked for user ${userId}`);
  } catch (error) {
    logger.error('Error revoking refresh token:', error);
    throw new Error('Failed to revoke refresh token');
  }
};

export const cleanupExpiredTokens = async (): Promise<void> => {
  try {
    const result = await query('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
    logger.info(`Cleaned up ${result.rowCount} expired refresh tokens`);
  } catch (error) {
    logger.error('Error cleaning up expired tokens:', error);
  }
};

// Generate secure random tokens for password reset, email verification, etc.
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Verify token expiry
export const isTokenExpired = (exp: number): boolean => {
  return Date.now() >= exp * 1000;
};