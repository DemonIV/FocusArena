/**
 * Collectible avatar catalog (client side) — the visual identity for each id.
 * The backend owns the unlock rules + rarity; here we hold colours + display
 * order so AvatarArt can render them. Names / unlock text / rarity labels are
 * localized via i18n (`avatars.<id>.name`, `avatars.<id>.unlock`,
 * `avatarRarity.<rarity>`).
 */
export type AvatarRarity = 'common' | 'rare' | 'epic' | 'legend' | 'mythic';

export interface AvatarVisual {
  c1: string;
  c2: string;
  rarity: AvatarRarity;
}

/** Display order (common → mythic), matching the backend AVATAR_IDS. */
export const AVATAR_ORDER = [
  'spark', 'comet', 'crescent',
  'owl', 'fox', 'deer',
  'nebula', 'whale', 'cat',
  'phoenix', 'dragon',
  'nova', 'blackhole',
] as const;

export type AvatarId = (typeof AVATAR_ORDER)[number];

export const AVATAR_VISUAL: Record<AvatarId, AvatarVisual> = {
  spark:     { c1: '#7DE7FB', c2: '#22D3EE', rarity: 'common' },
  comet:     { c1: '#93C5FD', c2: '#38BDF8', rarity: 'common' },
  crescent:  { c1: '#E9D5FF', c2: '#A78BFA', rarity: 'common' },
  owl:       { c1: '#C4B5FD', c2: '#7C3AED', rarity: 'rare' },
  fox:       { c1: '#FDBA74', c2: '#F472B6', rarity: 'rare' },
  deer:      { c1: '#A7F3D0', c2: '#34D399', rarity: 'rare' },
  nebula:    { c1: '#5EEAD4', c2: '#8B5CF6', rarity: 'epic' },
  whale:     { c1: '#7DD3FC', c2: '#6366F1', rarity: 'epic' },
  cat:       { c1: '#C7B2FF', c2: '#6D28D9', rarity: 'epic' },
  phoenix:   { c1: '#FBBF24', c2: '#F43F5E', rarity: 'legend' },
  dragon:    { c1: '#6EE7B7', c2: '#0EA5E9', rarity: 'legend' },
  nova:      { c1: '#FFE9A8', c2: '#FCA5A5', rarity: 'mythic' },
  blackhole: { c1: '#C4B5FD', c2: '#7C3AED', rarity: 'mythic' },
};

/** Rarity → accent colour (card borders, aura ring, rarity chip). */
export const RARITY_COLOR: Record<AvatarRarity, string> = {
  common: '#64748B',
  rare:   '#22D3EE',
  epic:   '#A855F7',
  legend: '#F59E0B',
  mythic: '#F472B6',
};

/** Number of orbiting aura particles by rarity. */
export const RARITY_PARTICLES: Record<AvatarRarity, number> = {
  common: 0, rare: 2, epic: 3, legend: 5, mythic: 7,
};

export function isAvatarId(v: string | null | undefined): v is AvatarId {
  return !!v && (AVATAR_ORDER as readonly string[]).includes(v);
}
