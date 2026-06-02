import { api } from './api';
import type { FriendEntry, FriendRequest, UserSearchResult } from '../types';

// ── Raw API shapes (backend returns snake_case) ───────────────────

interface RawFriend {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  online_status: 'studying' | 'break' | 'offline';
  friends_since: string;
}

interface RawRequest {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  requested_at: string;
}

interface RawSearchUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  relationship: 'none' | 'friend' | 'request_sent' | 'request_received' | 'blocked_by_me' | 'blocked_by_them';
}

/** Map backend relationship enum → mobile UI enum */
const REL_MAP: Record<RawSearchUser['relationship'], UserSearchResult['relationship']> = {
  none: 'none',
  friend: 'friends',
  request_sent: 'pending_sent',
  request_received: 'pending_received',
  blocked_by_me: 'blocked',
  blocked_by_them: 'blocked',
};

// ── Service ───────────────────────────────────────────────────────

export const friendsService = {
  /** Returns the caller's friends list */
  list: async (): Promise<FriendEntry[]> => {
    const data = await api.get<{ friends: RawFriend[] }>('/friends');
    return data.friends.map((f) => ({
      friendId: f.user_id,
      username: f.username,
      avatarUrl: f.avatar_url,
      level: f.level,
      status: f.online_status,
      friendsSince: f.friends_since,
    }));
  },

  /** Returns all friend requests (incoming + outgoing) */
  listRequests: async (): Promise<FriendRequest[]> => {
    const [inc, out] = await Promise.all([
      api.get<{ requests: RawRequest[] }>('/friends/requests'),
      api.get<{ requests: RawRequest[] }>('/friends/sent'),
    ]);
    const map = (r: RawRequest, direction: 'incoming' | 'outgoing'): FriendRequest => ({
      userId: r.user_id,
      username: r.username,
      avatarUrl: r.avatar_url,
      level: r.level,
      direction,
      status: 'pending',
      requestedAt: r.requested_at,
    });
    return [
      ...inc.requests.map((r) => map(r, 'incoming')),
      ...out.requests.map((r) => map(r, 'outgoing')),
    ];
  },

  /** Search users by username fragment */
  search: async (q: string, limit = 20): Promise<UserSearchResult[]> => {
    const data = await api.get<{ users: RawSearchUser[] }>(
      `/friends/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    );
    return data.users.map((u) => ({
      id: u.user_id,
      username: u.username,
      avatarUrl: u.avatar_url,
      level: u.level,
      relationship: REL_MAP[u.relationship] ?? 'none',
    }));
  },

  /** Send a friend request to a user */
  sendRequest: (userId: string) =>
    api.post<{ message: string }>('/friends/request', { userId }),

  /** Accept an incoming friend request (keyed on the requester's user id) */
  acceptRequest: (userId: string) =>
    api.post<{ message: string }>(`/friends/${userId}/accept`),

  /** Decline an incoming friend request (keyed on the requester's user id) */
  declineRequest: (userId: string) =>
    api.post<{ message: string }>(`/friends/${userId}/decline`),

  /** Remove an existing friend */
  remove: (userId: string) =>
    api.delete<void>(`/friends/${userId}`),

  /** Block a user */
  block: (userId: string) =>
    api.post<{ message: string }>(`/friends/${userId}/block`),
};
