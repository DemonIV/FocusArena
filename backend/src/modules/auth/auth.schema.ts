import { z } from 'zod';

// ─── Request Bodies ───────────────────────────────────────────

export const RegisterBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
});

export const LoginBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ─── Derived Types ────────────────────────────────────────────

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type RefreshBody = z.infer<typeof RefreshBodySchema>;

// ─── JWT Payload ──────────────────────────────────────────────

export interface JwtPayload {
  sub: string;              // userId (UUID)
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

// ─── Response Shapes ─────────────────────────────────────────

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  streak: number;
  longest_streak: number;
  timezone: string;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}
