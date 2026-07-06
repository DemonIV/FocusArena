import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import ws from 'ws';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    // This client must ALWAYS query as service_role. Never let it adopt a
    // user session (signInWithPassword on a shared client hijacks every
    // later query onto that user's JWT → RLS silently filters rows).
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      // ws tipi WebSocketLikeConstructor ile uyumsuz (address: string|URL vs null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transport: ws as any,
    },
  }
);

/**
 * Isolated client for Supabase *Auth* operations only (sign-in checks,
 * admin create/delete). Password sign-ins attach the user's session to the
 * client they run on — keeping them off the main `supabase` client above
 * guarantees data queries always run with the service key.
 */
export const supabaseAuth = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transport: ws as any,
    },
  }
);

const isTls = process.env.REDIS_URL?.startsWith('rediss://');

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  ...(isTls && { tls: {} }),
});
