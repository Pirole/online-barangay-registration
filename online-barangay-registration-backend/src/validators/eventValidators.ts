import { z } from "zod";

/**
 * ======================================================
 * EVENT VALIDATORS — Compatible with multipart/form-data
 * ======================================================
 *
 * These schemas coerce stringified FormData fields (like "6" or "2025-11-01")
 * into their proper types before validation.
 */

export const createEventSchema = z.object({
  body: z.object({
    // Basic Info
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),
    location: z.string().min(3, "Location is required"),

    // Dates (coerced to string)
    startDate: z.coerce.string().min(1, "Start date is required"),
    endDate: z.coerce.string().min(1, "End date is required"),

    // Relations
    categoryId: z.string().min(1, "Category is required"),
    managerId: z.string().optional(),

    // Registration Settings
    registrationMode: z
      .enum(["individual", "team", "both"])
      .default("individual"),

    // Coerce number inputs (string → number)
    teamMemberSlots: z.coerce
      .number()
      .min(1, "Team member slots must be at least 1")
      .default(1),

    // Optional additional custom fields
    customFields: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional(),
          predefined: z.boolean().optional(),
          options: z.any().optional(),
          sortOrder: z.coerce.number().optional(),
        })
      )
      .optional()
      .default([]),
  }),
});

/**
 * ✅ Partial version for PATCH/PUT updates
 */
export const updateEventSchema = createEventSchema.partial();
