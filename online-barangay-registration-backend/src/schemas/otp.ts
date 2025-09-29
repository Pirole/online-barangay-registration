// src/schemas/otp.ts
import { z } from 'zod';

// Philippine phone regex: allows +639XXXXXXXXX or 09XXXXXXXXX
const PHONE_REGEX = /^(?:\+639\d{9}|09\d{9})$/;

export const sendOtpSchema = z.object({
  phone: z.string().regex(PHONE_REGEX, 'Invalid Philippine phone number format'),
  purpose: z.enum(['registration', 'login', 'phone_verify', 'password_reset']),
  relatedId: z.string().uuid().optional(),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(PHONE_REGEX, 'Invalid Philippine phone number format'),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only numbers'),
  purpose: z.enum(['registration', 'login', 'phone_verify', 'password_reset']),
});
