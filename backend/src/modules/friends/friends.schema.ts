import { z } from 'zod';

// ─── Request Schemas ──────────────────────────────────────────

export const SendRequestSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SendRequestBody = z.infer<typeof SendRequestSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// ─── Friendship Status ────────────────────────────────────────

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

/** Relationship of a search result relative to the caller */
export type RelationshipKind =
  | 'none'
  | 'friend'
  | 'request_sent'      // caller sent request to them
  | 'request_received'  // they sent request to caller
  | 'blocked_by_me'
  | 'blocked_by_them';

// ─── Response Shapes ─────────────────────────────────────────

export type OnlineStatus = 'studying' | 'break' | 'offline';

export interface FriendEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  /** Equipped cosmetic frame id (shop) — social display */
  frame: string | null;
  /** Equipped pet id (shop) — social display */
  pet: string | null;
  level: number;
  friends_since: string;
  online_status: OnlineStatus;
}

export interface FriendRequest {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  requested_at: string;
}

export interface BlockedEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  blocked_at: string;
}

export interface UserSearchResult {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  relationship: RelationshipKind;
}
