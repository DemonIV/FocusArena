import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../utils/storage';

/**
 * Pomodoro cycle state — 4 focus rounds with short breaks in between.
 *
 * Each focus round is an ordinary backend session (XP/coins/streak all work
 * unchanged); only the break/round choreography lives here, client-side.
 * Persisted so an app kill mid-cycle doesn't lose the round position.
 */

export type TimerMode = 'classic' | 'pomodoro';
export type PomodoroPresetId = 'classic' | 'deep';

export interface PomodoroPreset {
  focus: number;     // minutes per round
  brk: number;       // short break minutes
  longBrk: number;   // suggested long break after the cycle
}

export const POMODORO_PRESETS: Record<PomodoroPresetId, PomodoroPreset> = {
  classic: { focus: 25, brk: 5, longBrk: 15 },
  deep: { focus: 50, brk: 10, longBrk: 20 },
};

export const ROUNDS_PER_CYCLE = 4;

/**
 * idle      — no cycle running (mode picker visible)
 * focus     — a round's session is running (timerStore owns the countdown)
 * break     — short break counting down (client-side, breakEndsAt)
 * awaitNext — break over (or skipped); waiting for the user to start the next round
 * done      — all rounds finished; summary visible
 */
export type PomodoroPhase = 'idle' | 'focus' | 'break' | 'awaitNext' | 'done';

interface PomodoroState {
  mode: TimerMode;
  presetId: PomodoroPresetId;
  phase: PomodoroPhase;
  /** 1-based round currently running / about to run */
  round: number;
  /** Epoch ms when the current break ends (phase === 'break') */
  breakEndsAt: number | null;
  /**
   * Id of the scheduled "break over" local notification. Persisted so an app
   * relaunch mid-break doesn't schedule a duplicate.
   */
  breakNotifId: string | null;
  setBreakNotifId: (id: string | null) => void;

  // Cycle totals for the end-of-cycle summary (and, later, Focus Score data)
  totalMinutes: number;
  totalXp: number;
  totalCoins: number;
  lastStreak: number;
  breaksSkipped: number;

  setMode: (mode: TimerMode) => void;
  setPresetId: (id: PomodoroPresetId) => void;

  /** Round 1 is starting — reset totals. */
  beginCycle: () => void;
  /** A round's session finished naturally — accumulate & move to break/done. */
  completeRound: (r: { durationMinutes: number; xpEarned: number; coinsEarned: number; newStreak: number }) => void;
  /** User tapped "skip break" — logged for the future Focus Score. */
  skipBreak: () => void;
  /** Break countdown reached zero. */
  breakOver: () => void;
  /** Next round's session actually started. */
  startedNextRound: () => void;
  /** Manual stop / failure mid-cycle — drop the cycle entirely. */
  abortCycle: () => void;
  /** Leave the summary screen. */
  finishCycle: () => void;
}

const CYCLE_RESET = {
  phase: 'idle' as PomodoroPhase,
  round: 1,
  breakEndsAt: null,
  breakNotifId: null,
  totalMinutes: 0,
  totalXp: 0,
  totalCoins: 0,
  lastStreak: 0,
  breaksSkipped: 0,
};

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      mode: 'classic',
      presetId: 'classic',
      ...CYCLE_RESET,

      setMode: (mode) => set({ mode }),
      setPresetId: (presetId) => set({ presetId }),
      setBreakNotifId: (breakNotifId) => set({ breakNotifId }),

      beginCycle: () => set({ ...CYCLE_RESET, phase: 'focus' }),

      completeRound: (r) => {
        const s = get();
        const totals = {
          totalMinutes: s.totalMinutes + r.durationMinutes,
          totalXp: s.totalXp + r.xpEarned,
          totalCoins: s.totalCoins + r.coinsEarned,
          lastStreak: r.newStreak,
        };
        if (s.round >= ROUNDS_PER_CYCLE) {
          set({ ...totals, phase: 'done', breakEndsAt: null });
        } else {
          const brkMs = POMODORO_PRESETS[s.presetId].brk * 60_000;
          set({ ...totals, phase: 'break', breakEndsAt: Date.now() + brkMs });
        }
      },

      skipBreak: () =>
        set((s) => ({
          breaksSkipped: s.breaksSkipped + 1,
          phase: 'awaitNext',
          breakEndsAt: null,
          breakNotifId: null,
        })),

      breakOver: () => set({ phase: 'awaitNext', breakEndsAt: null, breakNotifId: null }),

      startedNextRound: () => set((s) => ({ round: s.round + 1, phase: 'focus' })),

      abortCycle: () => set({ ...CYCLE_RESET }),
      finishCycle: () => set({ ...CYCLE_RESET }),
    }),
    {
      name: 'pomodoro',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
