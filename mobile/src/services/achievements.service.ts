import { api } from './api';
import type { AchievementEntry, LockedAchievement, TitleEntry } from '../types';

interface RawEarned {
  id: string;
  badge_type: string;
  earned_at: string;
  meta: { label: string; description: string; icon: string };
}

interface RawLocked {
  badge_type: string;
  meta: { label: string; description: string; icon: string };
}

interface AchievementsResponse {
  earned: AchievementEntry[];
  locked: LockedAchievement[];
  titles: TitleEntry[];
  selectedTitle: string | null;
}

export const achievementsService = {
  mine: async (): Promise<AchievementsResponse> => {
    const data = await api.get<{
      earned: RawEarned[];
      locked: RawLocked[];
      titles?: TitleEntry[];
      selectedTitle?: string | null;
    }>('/achievements');
    return {
      earned: data.earned.map((e) => ({
        id: e.id,
        badge_type: e.badge_type,
        earned_at: e.earned_at,
        icon: e.meta.icon,
        label: e.meta.label,
        description: e.meta.description,
      })),
      locked: data.locked.map((l) => ({
        badge_type: l.badge_type,
        icon: l.meta.icon,
        label: l.meta.label,
        description: l.meta.description,
      })),
      titles: data.titles ?? [],
      selectedTitle: data.selectedTitle ?? null,
    };
  },

  /** Set (or clear with null) the caller's selected profile title. */
  setTitle: (title: string | null) =>
    api.put<{ selectedTitle: string | null }>('/achievements/title', { title }),

  forUser: (userId: string) =>
    api.get<{ earned: RawEarned[] }>(`/achievements/${userId}`),
};
