import { api } from './api';
import type {
  TimerStatusResponse,
  StopTimerResult,
  TimerStats,
  HeatmapResponse,
  MonthlyStats,
  GhostInfo,
  DnaInfo,
  BossInfo,
  Subject,
  SubjectStat,
  Session,
} from '../types';

interface StartResult { state: import('../types').ActiveTimerState }
interface StopResponse { result: StopTimerResult }
interface StateResponse { state: import('../types').ActiveTimerState }

export const timerService = {
  // ── Timer Control ────────────────────────────────────────
  start: (duration: number, subjectId?: string) =>
    api.post<StartResult>('/timer/start', { duration, subjectId }),

  pause: () =>
    api.post<StateResponse>('/timer/pause'),

  resume: () =>
    api.post<StateResponse>('/timer/resume'),

  stop: () =>
    api.post<StopResponse>('/timer/stop'),

  /** Pay coins to save a strict-mode session after leaving the app */
  rescue: () =>
    api.post<{ coins: number; cost: number }>('/timer/rescue'),

  status: () =>
    api.get<TimerStatusResponse>('/timer/status'),

  // ── History & Stats ──────────────────────────────────────
  sessions: (params?: { page?: number; limit?: number; from?: string; to?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : '';
    return api.get<{ sessions: Session[]; total: number; page: number; totalPages: number }>(
      `/timer/sessions${qs}`,
    );
  },

  /** Flat stats for profile/home screens */
  getStats: () =>
    api.get<TimerStats>('/timer/stats'),

  /** Daily focus minutes for the activity heat map (default last 30 days) */
  getHeatmap: (days = 30) =>
    api.get<HeatmapResponse>(`/timer/heatmap?days=${days}`),

  /**
   * Calendar-month day-by-day + per-subject stats. Own stats when userId is
   * omitted; a friend's when given (backend enforces the friendship).
   */
  getMonthly: (month?: string, userId?: string) => {
    const qs = new URLSearchParams();
    if (month) qs.set('month', month);
    if (userId) qs.set('userId', userId);
    const q = qs.toString();
    return api.get<MonthlyStats>(`/timer/monthly${q ? `?${q}` : ''}`);
  },

  /** Ghost race vs. yesterday-you at the same point in the day */
  getGhost: () =>
    api.get<GhostInfo>('/timer/ghost'),

  /** Shareable "Study DNA" personality snapshot */
  getDNA: () =>
    api.get<DnaInfo>('/timer/dna'),

  /** Weekly global Boss Battle progress */
  getBoss: () =>
    api.get<BossInfo>('/timer/boss'),

  // ── Subjects ─────────────────────────────────────────────
  /** Returns subjects array directly */
  getSubjects: async (): Promise<Subject[]> => {
    const data = await api.get<{ subjects: Subject[] }>('/timer/subjects');
    return data.subjects;
  },

  /** Returns subjects enriched with total focus time */
  getSubjectStats: () =>
    api.get<{ subjects: SubjectStat[] }>('/timer/subjects/stats'),

  createSubject: (body: { name: string; color: string; icon: string; daily_goal_minutes?: number }) =>
    api.post<{ subject: Subject }>('/timer/subjects', body),

  updateSubject: (id: string, body: Partial<{ name: string; color: string; icon: string; daily_goal_minutes: number; is_active: boolean }>) =>
    api.patch<{ subject: Subject }>(`/timer/subjects/${id}`, body),

  deleteSubject: (id: string) =>
    api.delete<void>(`/timer/subjects/${id}`),
};
