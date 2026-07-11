/**
 * Pet catalog — animated companions bought with coins.
 * Ids + prices mirror the backend catalog (cosmetics.schema.ts);
 * the server is the source of truth for prices and evolution stage.
 *
 * Animations: Google Noto Animated Emoji (CC BY 4.0) — bundled Lottie JSONs.
 */

import type { AnimationObject } from 'lottie-react-native';

/** Display-only rarity tier — purely cosmetic, prices stay server-authoritative. */
export type PetRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

/** Tier colour used for card borders, rarity chips and the detail-modal glow. */
export const PET_RARITY_COLORS: Record<PetRarity, string> = {
  common: '#94a3b8',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
  mythic: '#ec4899',
};

export interface PetVisual {
  id: string;
  price: number;      // display only — server resolves the real price
  /** Lottie animation source (bundled JSON) */
  lottie: AnimationObject;
  /** Emoji stand-in for compact rows (leaderboard, friends) */
  emoji: string;
  rarity: PetRarity;
  /** Pro-exclusive — unlocked by the subscription, not coins */
  pro?: boolean;
}

/** Shared "egg" animation shown until a newly bought pet hatches (1h focus). */
export const PET_EGG_LOTTIE: AnimationObject = require('../../assets/pets/hatching_chick.json');

export const PETS: readonly PetVisual[] = [
  { id: 'unicorn', price: 0,     lottie: require('../../assets/pets/unicorn.json'), emoji: '🦄', rarity: 'mythic', pro: true },
  { id: 'turtle',  price: 2000,  lottie: require('../../assets/pets/turtle.json'),  emoji: '🐢', rarity: 'common' },
  { id: 'panda',   price: 8000,  lottie: require('../../assets/pets/panda.json'),   emoji: '🐼', rarity: 'rare' },
  { id: 'fox',     price: 15000, lottie: require('../../assets/pets/fox.json'),     emoji: '🦊', rarity: 'rare' },
  { id: 'owl',     price: 25000, lottie: require('../../assets/pets/owl.json'),     emoji: '🦉', rarity: 'epic' },
  { id: 'dragon',  price: 50000, lottie: require('../../assets/pets/dragon.json'),  emoji: '🐉', rarity: 'legendary' },
] as const;

export function getPetVisual(petId: string | null | undefined): PetVisual | undefined {
  if (!petId) return undefined;
  return PETS.find((p) => p.id === petId);
}

/** Emoji for compact social rows — undefined when the user has no pet equipped. */
export function getPetEmoji(petId: string | null | undefined): string | undefined {
  return getPetVisual(petId)?.emoji;
}
