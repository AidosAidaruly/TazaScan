import { z } from 'zod';
import { textLimits } from './text-limits';

export const loginBodySchema = z.object({
  email: z
    .string()
    .max(textLimits.email)
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(textLimits.password)
});

export type LoginBody = z.infer<typeof loginBodySchema>;
