import { z } from 'zod';

// Philippine phone number regex
const PH_PHONE_REGEX = /^(\+63|0)9\d{9}$/;

// Custom error messages in Taglish
const MESSAGES = {
  REQUIRED: 'Kinakailangan ang field na ito',
  INVALID_EMAIL: 'Hindi valid na email address',
  INVALID_PHONE: 'Hindi valid na Philippine phone number (dapat 09XXXXXXXXX o +639XXXXXXXXX)',
  PASSWORD_TOO_SHORT: 'Password dapat hindi bababa sa 8 characters',
  AGE_INVALID: 'Edad dapat numero at hindi bababa sa 0',
  NAME_TOO_SHORT: 'Pangalan dapat hindi bababa sa 2 characters',
  ADDRESS_TOO_SHORT: 'Address dapat hindi bababa sa 5 characters',
  BARANGAY_TOO_SHORT: 'Barangay dapat hindi bababa sa 2 characters',
  INVALID_UUID: 'Hindi valid na UUID format',
  FILE_TOO_LARGE: 'File sobrang laki (maximum 5MB)',
  INVALID_FILE_TYPE: 'Hindi valid na file type',
  OTP_INVALID: 'OTP dapat 6 digits',
  FUTURE_DATE_REQUIRED: 'Date dapat sa hinaharap',
  END_DATE_AFTER_START: 'End date dapat mas late kaysa start date'
};

// User role enum - using older Zod syntax
export const UserRole = z.enum(['super_admin', 'event_manager', 'staff', 'resident', 'guest']);

// Registration status enum - using older Zod syntax
export const RegistrationStatus = z.enum(['pending', 'approved', 'rejected', 'flagged']);

// Base validation schemas - using older Zod syntax without required_error
export const emailSchema = z
  .string()
  .min(1, MESSAGES.REQUIRED)
  .email(MESSAGES.INVALID_EMAIL)
  .transform(val => val.toLowerCase().trim());

export const phoneSchema = z
  .string()
  .min(1, MESSAGES.REQUIRED)
  .regex(PH_PHONE_REGEX, MESSAGES.INVALID_PHONE)
  .transform((phone) => {
    // Normalize to +63 format
    if (phone.startsWith('09')) {
      return phone.replace('09', '+639');
    }
    return phone;
  });

export const passwordSchema = z
  .string()
  .min(8, MESSAGES.PASSWORD_TOO_SHORT);

export const nameSchema = z
  .string()
  .min(2, MESSAGES.NAME_TOO_SHORT)
  .transform(val => val.trim());

export const addressSchema = z
  .string()
  .min(5, MESSAGES.ADDRESS_TOO_SHORT)
  .transform(val => val.trim());

export const ageSchema = z
  .number(MESSAGES.AGE_INVALID)
  .int(MESSAGES.AGE_INVALID)
  .min(0, MESSAGES.AGE_INVALID);

export const barangaySchema = z
  .string()
  .min(2, MESSAGES.BARANGAY_TOO_SHORT)
  .transform(val => val.trim());

export const uuidSchema = z
  .string()
  .uuid(MESSAGES.INVALID_UUID);

// Custom field validation
export const customFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'email', 'phone', 'select', 'textarea']),
  required: z.boolean().default(false),
  validation: z.string().optional(), // regex string for validation
  options: z.array(z.string()).optional() // for select type
});

// File upload validation - using older syntax
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

export const fileUploadSchema = z.object({
  filename: z.string(),
  mimetype: z.string().refine(
    (type) => ACCEPTED_IMAGE_TYPES.includes(type), 
    MESSAGES.INVALID_FILE_TYPE
  ),
  size: z.number().max(MAX_FILE_SIZE, MESSAGES.FILE_TOO_LARGE)
});

// OTP validation
export const otpSchema = z
  .string()
  .length(6, MESSAGES.OTP_INVALID)
  .regex(/^\d{6}$/, MESSAGES.OTP_INVALID);

// Date validation helpers
export const futureDateSchema = z
  .string()
  .or(z.date())
  .refine((date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj > new Date();
  }, MESSAGES.FUTURE_DATE_REQUIRED);

// User schemas
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  phone: phoneSchema.optional(),
  role: UserRole,
  barangay: barangaySchema.optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, MESSAGES.REQUIRED)
});

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({
    id: uuidSchema
  });

// Event schemas
export const createEventSchema = z.object({
  title: z.string().min(3).transform(val => val.trim()),
  description: z.string().optional(),
  start_date: futureDateSchema,
  end_date: futureDateSchema,
  location: z.string().min(3).transform(val => val.trim()),
  capacity: z.number().int().min(1).optional(),
  age_min: z.number().int().min(0).optional(),
  age_max: z.number().int().min(0).optional(),
  custom_fields: z.array(customFieldSchema).default([]),
  allow_autocheckin: z.boolean().default(false)
}).refine((data) => {
  if (typeof data.start_date === 'string' && typeof data.end_date === 'string') {
    return new Date(data.end_date) > new Date(data.start_date);
  }
  if (data.start_date instanceof Date && data.end_date instanceof Date) {
    return data.end_date > data.start_date;
  }
  return true;
}, {
  message: MESSAGES.END_DATE_AFTER_START,
  path: ['end_date']
}).refine((data) => {
  if (data.age_min && data.age_max) {
    return data.age_max >= data.age_min;
  }
  return true;
}, {
  message: 'Maximum age dapat mas mataas o katumbas ng minimum age',
  path: ['age_max']
});

export const updateEventSchema = createEventSchema
  .partial()
  .extend({
    id: uuidSchema
  });

// Registration schemas
export const registerSchema = z.object({
  event_id: uuidSchema,
  name: nameSchema,
  address: addressSchema,
  age: ageSchema,
  phone: phoneSchema,
  barangay: barangaySchema,
  notes: z.string().optional(),
  custom_field_values: z.record(z.any()).default({}),
  photo_temp_id: uuidSchema.optional()
});

export const approveRejectRegistrantSchema = z.object({
  registrant_id: uuidSchema,
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional()
});

// OTP schemas
export const sendOtpSchema = z.object({
  registrant_id: uuidSchema
});

export const verifyOtpSchema = z.object({
  registrant_id: uuidSchema,
  code: otpSchema
});

// QR scan schema
export const qrScanSchema = z.object({
  qr_value: z.string().min(1, MESSAGES.REQUIRED),
  event_id: uuidSchema.optional()
});

// Attendance schema
export const attendanceSchema = z.object({
  registrant_id: uuidSchema,
  event_id: uuidSchema,
  action: z.enum(['checkin', 'checkout']).default('checkin')
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const eventListSchema = paginationSchema.extend({
  status: z.enum(['upcoming', 'ongoing', 'past', 'all']).default('upcoming'),
  search: z.string().optional(),
  manager_id: uuidSchema.optional()
});

export const registrantListSchema = paginationSchema.extend({
  event_id: uuidSchema,
  status: RegistrationStatus.optional(),
  search: z.string().optional()
});

export const auditLogSchema = paginationSchema.extend({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  action: z.string().optional(),
  actor_id: uuidSchema.optional()
});

// Export type definitions
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ApproveRejectInput = z.infer<typeof approveRejectRegistrantSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type QrScanInput = z.infer<typeof qrScanSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type EventListQuery = z.infer<typeof eventListSchema>;
export type RegistrantListQuery = z.infer<typeof registrantListSchema>;
export type AuditLogQuery = z.infer<typeof auditLogSchema>;
export type CustomField = z.infer<typeof customFieldSchema>;
export type UserRoleType = z.infer<typeof UserRole>;
export type RegistrationStatusType = z.infer<typeof RegistrationStatus>;