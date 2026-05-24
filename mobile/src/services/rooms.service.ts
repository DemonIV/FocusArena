import { api } from './api';
import type { Room, RoomDetail } from '../types';

// ── Raw API shapes ────────────────────────────────────────────────

interface RawRoom {
  id: string;
  name: string;
  owner_id: string;
  topic?: string;
  is_public: boolean;
  max_members: number;
  member_count: number;
  created_at: string;
}

function mapRoom(r: RawRoom): Room {
  return {
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    topic: r.topic,
    isPublic: r.is_public,
    maxMembers: r.max_members,
    memberCount: r.member_count,
    createdAt: r.created_at,
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

  /** Single room detail */
  get: (id: string) =>
    api.get<RoomDetail>(`/rooms/${id}`),

  /** Create a new room */
  create: (body: { name: string; topic?: string; isPublic?: boolean; maxMembers?: number }) =>
    api.post<{ room: RawRoom }>('/rooms', {
      name: body.name,
      topic: body.topic,
      is_public: body.isPublic ?? true,
      max_members: body.maxMembers,
    }),

  update: (id: string, body: { name?: string; isPublic?: boolean; maxMembers?: number }) =>
    api.patch<{ room: RawRoom }>(`/rooms/${id}`, {
      name: body.name,
      is_public: body.isPublic,
      max_members: body.maxMembers,
    }),

  delete: (id: string) =>
    api.delete<void>(`/rooms/${id}`),

  /** Join a room by its ID */
  join: (id: string) =>
    api.post<{ room: RawRoom }>(`/rooms/${id}/join`),

  /** Join a room using an invite code (resolves to room ID server-side) */
  joinByCode: (code: string) =>
    api.post<{ roomId: string; room: RawRoom }>('/rooms/join-by-code', { code }),

  leave: (id: string) =>
    api.post<{ deleted: boolean; newOwnerId: string | null }>(`/rooms/${id}/leave`),

  /** Regenerate invite code for a room you own */
  regenerateInvite: (id: string) =>
    api.post<{ inviteCode: string }>(`/rooms/${id}/invite`),
};
