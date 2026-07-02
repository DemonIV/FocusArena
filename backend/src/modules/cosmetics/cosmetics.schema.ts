// ─── Frame Catalog ────────────────────────────────────────────
// Single source of truth for frame ids + coin prices. The mobile
// app mirrors the ids for visuals/names but NEVER sends a price —
// the server always resolves the price from this catalog.

export interface FrameDef {
  id: string;
  price: number; // coins
  /** Pro-exclusive: not purchasable with coins, equippable while Pro is active. */
  pro?: boolean;
  /**
   * Seasonal cutoff (ISO date): after this moment the frame disappears from
   * the shop for new buyers; existing owners keep and can equip it forever.
   */
  availableUntil?: string;
}

/** Purchasable right now? (no cutoff, or cutoff still in the future) */
export function isFrameAvailable(def: FrameDef): boolean {
  return !def.availableUntil || new Date(def.availableUntil).getTime() > Date.now();
}

export const FRAME_CATALOG: readonly FrameDef[] = [
  // Pro-exclusive animated frames — the visible status symbol of the subscription.
  { id: 'prism',    price: 0, pro: true },
  { id: 'royal',    price: 0, pro: true },
  // Seasonal — Summer 2026 (gone after Aug 31, owners keep it).
  { id: 'summer',   price: 2500, availableUntil: '2026-09-01T00:00:00Z' },
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
  /** Pro-exclusive frame — owned mirrors the caller's Pro status. */
  pro?: boolean;
  /** Seasonal cutoff — present only on limited-time frames. */
  availableUntil?: string | null;
}

export interface FramesResponse {
  coins: number;
  selectedFrame: string | null;
  frames: FrameListEntry[];
}
