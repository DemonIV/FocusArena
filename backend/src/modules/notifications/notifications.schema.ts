import { z } from 'zod';

/** Languages we have localized push copy for (mirrors the mobile i18n set). */
export const PUSH_LANGUAGES = ['en', 'tr', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru'] as const;
export type PushLanguage = (typeof PUSH_LANGUAGES)[number];

export const RegisterPushSchema = z.object({
  // Expo push tokens look like ExponentPushToken[xxxxxxxx]
  token: z.string().min(1).max(255),
  language: z.enum(PUSH_LANGUAGES).optional(),
});

export type RegisterPushBody = z.infer<typeof RegisterPushSchema>;

/** A single message in the Expo Push API payload. */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  data?: Record<string, unknown>;
}
