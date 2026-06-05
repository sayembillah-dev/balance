import { z } from 'zod';

// Auth request shapes — the single source of truth used by the server (request
// validation) and the web app (form validation), so they can't drift.

export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(8).max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(120),
  invite: z.string().trim().min(1).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const setupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(120),
});
export type SetupInput = z.infer<typeof setupSchema>;

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
