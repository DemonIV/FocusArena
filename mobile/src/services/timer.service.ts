import { api } from './api';
import type {
  TimerStatusResponse,
  StopTimerResult,
  TimerStats,
  Subject,
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

  // ── Subjects ─────────────────────────────────────────────
  /** Returns subjects array directly */
  getSubjects: async (): Promise<Subject[]> => {
    const data = await api.get<{ subjects: Subject[] }>('/timer/subjects');
    return data.subjects;
  },

  createSubject: (body: { name: string; color: string; icon: string; daily_goal_minutes?: number }) =>
    api.post<{ subject: Subject }>('/timer/subjects', body),

  updateSubject: (id: string, body: Partial<{ name: string; color: string; icon: string; daily_goal_minutes: number; is_active: boolean }>) =>
    api.patch<{ subject: Subject }>(`/timer/subjects/${id}`, body),

  deleteSubject: (id: string) =>
    api.delete<void>(`/timer/subjects/${id}`),
};
