import { supabase } from '../../shared';
import type { ExpoPushMessage, PushLanguage } from './notifications.schema';
import { PUSH_LANGUAGES } from './notifications.schema';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // Expo accepts up to 100 messages per request

// ─── Token management ─────────────────────────────────────────

export async function savePushToken(
  userId: string,
  token: string,
  language?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { expo_push_token: token, push_enabled: true };
  if (language && (PUSH_LANGUAGES as readonly string[]).includes(language)) {
    patch.push_language = language;
  }
  const { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (error) throw new Error(`savePushToken failed — ${error.message}`);
}

export async function clearPushToken(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ expo_push_token: null })
    .eq('id', userId);
  if (error) throw new Error(`clearPushToken failed — ${error.message}`);
}

// ─── Expo Push delivery ───────────────────────────────────────

/**
 * Send a batch of messages through the Expo Push API. Best-effort: network or
 * Expo-side errors are logged, not thrown, so callers (cron jobs) keep running.
 * Tokens Expo reports as unregistered are cleared from the DB.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        console.error(`[push] Expo API ${res.status}: ${await res.text()}`);
        continue;
      }

      const json = (await res.json()) as {
        data?: { status: 'ok' | 'error'; message?: string; details?: { error?: string } }[];
      };

      // Drop tokens Expo says are no longer registered
      const stale: string[] = [];
      (json.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          stale.push(chunk[idx].to);
        }
      });
      if (stale.length > 0) {
        await supabase.from('users').update({ expo_push_token: null }).in('expo_push_token', stale);
      }
    } catch (err) {
      console.error('[push] send failed:', (err as Error).message);
    }
  }
}

// ─── Localized copy ───────────────────────────────────────────

const STREAK_DANGER: Record<PushLanguage, { title: string; body: string }> = {
  en: { title: '🔥 Your streak is in danger!', body: 'Study a little today to keep your streak alive.' },
  tr: { title: '🔥 Serin tehlikede!', body: 'Serini korumak için bugün biraz çalış.' },
  de: { title: '🔥 Deine Serie ist in Gefahr!', body: 'Lerne heute kurz, um deine Serie zu retten.' },
  es: { title: '🔥 ¡Tu racha está en peligro!', body: 'Estudia un poco hoy para mantener tu racha.' },
  fr: { title: '🔥 Ta série est en danger !', body: 'Étudie un peu aujourd’hui pour garder ta série.' },
  it: { title: '🔥 La tua serie è a rischio!', body: 'Studia un po’ oggi per mantenere la tua serie.' },
  nl: { title: '🔥 Je reeks loopt gevaar!', body: 'Studeer vandaag even om je reeks te behouden.' },
  pl: { title: '🔥 Twoja seria jest zagrożona!', body: 'Poucz się dziś chwilę, aby utrzymać serię.' },
  pt: { title: '🔥 Sua sequência está em perigo!', body: 'Estude um pouco hoje para manter sua sequência.' },
  ru: { title: '🔥 Твоя серия под угрозой!', body: 'Позанимайся немного сегодня, чтобы сохранить серию.' },
};

function streakCopy(lang: string | null): { title: string; body: string } {
  const key = (lang ?? 'en') as PushLanguage;
  return STREAK_DANGER[key] ?? STREAK_DANGER.en;
}

// ─── High-level notifications ─────────────────────────────────

/**
 * Notify users whose streak is at risk: they have an active streak, push is
 * enabled, a token is on file, and they have NOT completed a session today
 * (UTC). Returns how many notifications were queued.
 */
export async function notifyStreakDanger(): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, expo_push_token, push_language, streak')
    .gt('streak', 0)
    .eq('push_enabled', true)
    .not('expo_push_token', 'is', null);

  if (error) throw new Error(`notifyStreakDanger: fetch users failed — ${error.message}`);
  if (!users || users.length === 0) return 0;

  const ids = users.map((u) => u.id as string);

  // Who already studied today → exempt
  const { data: active, error: sessErr } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('was_completed', true)
    .gte('started_at', todayStart.toISOString())
    .in('user_id', ids);

  if (sessErr) throw new Error(`notifyStreakDanger: fetch sessions failed — ${sessErr.message}`);
  const studiedToday = new Set((active ?? []).map((s) => s.user_id as string));

  const messages: ExpoPushMessage[] = [];
  for (const u of users) {
    if (studiedToday.has(u.id as string)) continue;
    const copy = streakCopy(u.push_language as string | null);
    messages.push({
      to: u.expo_push_token as string,
      title: copy.title,
      body: copy.body,
      sound: 'default',
      data: { type: 'streak_danger', streak: u.streak },
    });
  }

  await sendExpoPush(messages);
  return messages.length;
}
