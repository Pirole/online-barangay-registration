import crypto from 'crypto';

export const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

export const hashOTP = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

export const verifyOTP = (otp: string, hash: string): boolean => {
  const otpHash = hashOTP(otp);
  return otpHash === hash;
};

// OTP expiry time (5 minutes)
export const OTP_EXPIRY_MINUTES = 5;
export const MAX_OTP_ATTEMPTS = 3;