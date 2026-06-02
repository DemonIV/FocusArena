import { create } from 'zustand';
import { timerService } from '../services/timer.service';
import type { Subject, StopTimerResult, TimerStats } from '../types';

interface TimerStore {
  // Server state
  sessionId: string | null;
  duration: number;
  startTime: number;
  accumulatedMs: number;
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

const INITIAL: Omit<
  TimerStore,
  'start' | 'pause' | 'resume' | 'stop' | 'syncWithServer' | 'tick' | 'loadSubjects' | 'loadStats' | 'reset'
> = {
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
    if (remaining === 0) void get().stop();
  },

  start: async (duration, subjectId) => {
    set({ isLoading: true });
    try {
      const { state } = await timerService.start(duration, subjectId);
      const interval = setInterval(() => get().tick(), 1000);
      set({
        sessionId: state.sessionId,
        duration: state.duration,
        startTime: state.startTime,
        accumulatedMs: 0,
        isPaused: false,
        subjectId: state.subjectId,
        elapsedMs: 0,
        remainingMs: duration * 60_000,
        isActive: true,
        _interval: interval,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  pause: async () => {
    // 1️⃣ Stop ticker immediately — no more ticks
    const { _interval } = get();
    if (_interval) { clearInterval(_interval); set({ _interval: null }); }

    // 2️⃣ Optimistic update: mark paused NOW so tick() guard works
    set({ isLoading: true, isPaused: true });

    let apiFailed = false;
    try {
      const { state } = await timerService.pause();
      // Sync accumulated time from server (authoritative value)
      set({
        accumulatedMs: state.accumulatedMs,
        elapsedMs: state.accumulatedMs,
      });
    } catch {
      apiFailed = true;
    } finally {
      set({ isLoading: false });
    }

    // 3️⃣ If API failed, sync with server to reconcile true state.
    //    (isLoading is now false so syncWithServer guard passes)
    //    - Server says paused  → accept paused state, no ticker needed ✓
    //    - Server says running → restore ticker ✓
    //    - Server says gone   → reset to INITIAL ✓
    if (apiFailed) {
      try {
        await get().syncWithServer();
      } catch {
        // Sync also failed (offline) — full rollback: restore ticker
        const interval = setInterval(() => get().tick(), 1000);
        set({ isPaused: false, _interval: interval });
      }
    }
  },

  resume: async () => {
    set({ isLoading: true });
    let apiFailed = false;
    try {
      const { state } = await timerService.resume();
      const interval = setInterval(() => get().tick(), 1000);
      set({
        startTime: state.startTime,
        accumulatedMs: state.accumulatedMs,
        isPaused: false,
        _interval: interval,
      });
    } catch {
      apiFailed = true;
    } finally {
      set({ isLoading: false });
    }
    // If API failed, sync with server to get true state
    if (apiFailed) {
      try {
        await get().syncWithServer();
      } catch {
        // Offline — keep paused (safest fallback)
      }
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
    } catch (err: any) {
      if (err?.statusCode === 404) {
        // Server has no session → safe to reset locally (already gone on server)
        set({ ...INITIAL });
        return null;
      }
      // Network / server error — restore ticker so user can retry
      const interval = setInterval(() => get().tick(), 1000);
      set({ _interval: interval });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  syncWithServer: async () => {
    // 🛑 Guard 1: skip if an operation is already in flight
    if (get().isLoading) return;

    const currentInterval = get()._interval;
    try {
      const status = await timerService.status();

      // 🛑 Guard 2: if pause/resume/stop started WHILE we were awaiting the
      //    status response, bail out — don't overwrite their optimistic state.
      if (get().isLoading) return;

      if (!status.active) {
        if (currentInterval) clearInterval(currentInterval);
        set({ ...INITIAL });
        return;
      }

      // Kill stale ticker before setting up a fresh one
      if (currentInterval) clearInterval(currentInterval);

      let newInterval: ReturnType<typeof setInterval> | null = null;
      if (!status.isPaused) {
        newInterval = setInterval(() => get().tick(), 1000);
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
        _interval: newInterval,
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
