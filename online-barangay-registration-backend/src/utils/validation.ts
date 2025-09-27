import { z } from 'zod';

// Phone number validation for Philippine format
const phoneRegex = /^(\+63|0)9\d{9}$/;

// Custom validation schemas
export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  age: z.number().int().min(0, "Age must be a positive number"),
  phone: z.string().regex(phoneRegex, "Invalid Philippine phone number format"),
  barangay: z.string().min(2, "Barangay must be at least 2 characters"),
  customFields: z.record(z.string(), z.any()).optional(),
  photoTempId: z.string().uuid("Invalid photo temp ID format"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const CreateUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(['super_admin', 'event_manager', 'staff']),
  phone: z.string().regex(phoneRegex, "Invalid Philippine phone number format").optional(),
  barangay: z.string().min(2, "Barangay must be at least 2 characters").optional(),
});

export const UpdateUserSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  role: z.enum(['super_admin', 'event_manager', 'staff']).optional(),
  phone: z.string().regex(phoneRegex, "Invalid Philippine phone number format").optional(),
  barangay: z.string().min(2, "Barangay must be at least 2 characters").optional(),
});

export const CreateEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  startDate: z.string().datetime("Invalid start date format"),
  endDate: z.string().datetime("Invalid end date format"),
  location: z.string().min(3, "Location must be at least 3 characters"),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
  ageMin: z.number().int().min(0, "Minimum age must be 0 or greater").optional(),
  ageMax: z.number().int().max(120, "Maximum age must be 120 or less").optional(),
  customFields: z.array(z.object({
    key: z.string().min(1, "Field key is required"),
    label: z.string().min(1, "Field label is required"),
    type: z.enum(['text', 'number', 'email', 'select', 'textarea']),
    required: z.boolean(),
    validation: z.string().optional(),
    options: z.array(z.string()).optional(), // For select fields
  })).optional(),
  allowAutoCheckin: z.boolean().optional().default(false),
  managerId: z.string().uuid("Invalid manager ID format").optional(),
});

export const UpdateEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").optional(),
  description: z.string().min(10, "Description must be at least 10 characters").optional(),
  startDate: z.string().datetime("Invalid start date format").optional(),
  endDate: z.string().datetime("Invalid end date format").optional(),
  location: z.string().min(3, "Location must be at least 3 characters").optional(),
  capacity: z.number().int().min(1, "Capacity must be at least 1").optional(),
  ageMin: z.number().int().min(0, "Minimum age must be 0 or greater").optional(),
  ageMax: z.number().int().max(120, "Maximum age must be 120 or less").optional(),
  customFields: z.array(z.object({
    key: z.string().min(1, "Field key is required"),
    label: z.string().min(1, "Field label is required"),
    type: z.enum(['text', 'number', 'email', 'select', 'textarea']),
    required: z.boolean(),
    validation: z.string().optional(),
    options: z.array(z.string()).optional(),
  })).optional(),
  allowAutoCheckin: z.boolean().optional(),
  managerId: z.string().uuid("Invalid manager ID format").optional(),
});

export const OTPVerifySchema = z.object({
  registrantId: z.string().uuid("Invalid registrant ID format"),
  code: z.string().length(6, "OTP code must be exactly 6 digits").regex(/^\d{6}$/, "OTP code must contain only digits"),
});

export const ApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
});

export const ScanQRSchema = z.object({
  qrValue: z.string().min(1, "QR value is required"),
  eventId: z.string().uuid("Invalid event ID format").optional(),
});

export const QueryEventsSchema = z.object({
  status: z.enum(['upcoming', 'ongoing', 'completed', 'all']).optional().default('upcoming'),
  search: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
  managerId: z.string().uuid().optional(),
});

export const QueryRegistrantsSchema = z.object({
  eventId: z.string().uuid("Invalid event ID format"),
  status: z.enum(['pending', 'approved', 'rejected', 'flagged', 'all']).optional().default('all'),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const QueryAuditLogsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  action: z.string().optional(),
  actorId: z.string().uuid().optional(),
  targetType: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

export const PhotoUploadSchema = z.object({
  photo: z.string().min(1, "Photo data is required"), // Base64 or file path
  mimeType: z.enum(['image/jpeg', 'image/jpg', 'image/png']),
});

// Utility function to normalize Philippine phone numbers
export const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (digits.startsWith('63')) {
    return `+${digits}`;
  } else if (digits.startsWith('09')) {
    return `+63${digits.substring(1)}`;
  } else if (digits.startsWith('9') && digits.length === 10) {
    return `+63${digits}`;
  }
  
  return phone; // Return original if can't normalize
};

// Validation middleware factory
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validatedData = schema.parse({
        ...req.body,
        ...req.query,
        ...req.params,
      }) as any;
      
      // Normalize phone number if present
      if (validatedData.phone) {
        validatedData.phone = normalizePhoneNumber(validatedData.phone);
      }
      
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues,
        });
      }
      next(error);
    }
  };
};

// Type exports for TypeScript
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type OTPVerifyInput = z.infer<typeof OTPVerifySchema>;
export type ApprovalInput = z.infer<typeof ApprovalSchema>;
export type ScanQRInput = z.infer<typeof ScanQRSchema>;
export type QueryEventsInput = z.infer<typeof QueryEventsSchema>;
export type QueryRegistrantsInput = z.infer<typeof QueryRegistrantsSchema>;
export type QueryAuditLogsInput = z.infer<typeof QueryAuditLogsSchema>;
export type PhotoUploadInput = z.infer<typeof PhotoUploadSchema>;

// Custom validation functions
export const validateAge = (age: number, eventAgeMin?: number, eventAgeMax?: number): boolean => {
  if (eventAgeMin && age < eventAgeMin) return false;
  if (eventAgeMax && age > eventAgeMax) return false;
  return true;
};

export const validateEventDates = (startDate: string, endDate: string): boolean => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  
  // Start date should be in the future or today
  if (start < now) return false;
  
  // End date should be after start date
  if (end <= start) return false;
  
  return true;
};

export const validateCustomFieldValue = (value: any, field: any): boolean => {
  if (field.required && (!value || value === '')) {
    return false;
  }
  
  if (!value && !field.required) {
    return true; // Optional field with no value is valid
  }
  
  switch (field.type) {
    case 'email':
      return z.string().email().safeParse(value).success;
    case 'number':
      return z.number().safeParse(Number(value)).success;
    case 'select':
      return field.options && field.options.includes(value);
    default:
      return typeof value === 'string' && value.length > 0;
  }
};