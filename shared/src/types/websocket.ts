import type { RoomMember, LeaderboardEntry } from './room';
import type { Achievement } from './user';

export interface ClientToServerEvents {
  'timer:start': (payload: { subjectId?: string; duration: number }) => void;
  'timer:pause': (payload: { sessionId: string }) => void;
  'timer:complete': (payload: { sessionId: string }) => void;
  'room:join': (payload: { roomId: string }) => void;
  'room:leave': (payload: { roomId: string }) => void;
  'presence:ping': (payload: { status: 'studying' | 'break' | 'offline' }) => void;
}

export interface ServerToClientEvents {
  'timer:started': (payload: { sessionId: string; startedAt: string }) => void;
  'room:updated': (payload: { members: RoomMember[] }) => void;
  'leaderboard:tick': (payload: { top10: LeaderboardEntry[] }) => void;
  'friend:status': (payload: { userId: string; status: string }) => void;
  'achievement:new': (payload: { badge: Achievement }) => void;
  'error:session': (payload: { message: string }) => void;
  /** Global count of users with an active focus session right now */
  'global:activeCount': (payload: { count: number }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
  username: string;
}
