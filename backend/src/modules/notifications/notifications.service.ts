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

/** Toggle push delivery without dropping the stored token. */
export async function setPushEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ push_enabled: enabled })
    .eq('id', userId);
  if (error) throw new Error(`setPushEnabled failed — ${error.message}`);
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

const FRIEND_REQUEST: Record<PushLanguage, { title: string; body: string }> = {
  en: { title: '👋 New friend request', body: '{name} wants to be your friend on StudySquad.' },
  tr: { title: '👋 Yeni arkadaşlık isteği', body: '{name} StudySquad’da arkadaşın olmak istiyor.' },
  de: { title: '👋 Neue Freundschaftsanfrage', body: '{name} möchte auf StudySquad dein Freund sein.' },
  es: { title: '👋 Nueva solicitud de amistad', body: '{name} quiere ser tu amigo en StudySquad.' },
  fr: { title: '👋 Nouvelle demande d’ami', body: '{name} veut devenir ton ami sur StudySquad.' },
  it: { title: '👋 Nuova richiesta di amicizia', body: '{name} vuole essere tuo amico su StudySquad.' },
  nl: { title: '👋 Nieuw vriendschapsverzoek', body: '{name} wil je vriend zijn op StudySquad.' },
  pl: { title: '👋 Nowe zaproszenie do znajomych', body: '{name} chce zostać twoim znajomym w StudySquad.' },
  pt: { title: '👋 Novo pedido de amizade', body: '{name} quer ser seu amigo no StudySquad.' },
  ru: { title: '👋 Новая заявка в друзья', body: '{name} хочет добавить тебя в друзья в StudySquad.' },
};

const FRIEND_ACCEPTED: Record<PushLanguage, { title: string; body: string }> = {
  en: { title: '🤝 Friend request accepted', body: '{name} accepted your friend request. Time to study together!' },
  tr: { title: '🤝 İstek kabul edildi', body: '{name} arkadaşlık isteğini kabul etti. Birlikte çalışma zamanı!' },
  de: { title: '🤝 Anfrage angenommen', body: '{name} hat deine Freundschaftsanfrage angenommen. Lernt zusammen!' },
  es: { title: '🤝 Solicitud aceptada', body: '{name} aceptó tu solicitud de amistad. ¡A estudiar juntos!' },
  fr: { title: '🤝 Demande acceptée', body: '{name} a accepté ta demande d’ami. Étudiez ensemble !' },
  it: { title: '🤝 Richiesta accettata', body: '{name} ha accettato la tua richiesta. È ora di studiare insieme!' },
  nl: { title: '🤝 Verzoek geaccepteerd', body: '{name} heeft je verzoek geaccepteerd. Tijd om samen te studeren!' },
  pl: { title: '🤝 Zaproszenie przyjęte', body: '{name} przyjął(-ęła) twoje zaproszenie. Czas na wspólną naukę!' },
  pt: { title: '🤝 Pedido aceito', body: '{name} aceitou seu pedido de amizade. Hora de estudar juntos!' },
  ru: { title: '🤝 Заявка принята', body: '{name} принял(а) твою заявку. Пора заниматься вместе!' },
};

const WINBACK: Record<PushLanguage, { title: string; body: string }> = {
  en: { title: '📚 We miss you!', body: 'It’s been {days} days. A short session today gets you back on track.' },
  tr: { title: '📚 Seni özledik!', body: '{days} gündür yoksun. Bugün kısa bir seansla yeniden başla.' },
  de: { title: '📚 Wir vermissen dich!', body: 'Seit {days} Tagen nicht gelernt. Eine kurze Einheit bringt dich zurück.' },
  es: { title: '📚 ¡Te extrañamos!', body: 'Han pasado {days} días. Una sesión corta hoy te pone en marcha.' },
  fr: { title: '📚 Tu nous manques !', body: 'Ça fait {days} jours. Une courte session te remet sur les rails.' },
  it: { title: '📚 Ci manchi!', body: 'Sono passati {days} giorni. Una breve sessione ti rimette in carreggiata.' },
  nl: { title: '📚 We missen je!', body: 'Het is {days} dagen geleden. Een korte sessie brengt je weer op koers.' },
  pl: { title: '📚 Tęsknimy!', body: 'Minęło {days} dni. Krótka sesja dziś wróci cię na właściwe tory.' },
  pt: { title: '📚 Sentimos sua falta!', body: 'Já se passaram {days} dias. Uma sessão curta te coloca nos trilhos.' },
  ru: { title: '📚 Мы скучаем!', body: 'Прошло {days} дн. Короткая сессия вернёт тебя в ритм.' },
};

const WINBACK_PET: Record<PushLanguage, { title: string; body: string }> = {
  en: { title: '🐾 Your pet misses you!', body: 'No focus for {days} days — come back and make your pet happy.' },
  tr: { title: '🐾 Evcil hayvanın seni özledi!', body: '{days} gündür odaklanmadın — geri dön, dostunu mutlu et.' },
  de: { title: '🐾 Dein Haustier vermisst dich!', body: 'Seit {days} Tagen kein Fokus — komm zurück und mach es glücklich.' },
  es: { title: '🐾 ¡Tu mascota te extraña!', body: '{days} días sin enfocarte — vuelve y hazla feliz.' },
  fr: { title: '🐾 Ton compagnon te réclame !', body: '{days} jours sans focus — reviens le rendre heureux.' },
  it: { title: '🐾 Il tuo pet sente la tua mancanza!', body: '{days} giorni senza focus — torna e rendilo felice.' },
  nl: { title: '🐾 Je huisdier mist je!', body: '{days} dagen geen focus — kom terug en maak het blij.' },
  pl: { title: '🐾 Twój zwierzak tęskni!', body: '{days} dni bez nauki — wróć i go uszczęśliw.' },
  pt: { title: '🐾 Seu pet sente sua falta!', body: '{days} dias sem foco — volte e deixe-o feliz.' },
  ru: { title: '🐾 Твой питомец скучает!', body: '{days} дн. без занятий — вернись и порадуй его.' },
};

function pickCopy(
  table: Record<PushLanguage, { title: string; body: string }>,
  lang: string | null,
  params: Record<string, string | number> = {},
): { title: string; body: string } {
  const copy = table[(lang ?? 'en') as PushLanguage] ?? table.en;
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (m, key: string) => (key in params ? String(params[key]) : m));
  return { title: fill(copy.title), body: fill(copy.body) };
}

function streakCopy(lang: string | null): { title: string; body: string } {
  return pickCopy(STREAK_DANGER, lang);
}

// ─── Single-user event pushes ─────────────────────────────────

/**
 * Send one localized push to one user (best-effort, never throws).
 * Skips silently when the user opted out or has no token on file.
 */
async function notifyUser(
  userId: string,
  table: Record<PushLanguage, { title: string; body: string }>,
  params: Record<string, string | number>,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('expo_push_token, push_language, push_enabled')
      .eq('id', userId)
      .single();
    if (error || !user?.expo_push_token || !user.push_enabled) return;

    const copy = pickCopy(table, user.push_language as string | null, params);
    await sendExpoPush([
      { to: user.expo_push_token as string, ...copy, sound: 'default', data },
    ]);
  } catch (err) {
    console.error('[push] notifyUser failed:', (err as Error).message);
  }
}

/** Push to the addressee of a new friend request. Fire-and-forget. */
export async function notifyFriendRequest(targetId: string, fromUsername: string): Promise<void> {
  await notifyUser(targetId, FRIEND_REQUEST, { name: fromUsername }, { type: 'friend_request' });
}

/** Push to the original requester when their request is accepted. Fire-and-forget. */
export async function notifyFriendAccepted(requesterId: string, byUsername: string): Promise<void> {
  await notifyUser(requesterId, FRIEND_ACCEPTED, { name: byUsername }, { type: 'friend_accepted' });
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

/**
 * Win-back push for lapsed users: last completed session exactly 3 or 7 UTC
 * days ago (single-shot per milestone, so nobody is nagged daily). Users whose
 * last session is older than the lookback window get nothing — their milestone
 * already passed. Pet owners get pet-flavored copy. Returns queued count.
 */
export async function notifyWinback(): Promise<number> {
  const DAY_MS = 86_400_000;
  const MILESTONES = [3, 7];
  const LOOKBACK_DAYS = Math.max(...MILESTONES) + 1;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(todayStart.getTime() - LOOKBACK_DAYS * DAY_MS);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, expo_push_token, push_language, selected_pet')
    .eq('push_enabled', true)
    .not('expo_push_token', 'is', null);

  if (error) throw new Error(`notifyWinback: fetch users failed — ${error.message}`);
  if (!users || users.length === 0) return 0;

  const ids = users.map((u) => u.id as string);

  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('user_id, started_at')
    .eq('was_completed', true)
    .gte('started_at', windowStart.toISOString())
    .in('user_id', ids);

  if (sessErr) throw new Error(`notifyWinback: fetch sessions failed — ${sessErr.message}`);

  // Latest completed session per user within the lookback window
  const lastByUser = new Map<string, number>();
  for (const s of sessions ?? []) {
    const t = new Date(s.started_at as string).getTime();
    const prev = lastByUser.get(s.user_id as string);
    if (prev === undefined || t > prev) lastByUser.set(s.user_id as string, t);
  }

  const messages: ExpoPushMessage[] = [];
  for (const u of users) {
    const last = lastByUser.get(u.id as string);
    if (last === undefined) continue; // lapsed beyond the window (or never studied)

    const lastDayStart = new Date(last);
    lastDayStart.setUTCHours(0, 0, 0, 0);
    const daysAgo = Math.round((todayStart.getTime() - lastDayStart.getTime()) / DAY_MS);
    if (!MILESTONES.includes(daysAgo)) continue;

    const table = u.selected_pet ? WINBACK_PET : WINBACK;
    const copy = pickCopy(table, u.push_language as string | null, { days: daysAgo });
    messages.push({
      to: u.expo_push_token as string,
      ...copy,
      sound: 'default',
      data: { type: 'winback', days: daysAgo },
    });
  }

  await sendExpoPush(messages);
  return messages.length;
}
