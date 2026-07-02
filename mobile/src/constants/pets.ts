/**
 * Pet catalog — animated companions bought with coins.
 * Ids + prices mirror the backend catalog (cosmetics.schema.ts);
 * the server is the source of truth for prices and evolution stage.
 *
 * Animations: Google Noto Animated Emoji (CC BY 4.0) — bundled Lottie JSONs.
 */

import type { AnimationObject } from 'lottie-react-native';

export interface PetVisual {
  id: string;
  price: number;      // display only — server resolves the real price
  /** Lottie animation source (bundled JSON) */
  lottie: AnimationObject;
  /** Emoji stand-in for compact rows (leaderboard, friends) */
  emoji: string;
  /** Pro-exclusive — unlocked by the subscription, not coins */
  pro?: boolean;
}

/** Shared "egg" animation shown until a newly bought pet hatches (1h focus). */
export const PET_EGG_LOTTIE: AnimationObject = require('../../assets/pets/hatching_chick.json');

export const PETS: readonly PetVisual[] = [
  { id: 'unicorn', price: 0,     lottie: require('../../assets/pets/unicorn.json'), emoji: '🦄', pro: true },
  { id: 'turtle',  price: 2000,  lottie: require('../../assets/pets/turtle.json'),  emoji: '🐢' },
  { id: 'panda',   price: 8000,  lottie: require('../../assets/pets/panda.json'),   emoji: '🐼' },
  { id: 'fox',     price: 15000, lottie: require('../../assets/pets/fox.json'),     emoji: '🦊' },
  { id: 'owl',     price: 25000, lottie: require('../../assets/pets/owl.json'),     emoji: '🦉' },
  { id: 'dragon',  price: 50000, lottie: require('../../assets/pets/dragon.json'),  emoji: '🐉' },
] as const;

export function getPetVisual(petId: string | null | undefined): PetVisual | undefined {
  if (!petId) return undefined;
  return PETS.find((p) => p.id === petId);
}

/** Emoji for compact social rows — undefined when the user has no pet equipped. */
export function getPetEmoji(petId: string | null | undefined): string | undefined {
  return getPetVisual(petId)?.emoji;
}
