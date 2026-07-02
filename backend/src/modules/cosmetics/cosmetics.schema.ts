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

// ─── Pet Catalog ──────────────────────────────────────────────
// Animated companions (Noto Animated Emoji lotties on the client).
// Same rules as frames: server owns prices, Pro pets are unlocked by
// the subscription instead of coins.

export interface PetDef {
  id: string;
  price: number; // coins
  /** Pro-exclusive: not purchasable with coins, equippable while Pro is active. */
  pro?: boolean;
}

export const PET_CATALOG: readonly PetDef[] = [
  { id: 'unicorn', price: 0, pro: true },
  { id: 'turtle',  price: 2000 },
  { id: 'panda',   price: 8000 },
  { id: 'fox',     price: 15000 },
  { id: 'owl',     price: 25000 },
  { id: 'dragon',  price: 50000 },
] as const;

export function getPetDef(petId: string): PetDef | undefined {
  return PET_CATALOG.find((p) => p.id === petId);
}

// ─── Pet Evolution ────────────────────────────────────────────
// Pets grow with the focus minutes earned while owning them:
// egg (hatches after 1h of focus) → baby → adult (after 10h).

export type PetStage = 'egg' | 'baby' | 'adult';

export const PET_HATCH_MINUTES = 60;
export const PET_ADULT_MINUTES = 600;

export function petStage(minutesTogether: number): PetStage {
  if (minutesTogether < PET_HATCH_MINUTES) return 'egg';
  if (minutesTogether < PET_ADULT_MINUTES) return 'baby';
  return 'adult';
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

export interface PetListEntry {
  id: string;
  price: number;
  owned: boolean;
  /** Pro-exclusive pet — owned mirrors the caller's Pro status. */
  pro?: boolean;
  /** Focus minutes earned while owning this pet (owned pets only). */
  minutesTogether?: number;
  /** Evolution stage derived from minutesTogether (owned pets only). */
  stage?: PetStage;
}

export interface PetsResponse {
  coins: number;
  selectedPet: string | null;
  pets: PetListEntry[];
}
