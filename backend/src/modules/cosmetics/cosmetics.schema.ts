// ─── Frame Catalog ────────────────────────────────────────────
// Single source of truth for frame ids + coin prices. The mobile
// app mirrors the ids for visuals/names but NEVER sends a price —
// the server always resolves the price from this catalog.

export interface FrameDef {
  id: string;
  price: number; // coins
}

export const FRAME_CATALOG: readonly FrameDef[] = [
  { id: 'bronze',   price: 100 },
  { id: 'silver',   price: 1000 },
  { id: 'gold',     price: 2000 },
  { id: 'emerald',  price: 3000 },
  { id: 'ruby',     price: 4000 },
  { id: 'sapphire', price: 5000 },
  { id: 'amethyst', price: 6000 },
  { id: 'neon',     price: 7000 },
  { id: 'aurora',   price: 8000 },
  { id: 'inferno',  price: 9000 },
  { id: 'legend',   price: 10000 },
] as const;

export function getFrameDef(frameId: string): FrameDef | undefined {
  return FRAME_CATALOG.find((f) => f.id === frameId);
}

// ─── Response Shapes ─────────────────────────────────────────

export interface FrameListEntry {
  id: string;
  price: number;
  owned: boolean;
}

export interface FramesResponse {
  coins: number;
  selectedFrame: string | null;
  frames: FrameListEntry[];
}
