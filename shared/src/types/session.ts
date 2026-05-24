export interface Session {
  id: string;
  user_id: string;
  subject_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  was_completed: boolean;
  synced: boolean;
}

export interface TimerState {
  sessionId: string;
  startTime: number;
  duration: number;
  isPaused: boolean;
  pausedAt?: number;
  subjectId?: string;
}

export interface DailyStat {
  date: string;
  total_minutes: number;
  sessions_count: number;
  completed_sessions: number;
}
