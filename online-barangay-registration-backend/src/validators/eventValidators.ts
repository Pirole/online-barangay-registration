import { z } from "zod";

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    location: z.string().min(3),
    startDate: z.string(),
    endDate: z.string(),
    categoryId: z.string(),
    managerId: z.string().optional(),
    registrationMode: z.enum(["individual", "team"]).default("individual"),
    teamMemberSlots: z.number().min(1).default(1),
    customFields: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional(),
          predefined: z.boolean().optional(),
          options: z.any().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .optional()
      .default([]),
  }),
});

export const updateEventSchema = createEventSchema.partial();
