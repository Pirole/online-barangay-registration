import { z } from 'zod';
import { UserRole } from '../types/auth';

// Philippine phone number regex
export const PH_PHONE_REGEX = /^(\+63|0)9\d{9}$/;

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(PH_PHONE_REGEX, 'Invalid Philippine phone number').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  barangay: z.string().min(2, 'Barangay must be at least 2 characters'),
  role: z.nativeEnum(UserRole).optional().default(UserRole.RESIDENT),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Event validation schemas
export const createEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  start_date: z.string().datetime('Invalid start date format'),
  end_date: z.string().datetime('Invalid end date format'),
  location: z.string().min(5, 'Location must be at least 5 characters'),
  capacity: z.number().int().positive('Capacity must be a positive integer').optional(),
  age_min: z.number().int().min(0, 'Minimum age cannot be negative').optional(),
  age_max: z.number().int().max(120, 'Maximum age cannot exceed 120').optional(),
  custom_fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'select', 'checkbox']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
    validation: z.string().optional(),
  })).optional(),
  allow_autocheckin: z.boolean().default(false),
});

// Registrant validation schemas
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  age: z.number().int().min(0, 'Age must be a positive number'),
  phone: z.string().regex(PH_PHONE_REGEX, 'Invalid Philippine phone number'),
  barangay: z.string().min(2, 'Barangay must be at least 2 characters'),
  custom_field_values: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

export const otpVerificationSchema = z.object({
  registrant_id: z.string().uuid('Invalid registrant ID'),
  code: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
});