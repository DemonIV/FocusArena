import { z } from 'zod';

// ─── Request Schemas ──────────────────────────────────────────

export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(60),
  is_private: z.boolean().default(false),
  max_members: z.number().int().min(2).max(50).default(10),
});

export const UpdateRoomSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  is_private: z.boolean().optional(),
  max_members: z.number().int().min(2).max(50).optional(),
});

export const JoinRoomSchema = z.object({
  inviteCode: z.string().optional(),
});

export const JoinByCodeSchema = z.object({
  code: z.string().min(1),
});

export const ListRoomsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().max(60).optional(),
});

// ─── Derived Types ────────────────────────────────────────────

export type CreateRoomBody = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomBody = z.infer<typeof UpdateRoomSchema>;
export type JoinRoomBody = z.infer<typeof JoinRoomSchema>;
export type JoinByCodeBody = z.infer<typeof JoinByCodeSchema>;
export type ListRoomsQuery = z.infer<typeof ListRoomsQuerySchema>;

// ─── Response Shapes ─────────────────────────────────────────

export type MemberStatus = 'studying' | 'break' | 'offline';

export interface RoomMemberWithPresence {
  user_id: string;
  username: string;
  avatar_url: string | null;
  joined_at: string;
  status: MemberStatus;
}

export interface RoomDetail {
  id: string;
  name: string;
  owner_id: string;
  is_private: boolean;
  max_members: number;
  created_at: string;
  member_count: number;
  members: RoomMemberWithPresence[];
  /** Defined only for the owner of a private room */
  invite_code?: string;
}

export interface RoomSummary {
  id: string;
  name: string;
  owner_id: string;
  is_private: boolean;
  max_members: number;
  created_at: string;
  member_count: number;
}
