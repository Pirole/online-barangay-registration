import { z } from 'zod';

export const guestRegistrationSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().regex(PHONE_REGEX, 'Invalid Philippine phone number format'),
  email: z.string().email('Invalid email format').optional(),
  age: z.number().int().min(1).max(120, 'Age must be between 1 and 120'),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  barangay: z.string().min(2, 'Barangay must be at least 2 characters'),
  customFieldValues: z.record(z.any()).default({}),
  teamId: z.string().uuid().optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
});

export const userRegistrationSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  customFieldValues: z.record(z.any()).default({}),
  teamId: z.string().uuid().optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
});

export const updateRegistrationStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'waitlisted', 'cancelled']),
  rejectionReason: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const registrationQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default(1),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default(10),
  status: z.enum(['pending', 'approved', 'rejected', 'waitlisted', 'cancelled']).optional(),
  eventId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  barangay: z.string().optional(),
  search: z.string().optional(),
}).transform((data) => ({
  ...data,
  offset: (data.page - 1) * data.limit,
}));