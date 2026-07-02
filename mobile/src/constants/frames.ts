/**
 * Timer frame catalog — visual definitions.
 * Ids + prices mirror the backend catalog (cosmetics.schema.ts);
 * the server is the source of truth for prices, these are for display.
 */

export interface FrameVisual {
  id: string;
  price: number;      // display only — server resolves the real price
  ring: string;       // progress ring fill while focusing
  glow: string;       // breathing glow color
  outer: string;      // decorative outer ring (always visible)
  outer2?: string;    // second outer ring for premium dual-ring frames
}

export const FRAMES: readonly FrameVisual[] = [
  { id: 'bronze',   price: 100,   ring: '#cd7f32', glow: '#cd7f32', outer: '#cd7f32' },
  { id: 'silver',   price: 1000,  ring: '#c8d0dc', glow: '#c8d0dc', outer: '#c8d0dc' },
  { id: 'gold',     price: 2000,  ring: '#ffd700', glow: '#ffd700', outer: '#ffd700' },
  { id: 'emerald',  price: 3000,  ring: '#10b981', glow: '#34d399', outer: '#10b981' },
  { id: 'ruby',     price: 4000,  ring: '#ef4444', glow: '#f87171', outer: '#ef4444' },
  { id: 'sapphire', price: 5000,  ring: '#3b82f6', glow: '#60a5fa', outer: '#3b82f6' },
  { id: 'amethyst', price: 6000,  ring: '#8b5cf6', glow: '#a78bfa', outer: '#8b5cf6' },
  { id: 'neon',     price: 7000,  ring: '#ff2ec4', glow: '#ff5ed2', outer: '#ff2ec4' },
  { id: 'aurora',   price: 8000,  ring: '#7df9ff', glow: '#a78bfa', outer: '#7df9ff', outer2: '#a78bfa' },
  { id: 'inferno',  price: 9000,  ring: '#ff6b1a', glow: '#ffb703', outer: '#ff6b1a', outer2: '#ffb703' },
  { id: 'legend',   price: 10000, ring: '#ffd700', glow: '#ff2ec4', outer: '#ffd700', outer2: '#ff2ec4' },
] as const;

export function getFrameVisual(frameId: string | null | undefined): FrameVisual | undefined {
  if (!frameId) return undefined;
  return FRAMES.find((f) => f.id === frameId);
}
