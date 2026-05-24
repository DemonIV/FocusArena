import { api } from './api';
import type { FriendEntry, FriendRequest, UserSearchResult } from '../types';

// ── Raw API shapes ────────────────────────────────────────────────

interface RawFriend {
  friendId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  status: 'studying' | 'break' | 'offline';
  friendsSince: string;
}

interface RawRequest {
  id: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  direction: 'incoming' | 'outgoing';
  requestedAt: string;
}

interface RawSearchUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  relationship: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked';
}

// ── Service ───────────────────────────────────────────────────────

export const friendsService = {
  /** Returns the caller's friends list */
  list: async (): Promise<FriendEntry[]> => {
    const data = await api.get<{ friends: RawFriend[] }>('/friends');
    return data.friends.map((f) => ({
      friendId: f.friendId,
      username: f.username,
      avatarUrl: f.avatarUrl,
      level: f.level,
      status: f.status,
      friendsSince: f.friendsSince,
    }));
  },

  /** Returns all friend requests (incoming + outgoing) */
  listRequests: async (): Promise<FriendRequest[]> => {
    const [inc, out] = await Promise.all([
      api.get<{ requests: RawRequest[] }>('/friends/requests'),
      api.get<{ requests: RawRequest[] }>('/friends/sent'),
    ]);
    return [
      ...inc.requests.map((r) => ({ ...r, direction: 'incoming' as const, status: 'pending' as const })),
      ...out.requests.map((r) => ({ ...r, direction: 'outgoing' as const, status: 'pending' as const })),
    ];
  },

  /** Search users by username fragment */
  search: async (q: string, limit = 20): Promise<UserSearchResult[]> => {
    const data = await api.get<{ users: RawSearchUser[] }>(
      `/friends/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    );
    return data.users;
  },

  /** Send a friend request to a user */
  sendRequest: (userId: string) =>
    api.post<{ message: string }>('/friends/request', { userId }),

  /** Accept an incoming friend request by friendship row id */
  acceptRequest: (friendshipId: string) =>
    api.post<{ message: string }>(`/friends/${friendshipId}/accept`),

  /** Decline an incoming friend request by friendship row id */
  declineRequest: (friendshipId: string) =>
    api.post<{ message: string }>(`/friends/${friendshipId}/decline`),

  /** Remove an existing friend */
  remove: (userId: string) =>
    api.delete<void>(`/friends/${userId}`),

  /** Block a user */
  block: (userId: string) =>
    api.post<{ message: string }>(`/friends/${userId}/block`),
};
