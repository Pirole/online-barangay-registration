import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.warn('Warning: Using default JWT secrets. Set JWT_SECRET and JWT_REFRESH_SECRET in production!');
}

// JWT Token Interfaces
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  barangay?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

// JWT Functions
export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: '15m',
    issuer: 'barangay-registration-system',
    audience: 'barangay-users'
  };
  
  return jwt.sign(payload, JWT_SECRET, options);
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: '7d',
    issuer: 'barangay-registration-system',
    audience: 'barangay-users'
  };
  
  return jwt.sign(payload, JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const options: VerifyOptions = {
    issuer: 'barangay-registration-system',
    audience: 'barangay-users'
  };
  
  const decoded = jwt.verify(token, JWT_SECRET, options) as JwtPayload;
  
  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    barangay: decoded.barangay
  };
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const options: VerifyOptions = {
    issuer: 'barangay-registration-system',
    audience: 'barangay-users'
  };
  
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET, options) as JwtPayload;
  
  return {
    userId: decoded.userId,
    tokenVersion: decoded.tokenVersion
  };
};

// QR Code Token Generation (for registrant QR codes)
export interface QRPayload {
  registrantId: string;
  eventId: string;
  timestamp: number;
}

export const generateQRToken = (payload: QRPayload): string => {
  const options: SignOptions = {
    expiresIn: '30d', // QR codes should be valid for the entire event duration
    issuer: 'barangay-registration-system',
    audience: 'barangay-qr-scanner'
  };
  
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyQRToken = (token: string): QRPayload => {
  const options: VerifyOptions = {
    issuer: 'barangay-registration-system',
    audience: 'barangay-qr-scanner'
  };
  
  const decoded = jwt.verify(token, JWT_SECRET, options) as JwtPayload;
  
  return {
    registrantId: decoded.registrantId,
    eventId: decoded.eventId,
    timestamp: decoded.timestamp
  };
};

// Password Hashing
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// OTP Generation and Hashing
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

export const hashOTP = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

export const verifyOTP = (inputOTP: string, hashedOTP: string): boolean => {
  const hashedInput = hashOTP(inputOTP);
  return crypto.timingSafeEqual(Buffer.from(hashedInput), Buffer.from(hashedOTP));
};

// Random Token Generation (for various purposes)
export const generateRandomToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// UUID Generation
export const generateUUID = (): string => {
  return crypto.randomUUID();
};

// Encryption/Decryption for sensitive data (optional)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') 
  : crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

export const encrypt = (text: string): { encrypted: string; iv: string; tag: string } => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag
  };
};

export const decrypt = (encryptedData: { encrypted: string; iv: string; tag: string }): string => {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Token blacklist utilities (for logout functionality)
const tokenBlacklist = new Set<string>();

export const blacklistToken = (token: string): void => {
  tokenBlacklist.add(token);
};

export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

// Clean up expired blacklisted tokens periodically
setInterval(() => {
  // In a real application, you'd want to persist this to a database
  // and clean up based on actual expiration times
  tokenBlacklist.clear();
}, 24 * 60 * 60 * 1000); // Clear daily

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateQRToken,
  verifyQRToken,
  hashPassword,
  comparePassword,
  generateOTP,
  hashOTP,
  verifyOTP,
  generateRandomToken,
  generateUUID,
  encrypt,
  decrypt,
  blacklistToken,
  isTokenBlacklisted
};