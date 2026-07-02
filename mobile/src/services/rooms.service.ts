import { api } from './api';
import type { Room, RoomDetail, RoomMember } from '../types';

// ── Raw API shapes (backend returns snake_case + is_private) ──────

interface RawRoom {
  id: string;
  name: string;
  owner_id: string;
  is_private: boolean;
  max_members: number;
  member_count: number;
  created_at: string;
  invite_code?: string;
}

interface RawMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  frame?: string | null;
  pet?: string | null;
  joined_at: string;
  status: 'studying' | 'break' | 'offline';
  total_minutes: number;
}

interface RawRoomDetail extends Omit<RawRoom, 'member_count'> {
  member_count: number;
  members: RawMember[];
  invite_code?: string;
}

function mapRoom(r: RawRoom): Room {
  return {
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    isPublic: !r.is_private,
    maxMembers: r.max_members,
    memberCount: r.member_count,
    createdAt: r.created_at,
    inviteCode: r.invite_code,
  };
}

function mapMember(m: RawMember): RoomMember {
  return {
    userId: m.user_id,
    username: m.username,
    avatarUrl: m.avatar_url,
    frame: m.frame ?? null,
    pet: m.pet ?? null,
    joinedAt: m.joined_at,
    status: m.status,
    totalMinutes: m.total_minutes ?? 0,
  };
}

function mapRoomDetail(r: RawRoomDetail): RoomDetail {
  return {
    ...mapRoom(r),
    members: (r.members ?? []).map(mapMember),
    inviteCode: r.invite_code,
  };
}

// ── Service ───────────────────────────────────────────────────────

export const roomsService = {
  /** List public rooms */
  list: async (params?: { page?: number; limit?: number; search?: string }): Promise<Room[]> => {
    const qs = params
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : '';
    const data = await api.get<{ rooms: RawRoom[] }>(`/rooms${qs}`);
    return data.rooms.map(mapRoom);
  },

  /** Rooms the current user is a member of */
  mine: async (): Promise<Room[]> => {
    const data = await api.get<{ rooms: RawRoom[] }>('/rooms/mine');
    return data.rooms.map(mapRoom);
  },

  /** Single room detail (members + invite code for owner) */
  get: async (id: string): Promise<RoomDetail> => {
    const data = await api.get<RawRoomDetail>(`/rooms/${id}`);
    return mapRoomDetail(data);
  },

  /** Create a new (private) room. Returns the room + its invite code. */
  create: async (body: { name: string; maxMembers?: number }): Promise<RoomDetail> => {
    const data = await api.post<{ room: RawRoomDetail }>('/rooms', {
      name: body.name,
      is_private: true,
      max_members: body.maxMembers,
    });
    return mapRoomDetail(data.room);
  },

  update: (id: string, body: { name?: string; isPublic?: boolean; maxMembers?: number }) =>
    api.patch<{ room: RawRoomDetail }>(`/rooms/${id}`, {
      name: body.name,
      is_private: body.isPublic === undefined ? undefined : !body.isPublic,
      max_members: body.maxMembers,
    }),

  delete: (id: string) =>
    api.delete<void>(`/rooms/${id}`),

  /** Join a public room by its ID */
  join: (id: string) =>
    api.post<{ room: RawRoomDetail }>(`/rooms/${id}/join`),

  /** Join a room using an invite code (resolves to room ID server-side) */
  joinByCode: (code: string) =>
    api.post<{ roomId: string; room: RawRoomDetail }>('/rooms/join-by-code', { code }),

  leave: (id: string) =>
    api.post<{ deleted: boolean; newOwnerId: string | null }>(`/rooms/${id}/leave`),

  /** Regenerate invite code for a room you own */
  regenerateInvite: async (id: string): Promise<string> => {
    const data = await api.post<{ invite_code: string }>(`/rooms/${id}/invite`);
    return data.invite_code;
  },
};
