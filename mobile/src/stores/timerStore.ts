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

  // Focus Score telemetry — accumulated over the session, sent on stop
  exits: number;       // app→background transitions while running
  awayMs: number;      // total ms spent outside the app while running
  pauses: number;      // number of pauses
  _bgAt: number | null; // epoch ms of the current background spell (null if foreground)

  // Data
  subjects: Subject[];
  stats: TimerStats | null;

  // Ticker
  _interval: ReturnType<typeof setInterval> | null;

  /**
   * Fired when a session finishes NATURALLY (countdown reached zero) — not on
   * manual stop. The Pomodoro cycle (and the classic-mode receipt) hook in here.
   */
  _onComplete: ((result: StopTimerResult | null) => void) | null;
  setOnComplete: (cb: ((result: StopTimerResult | null) => void) | null) => void;

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

  // Focus Score telemetry (driven by the AppState listener in useFocusTracking)
  noteBackground: () => void;
  noteForeground: () => void;
}

const INITIAL: Omit<
  TimerStore,
  'start' | 'pause' | 'resume' | 'stop' | 'syncWithServer' | 'tick' | 'loadSubjects' | 'loadStats' | 'reset'
  | '_onComplete' | 'setOnComplete' | 'noteBackground' | 'noteForeground'
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
  exits: 0,
  awayMs: 0,
  pauses: 0,
  _bgAt: null,
  subjects: [],
  stats: null,
  _interval: null,
};

export const useTimerStore = create<TimerStore>((set, get) => {
  /**
   * Ticker ownership lives in these two helpers, and they always read the
   * CURRENT interval — never one snapshotted before an `await`.
   *
   * That distinction was the bug: `syncWithServer` grabbed `_interval` before
   * its network call and cleared only that one afterwards. Anything that
   * installed a ticker during the call (`start`, another sync, the socket's
   * `timer:started` echo) got its interval overwritten but never cleared, so
   * the orphan kept calling `tick()` — and re-rendering every subscriber —
   * once a second, forever. One leak per session start was enough to saturate
   * the JS thread: the clock froze and touches lagged while the Reanimated
   * animations, which live on the UI thread, kept playing.
   *
   * `tickerSeq` is the safety net: an orphan that somehow survives notices it
   * is no longer the live ticker on its next fire and clears itself.
   */
  let tickerSeq = 0;

  const stopTicker = () => {
    const iv = get()._interval;
    if (iv) clearInterval(iv);
    tickerSeq += 1;
    set({ _interval: null });
  };

  const startTicker = () => {
    const iv = get()._interval;
    if (iv) clearInterval(iv);
    const mine = ++tickerSeq;
    const next = setInterval(() => {
      if (mine !== tickerSeq) { clearInterval(next); return; } // orphan: self-heal
      get().tick();
    }, 1000);
    set({ _interval: next });
  };

  /**
   * Overlapping syncs collapse onto one request. Mount, app-foreground and the
   * socket's `timer:started` all fire within a second of each other, and each
   * used to race the others for ticker ownership.
   */
  let syncInFlight: Promise<void> | null = null;

  return {
  ...INITIAL,
  _onComplete: null,
  setOnComplete: (cb) => set({ _onComplete: cb }),

  // ── Focus Score telemetry ──────────────────────────────────────────────
  // Only count leaving while genuinely focusing: a paused session is a
  // legitimate way to step away, so it doesn't hurt the presence score.
  noteBackground: () => {
    const s = get();
    if (!s.isActive || s.isPaused || s._bgAt !== null) return;
    set({ _bgAt: Date.now(), exits: s.exits + 1 });
  },
  noteForeground: () => {
    const s = get();
    if (s._bgAt === null) return;
    set({ awayMs: s.awayMs + (Date.now() - s._bgAt), _bgAt: null });
  },

  tick: () => {
    const s = get();
    if (!s.isActive || s.isPaused) return;
    const elapsed = s.accumulatedMs + (Date.now() - s.startTime);
    const remaining = Math.max(0, s.duration * 60_000 - elapsed);
    set({ elapsedMs: elapsed, remainingMs: remaining });
    if (remaining === 0) {
      // Natural completion — stop, then let subscribers (pomodoro cycle,
      // classic receipt) react to the finished session's rewards.
      void get()
        .stop()
        .then((result) => get()._onComplete?.(result))
        .catch(() => { /* stop() already restored state for retry */ });
    }
  },

  start: async (duration, subjectId) => {
    set({ isLoading: true });
    try {
      const { state } = await timerService.start(duration, subjectId);
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
        exits: 0,
        awayMs: 0,
        pauses: 0,
        _bgAt: null,
      });
      startTicker();
    } finally {
      set({ isLoading: false });
    }
  },

  pause: async () => {
    // 1️⃣ Stop ticker immediately — no more ticks
    stopTicker();

    // 2️⃣ Optimistic update: mark paused NOW so tick() guard works.
    //    Also close any in-flight away spell and count the pause (Focus Score).
    const bg = get()._bgAt;
    set({
      isLoading: true,
      isPaused: true,
      pauses: get().pauses + 1,
      awayMs: get().awayMs + (bg !== null ? Date.now() - bg : 0),
      _bgAt: null,
    });

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
        set({ isPaused: false });
        startTicker();
      }
    }
  },

  resume: async () => {
    set({ isLoading: true });
    let apiFailed = false;
    try {
      const { state } = await timerService.resume();
      set({
        startTime: state.startTime,
        accumulatedMs: state.accumulatedMs,
        isPaused: false,
      });
      startTicker();
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
    stopTicker();
    // Snapshot Focus Score telemetry, folding in any still-open away spell.
    const s = get();
    const telemetry = {
      exits: s.exits,
      awayMs: s.awayMs + (s._bgAt !== null ? Date.now() - s._bgAt : 0),
      pauses: s.pauses,
    };
    set({ isLoading: true });
    try {
      const { result } = await timerService.stop(telemetry);
      set({ ...INITIAL });
      return result;
    } catch (err: any) {
      if (err?.statusCode === 404) {
        // Server has no session → safe to reset locally (already gone on server)
        set({ ...INITIAL });
        return null;
      }
      // Network / server error — restore ticker so user can retry
      startTicker();
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  syncWithServer: async () => {
    // 🛑 Guard 1: skip if an operation is already in flight
    if (get().isLoading) return;

    // 🛑 Guard 2: one request for however many callers ask at once.
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
      try {
        const status = await timerService.status();

        // 🛑 Guard 3: if pause/resume/stop started WHILE we were awaiting the
        //    status response, bail out — don't overwrite their optimistic state.
        if (get().isLoading) return;

        if (!status.active) {
          stopTicker();
          set({ ...INITIAL });
          return;
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

        // Ticker state follows the server's verdict, and always replaces
        // whatever is running right now — not what was running before the call.
        if (status.isPaused) stopTicker();
        else startTicker();
      } catch { /* network error — keep local state */ }
    })();

    try {
      await syncInFlight;
    } finally {
      syncInFlight = null;
    }
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
    stopTicker();
    set({ ...INITIAL });
  },
  };
});
