import { z } from 'zod';

export const EmailSchema = z.string().trim().email().max(254);

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const RegisterBodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});

export type LoginBody = z.infer<typeof LoginBodySchema>;

export const PublicUserSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
});

export type PublicUser = z.infer<typeof PublicUserSchema>;

export const AuthResponseSchema = z.object({
  user: PublicUserSchema,
  token: z.string().min(1),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
