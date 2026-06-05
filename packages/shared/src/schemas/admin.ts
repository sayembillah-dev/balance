import { z } from 'zod';
import { USER_ROLES } from '../enums.js';
import { passwordSchema, emailSchema } from './auth.js';

const role = z.enum(
  USER_ROLES as unknown as [(typeof USER_ROLES)[number], ...(typeof USER_ROLES)[number][]],
);

export const adminUserUpdateSchema = z.object({
  role: role.optional(),
  isActive: z.boolean().optional(),
});

export const adminSetPasswordSchema = z.object({
  password: passwordSchema,
});

export const invitationCreateSchema = z.object({
  email: emailSchema.optional(),
  role: role.default('user'),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(7),
});

export const adminSettingsSchema = z.object({
  allowOpenSignups: z.boolean().optional(),
  instanceName: z.string().trim().min(1).max(80).optional(),
});
