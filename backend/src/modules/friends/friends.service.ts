import { supabase, redis } from '../../shared';
import { checkAndAward } from '../achievements';
import { notifyFriendRequest, notifyFriendAccepted } from '../notifications';
import type {
  FriendEntry,
  FriendRequest,
  BlockedEntry,
  UserSearchResult,
  OnlineStatus,
  RelationshipKind,
} from './friends.schema';

// ─── Redis ────────────────────────────────────────────────────

/** Global online status — written by WS handler on presence:ping */
export const USER_STATUS_KEY = (userId: string) => `user:status:${userId}`;
const STATUS_TTL = 60 * 5; // 5 min

export async function getUserStatus(userId: string): Promise<OnlineStatus> {
  const val = await redis.get(USER_STATUS_KEY(userId));
  return (val as OnlineStatus | null) ?? 'offline';
}

/** Called by the WebSocket handler on every presence:ping */
export async function setUserStatus(userId: string, status: OnlineStatus): Promise<void> {
  await redis.set(USER_STATUS_KEY(userId), status, 'EX', STATUS_TTL);
}

// ─── Internal Helpers ─────────────────────────────────────────

/** Fetch a single row in either direction (A,B) or (B,A) */
async function findRow(userA: string, userB: string) {
  const { data } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `and(requester_id.eq.${userA},addressee_id.eq.${userB}),` +
      `and(requester_id.eq.${userB},addressee_id.eq.${userA})`,
    )
    .limit(1)
    .maybeSingle();
  return data as {
    requester_id: string;
    addressee_id: string;
    status: string;
    created_at: string;
  } | null;
}

/** Fetch all friendship rows involving a user */
async function allRowsFor(userId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, status, created_at')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return (data ?? []) as {
    requester_id: string;
    addressee_id: string;
    status: string;
    created_at: string;
  }[];
}

/** Delete any row between two users regardless of direction */
async function deleteRow(userA: string, userB: string): Promise<void> {
  await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${userA},addressee_id.eq.${userB}),` +
      `and(requester_id.eq.${userB},addressee_id.eq.${userA})`,
    );
}

/** Fetch slim user profile */
async function getUser(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('id, username, avatar_url, level, selected_frame, selected_pet')
    .eq('id', userId)
    .single();
  return data as { id: string; username: string; avatar_url: string | null; level: number; selected_frame: string | null; selected_pet: string | null } | null;
}

// ─── Send Friend Request ──────────────────────────────────────

export async function sendRequest(callerId: string, targetId: string): Promise<void> {
  if (callerId === targetId) {
    throw Object.assign(new Error('Cannot send a request to yourself'), { code: 'SELF' });
  }

  // Verify target user exists
  const target = await getUser(targetId);
  if (!target) throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });

  const existing = await findRow(callerId, targetId);

  if (existing) {
    if (existing.status === 'accepted') {
      throw Object.assign(new Error('Already friends'), { code: 'DUPLICATE' });
    }
    if (existing.status === 'pending') {
      // If THEY already sent us a request, auto-accept
      if (existing.requester_id === targetId && existing.addressee_id === callerId) {
        await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('requester_id', targetId)
          .eq('addressee_id', callerId);
        void getUser(callerId).then((me) => me && notifyFriendAccepted(targetId, me.username));
        return;
      }
      throw Object.assign(new Error('Request already sent'), { code: 'DUPLICATE' });
    }
    if (existing.status === 'blocked') {
      // requester_id is the blocker
      if (existing.requester_id === callerId) {
        throw Object.assign(new Error('Unblock this user before adding them'), { code: 'BLOCKED' });
      }
      throw Object.assign(new Error('This user has blocked you'), { code: 'BLOCKED' });
    }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: callerId, addressee_id: targetId, status: 'pending' });

  if (error) throw new Error(error.message);

  void getUser(callerId).then((me) => me && notifyFriendRequest(targetId, me.username));
}

// ─── Accept / Decline ─────────────────────────────────────────

export async function acceptRequest(callerId: string, requesterId: string): Promise<void> {
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('requester_id', requesterId)
    .eq('addressee_id', callerId)
    .eq('status', 'pending')
    .select('requester_id')
    .single();

  if (error || !data) {
    throw Object.assign(new Error('No pending request from this user'), { code: 'NOT_FOUND' });
  }

  // Check social_butterfly for both parties (fire-and-forget)
  const countFor = async (uid: string): Promise<number> => {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
    return count ?? 0;
  };

  void Promise.all([
    countFor(callerId).then((n) => checkAndAward(callerId, { friendCount: n })),
    countFor(requesterId).then((n) => checkAndAward(requesterId, { friendCount: n })),
  ]);

  void getUser(callerId).then((me) => me && notifyFriendAccepted(requesterId, me.username));
}

export async function declineRequest(callerId: string, requesterId: string): Promise<void> {
  const { data, error } = await supabase
    .from('friendships')
    .delete()
    .eq('requester_id', requesterId)
    .eq('addressee_id', callerId)
    .eq('status', 'pending')
    .select('requester_id')
    .single();

  if (error || !data) {
    throw Object.assign(new Error('No pending request from this user'), { code: 'NOT_FOUND' });
  }
}

// ─── Block ────────────────────────────────────────────────────

export async function blockUser(callerId: string, targetId: string): Promise<void> {
  if (callerId === targetId) {
    throw Object.assign(new Error('Cannot block yourself'), { code: 'SELF' });
  }

  const target = await getUser(targetId);
  if (!target) throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });

  // Wipe any existing row, then insert block
  await deleteRow(callerId, targetId);

  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: callerId, addressee_id: targetId, status: 'blocked' });

  if (error) throw new Error(error.message);
}

// ─── Remove / Unblock ─────────────────────────────────────────

export async function removeFriend(callerId: string, targetId: string): Promise<void> {
  const existing = await findRow(callerId, targetId);
  if (!existing) {
    throw Object.assign(new Error('No relationship with this user'), { code: 'NOT_FOUND' });
  }
  if (existing.status === 'blocked' && existing.requester_id !== callerId) {
    throw Object.assign(new Error('You cannot remove a block placed by another user'), { code: 'FORBIDDEN' });
  }
  await deleteRow(callerId, targetId);
}

// ─── Read Queries ─────────────────────────────────────────────

export async function listFriends(callerId: string): Promise<FriendEntry[]> {
  const rows = await allRowsFor(callerId);
  const accepted = rows.filter((r) => r.status === 'accepted');

  const entries = await Promise.all(
    accepted.map(async (row) => {
      const friendId = row.requester_id === callerId ? row.addressee_id : row.requester_id;
      const user = await getUser(friendId);
      if (!user) return null;
      const online_status = await getUserStatus(friendId);
      return {
        user_id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        frame: user.selected_frame,
        pet: user.selected_pet,
        level: user.level,
        friends_since: row.created_at,
        online_status,
      } satisfies FriendEntry;
    }),
  );

  return entries.filter((e): e is FriendEntry => e !== null);
}

export async function listIncomingRequests(callerId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, created_at, users!friendships_requester_id_fkey(username, avatar_url, level)')
    .eq('addressee_id', callerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const u = row.users as unknown as { username: string; avatar_url: string | null; level: number };
    return {
      user_id: row.requester_id as string,
      username: u.username,
      avatar_url: u.avatar_url,
      level: u.level,
      requested_at: row.created_at as string,
    } satisfies FriendRequest;
  });
}

export async function listSentRequests(callerId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('addressee_id, created_at, users!friendships_addressee_id_fkey(username, avatar_url, level)')
    .eq('requester_id', callerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const u = row.users as unknown as { username: string; avatar_url: string | null; level: number };
    return {
      user_id: row.addressee_id as string,
      username: u.username,
      avatar_url: u.avatar_url,
      level: u.level,
      requested_at: row.created_at as string,
    } satisfies FriendRequest;
  });
}

export async function listBlocked(callerId: string): Promise<BlockedEntry[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('addressee_id, created_at, users!friendships_addressee_id_fkey(username, avatar_url)')
    .eq('requester_id', callerId)
    .eq('status', 'blocked')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const u = row.users as unknown as { username: string; avatar_url: string | null };
    return {
      user_id: row.addressee_id as string,
      username: u.username,
      avatar_url: u.avatar_url,
      blocked_at: row.created_at as string,
    } satisfies BlockedEntry;
  });
}

// ─── User Search ──────────────────────────────────────────────

export async function searchUsers(callerId: string, q: string, limit: number): Promise<UserSearchResult[]> {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, level')
    .ilike('username', `%${q}%`)
    .neq('id', callerId)
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!users || users.length === 0) return [];

  // Build a relationship map from all existing rows involving caller
  const rows = await allRowsFor(callerId);
  const relMap = new Map<string, RelationshipKind>();

  for (const row of rows) {
    const otherId = row.requester_id === callerId ? row.addressee_id : row.requester_id;
    if (row.status === 'accepted') {
      relMap.set(otherId, 'friend');
    } else if (row.status === 'pending') {
      relMap.set(otherId, row.requester_id === callerId ? 'request_sent' : 'request_received');
    } else if (row.status === 'blocked') {
      relMap.set(otherId, row.requester_id === callerId ? 'blocked_by_me' : 'blocked_by_them');
    }
  }

  return users.map((u) => ({
    user_id: u.id as string,
    username: u.username as string,
    avatar_url: u.avatar_url as string | null,
    level: u.level as number,
    relationship: relMap.get(u.id) ?? 'none',
  }));
}
