import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import ws from 'ws';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    realtime: {
      // ws tipi WebSocketLikeConstructor ile uyumsuz (address: string|URL vs null)
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
