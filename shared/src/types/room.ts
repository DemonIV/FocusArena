export type MemberStatus = 'studying' | 'break' | 'offline';

export interface Room {
  id: string;
  name: string;
  owner_id: string;
  is_private: boolean;
  max_members: number;
  created_at: string;
}

export interface RoomMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status: MemberStatus;
  joined_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  rank: number;
}

export interface Friendship {
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}
