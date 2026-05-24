import { create } from 'zustand';
import { initSocket, disconnectSocket } from '../services/websocket';
import { useTimerStore } from './timerStore';
import type { LeaderboardEntry } from '../types';

// Raw shape emitted by the server (matches shared/types/room.ts LeaderboardEntry)
interface RawSocketLbEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
}

function mapLbEntry(e: RawSocketLbEntry): LeaderboardEntry {
  return {
    rank: e.rank,
    userId: e.user_id,
    username: e.username,
    avatarUrl: e.avatar_url,
    value: e.score,
    unit: 'min',
  };
}

interface SocketStore {
  isConnected: boolean;
  top10: LeaderboardEntry[];
  friendStatuses: Record<string, string>;   // userId → status

  connect: (token: string) => void;
  disconnect: () => void;
  sendPresence: (status: 'studying' | 'break' | 'offline') => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
}

export const useSocketStore = create<SocketStore>((set) => ({
  isConnected: false,
  top10: [],
  friendStatuses: {},

  connect: (token) => {
    const socket = initSocket(token);

    socket.on('connect', () => set({ isConnected: true }));
    socket.on('disconnect', () => set({ isConnected: false }));

    socket.on('timer:started', ({ sessionId, startedAt }) => {
      // Sync sessionId if started via WS from another device
      useTimerStore.getState().syncWithServer();
      void sessionId; void startedAt;
    });

    socket.on('leaderboard:tick', ({ top10 }) => {
      set({ top10: (top10 as unknown as RawSocketLbEntry[]).map(mapLbEntry) });
    });

    socket.on('friend:status', ({ userId, status }) => {
      set((s) => ({
        friendStatuses: { ...s.friendStatuses, [userId]: status },
      }));
    });

    socket.on('achievement:new', ({ badge }) => {
      // Handled separately per feature (toast notification)
      console.log('[achievement]', badge.badge_type, 'unlocked');
    });

    socket.on('error:session', ({ message }) => {
      console.warn('[socket error:session]', message);
    });
  },

  disconnect: () => {
    disconnectSocket();
    set({ isConnected: false, top10: [], friendStatuses: {} });
  },

  sendPresence: (status) => {
    try {
      const { getSocket } = require('../services/websocket');
      getSocket().emit('presence:ping', { status });
    } catch { /* socket not ready */ }
  },

  joinRoom: (roomId) => {
    try {
      const { getSocket } = require('../services/websocket');
      getSocket().emit('room:join', { roomId });
    } catch { /* socket not ready */ }
  },

  leaveRoom: (roomId) => {
    try {
      const { getSocket } = require('../services/websocket');
      getSocket().emit('room:leave', { roomId });
    } catch { /* socket not ready */ }
  },
}));
