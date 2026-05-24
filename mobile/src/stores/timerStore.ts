import { create } from 'zustand';
import { timerService } from '../services/timer.service';
import type { Subject, StopTimerResult, TimerStats } from '../types';

interface TimerStore {
  // Server state
  sessionId: string | null;
  duration: number;          // intended minutes
  startTime: number;         // epoch ms of current run segment
  accumulatedMs: number;     // ms from completed run segments
  isPaused: boolean;
  subjectId?: string;

  // Derived / local
  elapsedMs: number;
  remainingMs: number;
  isActive: boolean;
  isLoading: boolean;

  // Data
  subjects: Subject[];
  stats: TimerStats | null;

  // Ticker
  _interval: ReturnType<typeof setInterval> | null;

  // Actions
  start: (duration: number, subjectId?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<StopTimerResult | null>;
  syncWithServer: () => Promise<void>;
  tick: () => void;
  loadSubjects: () => Promise<void>;
  loadStats: () => Promise<void>;
  reset: () => void;
}

const INITIAL: Omit<TimerStore, 'start' | 'pause' | 'resume' | 'stop' | 'syncWithServer' | 'tick' | 'loadSubjects' | 'loadStats' | 'reset'> = {
  sessionId: null,
  duration: 25,
  startTime: 0,
  accumulatedMs: 0,
  isPaused: false,
  subjectId: undefined,
  elapsedMs: 0,
  remainingMs: 0,
  isActive: false,
  isLoading: false,
  subjects: [],
  stats: null,
  _interval: null,
};

export const useTimerStore = create<TimerStore>((set, get) => ({
  ...INITIAL,

  tick: () => {
    const s = get();
    if (!s.isActive || s.isPaused) return;
    const elapsed = s.accumulatedMs + (Date.now() - s.startTime);
    const remaining = Math.max(0, s.duration * 60_000 - elapsed);
    set({ elapsedMs: elapsed, remainingMs: remaining });

    // Auto-stop when timer expires
    if (remaining === 0) void get().stop();
  },

  start: async (duration, subjectId) => {
    set({ isLoading: true });
    try {
      const { state } = await timerService.start(duration, subjectId);
      const elapsed = 0;
      const remaining = duration * 60_000;

      const interval = setInterval(() => get().tick(), 1000);
      set({
        sessionId: state.sessionId,
        duration: state.duration,
        startTime: state.startTime,
        accumulatedMs: 0,
        isPaused: false,
        subjectId: state.subjectId,
        elapsedMs: elapsed,
        remainingMs: remaining,
        isActive: true,
        _interval: interval,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  pause: async () => {
    const { _interval } = get();
    if (_interval) { clearInterval(_interval); set({ _interval: null }); }
    set({ isLoading: true });
    try {
      const { state } = await timerService.pause();
      set({
        accumulatedMs: state.accumulatedMs,
        isPaused: true,
        pausedAt: state.pausedAt,
        elapsedMs: state.accumulatedMs,
      } as Partial<TimerStore>);
    } finally {
      set({ isLoading: false });
    }
  },

  resume: async () => {
    set({ isLoading: true });
    try {
      const { state } = await timerService.resume();
      const interval = setInterval(() => get().tick(), 1000);
      set({
        startTime: state.startTime,
        accumulatedMs: state.accumulatedMs,
        isPaused: false,
        _interval: interval,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  stop: async () => {
    const { _interval } = get();
    if (_interval) { clearInterval(_interval); set({ _interval: null }); }
    set({ isLoading: true });
    try {
      const { result } = await timerService.stop();
      set({ ...INITIAL });
      return result;
    } catch {
      set({ ...INITIAL });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  syncWithServer: async () => {
    const { _interval } = get();
    try {
      const status = await timerService.status();
      if (!status.active) {
        if (_interval) clearInterval(_interval);
        set({ ...INITIAL });
        return;
      }

      if (!get()._interval && !status.isPaused) {
        const interval = setInterval(() => get().tick(), 1000);
        set({ _interval: interval });
      }

      set({
        sessionId: status.sessionId,
        duration: status.duration,
        elapsedMs: status.elapsedMs,
        remainingMs: status.remainingMs,
        isPaused: status.isPaused,
        subjectId: status.subjectId,
        isActive: true,
        accumulatedMs: status.elapsedMs,
        startTime: Date.now(),
      });
    } catch { /* network error — keep local state */ }
  },

  loadSubjects: async () => {
    try {
      const subjects = await timerService.getSubjects();
      set({ subjects });
    } catch { /* ignore */ }
  },

  loadStats: async () => {
    try {
      const stats = await timerService.getStats();
      set({ stats });
    } catch { /* ignore */ }
  },

  reset: () => {
    const { _interval } = get();
    if (_interval) clearInterval(_interval);
    set({ ...INITIAL });
  },
}));
