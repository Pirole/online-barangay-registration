import { z } from "zod";

export const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["text", "number", "select", "date"]),
  required: z.boolean().optional(),
  predefined: z.boolean().optional(),
  options: z.string().optional(),
  sortOrder: z.number().optional(),
});
