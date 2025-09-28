import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must not exceed 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  categoryId: z.string().uuid('Invalid category ID'),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid start date format'),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid end date format'),
  registrationEnd: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid registration end date format'),
  location: z.string().min(5, 'Location must be at least 5 characters'),
  venueDetails: z.string().optional(),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').optional(),
  ageMin: z.number().int().min(0, 'Minimum age must be 0 or greater').default(0),
  ageMax: z.number().int().max(120, 'Maximum age must be 120 or less').optional(),
  genderRestriction: z.enum(['male', 'female', 'any']).default('any'),
  barangayRestriction: z.array(z.string()).optional(),
  requiresApproval: z.boolean().default(true),
  allowWalkIn: z.boolean().default(false),
  allowTeamRegistration: z.boolean().default(false),
  maxTeamMembers: z.number().int().min(1).default(1),
  customFields: z.array(z.object({
    key: z.string().min(1, 'Field key is required'),
    label: z.string().min(1, 'Field label is required'),
    type: z.enum(['text', 'textarea', 'number', 'select', 'checkbox', 'radio', 'date', 'email', 'tel']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
    validation: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      regex: z.string().optional(),
      message: z.string().optional(),
    }).optional(),
  })).default([]),
  qrRequired: z.boolean().default(true),
  attendanceTracking: z.boolean().default(true),
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const regEndDate = new Date(data.registrationEnd);
  
  return startDate < endDate && regEndDate <= startDate;
}, {
  message: 'End date must be after start date, and registration must end before event starts',
});

export const updateEventSchema = createEventSchema.partial();

export const eventQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default(1),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default(10),
  search: z.string().optional(),
  category: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  managerId: z.string().uuid().optional(),
  featured: z.string().transform(Boolean).optional(),
}).transform((data) => ({
  ...data,
  offset: (data.page - 1) * data.limit,
}));