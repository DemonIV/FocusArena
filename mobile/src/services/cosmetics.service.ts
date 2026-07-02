import { api } from './api';
import type { FramesResponse } from '../types';

export const cosmeticsService = {
  /** Shop view: coin balance, equipped frame, catalog with ownership. */
  getFrames: async (): Promise<FramesResponse> => {
    return api.get<FramesResponse>('/cosmetics/frames');
  },

  /** Purchase a frame with coins. Returns the new balance. */
  buyFrame: async (frameId: string): Promise<{ coins: number }> => {
    return api.post<{ coins: number }>(`/cosmetics/frames/${frameId}/buy`);
  },

  /** Equip a frame (must be owned) — null resets to the default look. */
  selectFrame: async (frameId: string | null): Promise<void> => {
    await api.post('/cosmetics/frames/select', { frameId });
  },
};
