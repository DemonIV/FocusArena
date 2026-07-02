import { randomBytes } from 'crypto';
import { supabase, redis } from '../../shared';
import { checkAndAward } from '../achievements';
import type {
  CreateRoomBody,
  UpdateRoomBody,
  JoinRoomBody,
  JoinByCodeBody,
  ListRoomsQuery,
  RoomDetail,
  RoomSummary,
  RoomMemberWithPresence,
  MemberStatus,
} from './rooms.schema';

// ─── Redis Keys ───────────────────────────────────────────────

const INVITE_TTL = 60 * 60 * 24 * 7; // 7 days
const PRESENCE_TTL = 60 * 5;          // 5 min — refreshed by WS ping

const key = {
  inviteCode: (code: string) => `room:invite:code:${code}`,      // code → roomId
  inviteRoom: (roomId: string) => `room:invite:room:${roomId}`,  // roomId → code
  presence: (roomId: string, userId: string) => `room:presence:${roomId}:${userId}`,
};

// ─── Invite Code Helpers ──────────────────────────────────────

async function generateInviteCode(roomId: string): Promise<string> {
  // Delete any existing code for this room first
  const old = await redis.get(key.inviteRoom(roomId));
  if (old) await redis.del(key.inviteCode(old));

  const code = randomBytes(4).toString('hex').toUpperCase(); // e.g., "A3F9C2B1"
  await Promise.all([
    redis.set(key.inviteCode(code), roomId, 'EX', INVITE_TTL),
    redis.set(key.inviteRoom(roomId), code, 'EX', INVITE_TTL),
  ]);
  return code;
}

async function getInviteCode(roomId: string): Promise<string | null> {
  return redis.get(key.inviteRoom(roomId));
}

async function resolveInviteCode(code: string): Promise<string | null> {
  return redis.get(key.inviteCode(code));
}

async function deleteInviteCodes(roomId: string): Promise<void> {
  const code = await redis.get(key.inviteRoom(roomId));
  const keys = [key.inviteRoom(roomId)];
  if (code) keys.push(key.inviteCode(code));
  await redis.del(...keys);
}

// ─── Presence Helpers ─────────────────────────────────────────

export async function setPresence(
  userId: string,
  roomId: string,
  status: MemberStatus,
): Promise<void> {
  await redis.set(key.presence(roomId, userId), status, 'EX', PRESENCE_TTL);
}

async function getPresence(roomId: string, userId: string): Promise<MemberStatus> {
  const status = await redis.get(key.presence(roomId, userId));
  return (status as MemberStatus | null) ?? 'offline';
}

// ─── Member Count Helpers ─────────────────────────────────────

async function activeMemberCount(roomId: string): Promise<number> {
  const { count } = await supabase
    .from('room_members')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('is_active', true);
  return count ?? 0;
}

async function batchMemberCounts(roomIds: string[]): Promise<Map<string, number>> {
  if (roomIds.length === 0) return new Map();

  const { data } = await supabase
    .from('room_members')
    .select('room_id')
    .in('room_id', roomIds)
    .eq('is_active', true);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.room_id, (counts.get(row.room_id) ?? 0) + 1);
  }
  // Ensure every id has an entry
  for (const id of roomIds) if (!counts.has(id)) counts.set(id, 0);
  return counts;
}

// ─── Room Member List (DB + Presence) ────────────────────────

export async function getRoomMembers(roomId: string): Promise<RoomMemberWithPresence[]> {
  const { data, error } = await supabase
    .from('room_members')
    .select('user_id, joined_at, users!inner(username, avatar_url, selected_frame)')
    .eq('room_id', roomId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);

  // Per-member study minutes for this room (single query)
  const { data: minutesRows } = await supabase
    .from('room_member_minutes')
    .select('user_id, total_minutes')
    .eq('room_id', roomId);

  const minutesMap = new Map<string, number>();
  for (const m of minutesRows ?? []) minutesMap.set(m.user_id, m.total_minutes);

  const members = await Promise.all(
    (data ?? []).map(async (row) => {
      const u = row.users as unknown as { username: string; avatar_url: string | null; selected_frame: string | null };
      const status = await getPresence(roomId, row.user_id);
      return {
        user_id: row.user_id as string,
        username: u.username,
        avatar_url: u.avatar_url,
        frame: u.selected_frame,
        joined_at: row.joined_at as string,
        status,
        total_minutes: minutesMap.get(row.user_id) ?? 0,
      } satisfies RoomMemberWithPresence;
    }),
  );

  return members;
}

/**
 * Add `minutes` of study time to every room the user is an active member of.
 * Called when a focus session ends (fire-and-forget). Atomic via Postgres RPC.
 */
export async function addStudyMinutesToRooms(userId: string, minutes: number): Promise<void> {
  if (minutes <= 0) return;
  const { error } = await supabase.rpc('add_study_minutes_to_rooms', {
    p_user_id: userId,
    p_minutes: minutes,
  });
  if (error) throw new Error(error.message);
}

/** Number of rooms a user owns (for the per-user create limit) */
async function ownedRoomCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('rooms')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);
  return count ?? 0;
}

/** Max rooms a single user may own */
export const MAX_OWNED_ROOMS = 2;

// ─── List Public Rooms ────────────────────────────────────────

export async function listPublicRooms(query: ListRoomsQuery): Promise<{
  rooms: RoomSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { page, limit, search } = query;
  const offset = (page - 1) * limit;

  let q = supabase
    .from('rooms')
    .select('*', { count: 'exact' })
    .eq('is_private', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) q = q.ilike('name', `%${search}%`);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rooms = data ?? [];
  const counts = await batchMemberCounts(rooms.map((r) => r.id));

  const summaries: RoomSummary[] = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    owner_id: r.owner_id,
    is_private: r.is_private,
    max_members: r.max_members,
    created_at: r.created_at,
    member_count: counts.get(r.id) ?? 0,
  }));

  return { rooms: summaries, total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) };
}

// ─── My Rooms ─────────────────────────────────────────────────

export async function getMyRooms(userId: string): Promise<RoomSummary[]> {
  const { data, error } = await supabase
    .from('room_members')
    .select('rooms!inner(id, name, owner_id, is_private, max_members, created_at)')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw new Error(error.message);

  const rooms = (data ?? []).map((row) => row.rooms as unknown as {
    id: string; name: string; owner_id: string;
    is_private: boolean; max_members: number; created_at: string;
  });

  const counts = await batchMemberCounts(rooms.map((r) => r.id));

  return Promise.all(
    rooms.map(async (r) => {
      const summary: RoomSummary = { ...r, member_count: counts.get(r.id) ?? 0 };
      // Attach the invite code for rooms the caller owns (shown in their Profile)
      if (r.owner_id === userId) {
        summary.invite_code = (await getInviteCode(r.id)) ?? undefined;
      }
      return summary;
    }),
  );
}

// ─── Get Room Detail ──────────────────────────────────────────

export async function getRoomById(userId: string, roomId: string): Promise<RoomDetail> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error || !room) throw Object.assign(new Error('Room not found'), { code: 'NOT_FOUND' });

  // Access check for private rooms
  if (room.is_private) {
    const { data: membership } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!membership && room.owner_id !== userId) {
      throw Object.assign(new Error('Room not found'), { code: 'NOT_FOUND' });
    }
  }

  const members = await getRoomMembers(roomId);
  const detail: RoomDetail = {
    id: room.id,
    name: room.name,
    owner_id: room.owner_id,
    is_private: room.is_private,
    max_members: room.max_members,
    created_at: room.created_at,
    member_count: members.length,
    members,
  };

  // Expose invite code only to the owner of a private room
  if (room.is_private && room.owner_id === userId) {
    detail.invite_code = (await getInviteCode(roomId)) ?? undefined;
  }

  return detail;
}

// ─── Create Room ──────────────────────────────────────────────

export async function createRoom(userId: string, body: CreateRoomBody): Promise<RoomDetail> {
  // Per-user room ownership limit
  const owned = await ownedRoomCount(userId);
  if (owned >= MAX_OWNED_ROOMS) {
    throw Object.assign(
      new Error(`You can own at most ${MAX_OWNED_ROOMS} rooms. Delete one to create another.`),
      { code: 'ROOM_LIMIT' },
    );
  }

  // All rooms are private (invite-code only). Public room creation is disabled.
  const { data: room, error } = await supabase
    .from('rooms')
    .insert({ ...body, is_private: true, owner_id: userId })
    .select('*')
    .single();

  if (error || !room) throw new Error(error?.message ?? 'Failed to create room');

  // Owner joins immediately as first member
  await supabase.from('room_members').insert({
    room_id: room.id,
    user_id: userId,
    is_active: true,
  });

  await setPresence(userId, room.id, 'offline');

  const detail: RoomDetail = {
    id: room.id,
    name: room.name,
    owner_id: room.owner_id,
    is_private: room.is_private,
    max_members: room.max_members,
    created_at: room.created_at,
    member_count: 1,
    members: [],
  };

  // Every room is private → always has an invite code
  detail.invite_code = await generateInviteCode(room.id);

  // Fetch full member list after creation
  detail.members = await getRoomMembers(room.id);

  // Award room_host badge (fire-and-forget)
  void checkAndAward(userId, { isRoomHost: true });

  return detail;
}

// ─── Update Room ──────────────────────────────────────────────

export async function updateRoom(
  userId: string,
  roomId: string,
  body: UpdateRoomBody,
): Promise<RoomDetail> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('owner_id, is_private, max_members')
    .eq('id', roomId)
    .single();

  if (error || !room) throw Object.assign(new Error('Room not found'), { code: 'NOT_FOUND' });
  if (room.owner_id !== userId) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });

  // Guard: cannot shrink max_members below current active count
  if (body.max_members !== undefined) {
    const count = await activeMemberCount(roomId);
    if (body.max_members < count) {
      throw Object.assign(
        new Error(`Cannot set max_members below current member count (${count})`),
        { code: 'VALIDATION' },
      );
    }
  }

  const { error: updateErr } = await supabase
    .from('rooms')
    .update(body)
    .eq('id', roomId);

  if (updateErr) throw new Error(updateErr.message);

  // Invite code lifecycle when privacy changes
  const newIsPrivate = body.is_private ?? room.is_private;
  if (body.is_private === true && !room.is_private) {
    await generateInviteCode(roomId);
  } else if (body.is_private === false && room.is_private) {
    await deleteInviteCodes(roomId);
  }

  return getRoomById(userId, roomId);
}

// ─── Delete Room ──────────────────────────────────────────────

export async function deleteRoom(userId: string, roomId: string): Promise<void> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('owner_id')
    .eq('id', roomId)
    .single();

  if (error || !room) throw Object.assign(new Error('Room not found'), { code: 'NOT_FOUND' });
  if (room.owner_id !== userId) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });

  await supabase.from('rooms').delete().eq('id', roomId); // cascades room_members
  await deleteInviteCodes(roomId);
}

// ─── Join Room ────────────────────────────────────────────────

export async function joinRoom(
  userId: string,
  roomId: string,
  body: JoinRoomBody,
): Promise<RoomDetail> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error || !room) throw Object.assign(new Error('Room not found'), { code: 'NOT_FOUND' });

  // Private room — validate invite code
  if (room.is_private) {
    if (!body.inviteCode) {
      throw Object.assign(new Error('Invite code required for private rooms'), { code: 'FORBIDDEN' });
    }
    const resolvedRoomId = await resolveInviteCode(body.inviteCode);
    if (resolvedRoomId !== roomId) {
      throw Object.assign(new Error('Invalid or expired invite code'), { code: 'FORBIDDEN' });
    }
  }

  // Capacity check
  const count = await activeMemberCount(roomId);
  if (count >= room.max_members) {
    throw Object.assign(new Error('Room is full'), { code: 'ROOM_FULL' });
  }

  // Upsert membership (handles re-joining after leaving)
  const { data: existing } = await supabase
    .from('room_members')
    .select('user_id, is_active')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .single();

  if (existing?.is_active) {
    throw Object.assign(new Error('Already a member of this room'), { code: 'ALREADY_MEMBER' });
  }

  if (existing) {
    await supabase
      .from('room_members')
      .update({ is_active: true, joined_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  } else {
    await supabase.from('room_members').insert({ room_id: roomId, user_id: userId, is_active: true });
  }

  await setPresence(userId, roomId, 'offline');
  return getRoomById(userId, roomId);
}

// ─── Leave Room ───────────────────────────────────────────────

export async function leaveRoom(
  userId: string,
  roomId: string,
): Promise<{ deleted: boolean; newOwnerId?: string }> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('owner_id')
    .eq('id', roomId)
    .single();

  if (error || !room) throw Object.assign(new Error('Room not found'), { code: 'NOT_FOUND' });

  // Mark membership inactive
  const { error: leaveErr } = await supabase
    .from('room_members')
    .update({ is_active: false })
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (leaveErr) throw new Error(leaveErr.message);

  // Remove presence
  await redis.del(key.presence(roomId, userId));

  // If leaving user was owner, transfer or delete
  if (room.owner_id === userId) {
    const { data: remaining } = await supabase
      .from('room_members')
      .select('user_id, joined_at')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1);

    if (!remaining || remaining.length === 0) {
      // No one left — delete the room
      await supabase.from('rooms').delete().eq('id', roomId);
      await deleteInviteCodes(roomId);
      return { deleted: true };
    }

    // Transfer ownership to the earliest remaining member
    const newOwner = remaining[0].user_id;
    await supabase.from('rooms').update({ owner_id: newOwner }).eq('id', roomId);
    return { deleted: false, newOwnerId: newOwner };
  }

  return { deleted: false };
}

// ─── Join Room by Invite Code ─────────────────────────────────

export async function joinByCode(
  userId: string,
  body: JoinByCodeBody,
): Promise<{ roomId: string; room: RoomDetail }> {
  const roomId = await resolveInviteCode(body.code);
  if (!roomId) {
    throw Object.assign(new Error('Invalid or expired invite code'), { code: 'NOT_FOUND' });
  }

  const room = await joinRoom(userId, roomId, { inviteCode: body.code });
  return { roomId, room };
}

// ─── Regenerate Invite Code ───────────────────────────────────

export async function regenerateInvite(userId: string, roomId: string): Promise<string> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('owner_id, is_private')
    .eq('id', roomId)
    .single();

  if (error || !room) throw Object.assign(new Error('Room not found'), { code: 'NOT_FOUND' });
  if (room.owner_id !== userId) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
  if (!room.is_private) throw Object.assign(new Error('Room is not private'), { code: 'VALIDATION' });

  return generateInviteCode(roomId);
}
