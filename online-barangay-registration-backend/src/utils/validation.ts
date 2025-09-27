// src/utils/validation.ts - Zod validation schemas
import { z } from 'zod';

// Import Prisma enums directly from generated client
// Make sure you run `npx prisma generate` first
import { UserRole, RegistrantStatus } from '@prisma/client';

// Philippine phone number regex
export const PH_PHONE_REGEX = /^(\+63|0)9\d{9}$/;

// Age validation constants
export const MIN_AGE = 0;
export const MAX_AGE = 120;

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(PH_PHONE_REGEX, 'Invalid Philippine phone number').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  barangay: z.string().min(2, 'Barangay must be at least 2 characters').optional(),
  role: z.nativeEnum(UserRole).default(UserRole.RESIDENT),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Custom field definition schema
export const customFieldSchema = z.object({
  key: z.string().min(1, 'Field key is required'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['text', 'number', 'select', 'checkbox', 'textarea']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  validation: z.string().optional(), // Regex pattern
  placeholder: z.string().optional(),
  helperText: z.string().optional(),
});

// Event validation schemas
export const createEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  description: z.string().min(10, 'Description must be at least 10 characters').optional(),
  startDate: z.string().datetime('Invalid start date format'),
  endDate: z.string().datetime('Invalid end date format'),
  location: z.string().min(5, 'Location must be at least 5 characters'),
  capacity: z.number().int().positive('Capacity must be a positive integer').optional(),
  ageMin: z.number().int().min(MIN_AGE, 'Minimum age cannot be negative').optional(),
  ageMax: z.number().int().max(MAX_AGE, 'Maximum age cannot exceed 120').optional(),
  customFields: z.array(customFieldSchema).optional(),
  allowAutoCheckin: z.boolean().default(false),
  retentionDays: z.number().int().min(1).max(365).default(90),
  managerId: z.string().uuid('Invalid manager ID'),
}).refine((data) => {
  if (data.ageMin && data.ageMax) {
    return data.ageMin <= data.ageMax;
  }
  return true;
}, {
  message: "Minimum age cannot be greater than maximum age",
  path: ["ageMax"],
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return startDate < endDate;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

export const updateEventSchema = createEventSchema.partial().omit({ managerId: true });

// Event query/filter schemas
export const eventQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['upcoming', 'ongoing', 'completed']).optional(),
  managerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Registrant validation schemas
export const registerSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  address: z.string().min(5, 'Address must be at least 5 characters').max(500, 'Address too long'),
  age: z.number().int().min(MIN_AGE, 'Age must be a positive number').max(MAX_AGE, 'Invalid age'),
  phone: z.string().regex(PH_PHONE_REGEX, 'Invalid Philippine phone number'),
  barangay: z.string().min(2, 'Barangay must be at least 2 characters').max(100, 'Barangay name too long'),
  customFieldValues: z.record(z.any()).optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  photoTempId: z.string().uuid('Invalid photo temp ID').optional(),
  userId: z.string().uuid().optional(), // For registered users
});

export const updateRegistrantStatusSchema = z.object({
  status: z.nativeEnum(RegistrantStatus),
  rejectionReason: z.string().min(1, 'Rejection reason is required').optional(),
  flagReason: z.string().min(1, 'Flag reason is required').optional(),
  approvedBy: z.string().uuid().optional(),
}).refine((data) => {
  if (data.status === RegistrantStatus.REJECTED && !data.rejectionReason) {
    return false;
  }
  if ((data.status === RegistrantStatus.FLAGGED_AGE || data.status === RegistrantStatus.FLAGGED_OTHER) && !data.flagReason) {
    return false;
  }
  return true;
}, {
  message: "Reason is required when rejecting or flagging",
  path: ["rejectionReason", "flagReason"],
});

// OTP validation schemas
export const otpVerificationSchema = z.object({
  registrantId: z.string().uuid('Invalid registrant ID'),
  code: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const resendOtpSchema = z.object({
  registrantId: z.string().uuid('Invalid registrant ID'),
});

// Photo upload validation
export const photoUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  mimetype: z.enum(['image/jpeg', 'image/png', 'image/jpg'], {
    errorMap: () => ({ message: 'Only JPEG and PNG images are allowed' })
  }),
  size: z.number().max(5242880, 'Image size must be less than 5MB'), // 5MB
});

// QR scan validation
export const qrScanSchema = z.object({
  qrValue: z.string().min(1, 'QR value is required'),
  eventId: z.string().uuid('Invalid event ID'),
  scannedById: z.string().uuid('Invalid scanner user ID'),
  metadata: z.record(z.any()).optional(),
});

// Attendance validation
export const attendanceSchema = z.object({
  registrantId: z.string().uuid('Invalid registrant ID'),
  eventId: z.string().uuid('Invalid event ID'),
  checkinTime: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

// Audit log query validation
export const auditLogQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Pagination schema (reusable)
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Search schema (reusable)
export const searchSchema = z.object({
  search: z.string().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Validation helper functions
export const validateCustomFields = (customFieldValues: Record<string, any>, customFields: any[]) => {
  const schema = z.object(
    customFields.reduce((acc, field) => {
      let fieldSchema: z.ZodType<any>;
      
      switch (field.type) {
        case 'number':
          fieldSchema = z.coerce.number();
          break;
        case 'checkbox':
          fieldSchema = z.boolean();
          break;
        case 'select':
          fieldSchema = z.enum(field.options || []);
          break;
        default:
          fieldSchema = z.string();
      }
      
      if (field.required) {
        fieldSchema = fieldSchema.min(1, `${field.label} is required`);
      } else {
        fieldSchema = fieldSchema.optional();
      }
      
      if (field.validation && field.type === 'text') {
        fieldSchema = (fieldSchema as z.ZodString).regex(
          new RegExp(field.validation), 
          `Invalid ${field.label} format`
        );
      }
      
      acc[field.key] = fieldSchema;
      return acc;
    }, {} as Record<string, z.ZodType<any>>)
  );
  
  return schema.parse(customFieldValues);
};

// Phone number normalization helper
export const normalizePhoneNumber = (phone: string): string => {
  // Convert to +63 format
  if (phone.startsWith('0')) {
    return `+63${phone.substring(1)}`;
  }
  if (!phone.startsWith('+63')) {
    return `+63${phone}`;
  }
  return phone;
};

// Export types for use in other files
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OtpVerificationInput = z.infer<typeof otpVerificationSchema>;
export type QrScanInput = z.infer<typeof qrScanSchema>;