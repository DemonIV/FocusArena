import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'focusarena' });

/** Zustand-compatible StateStorage backed by MMKV */
export const mmkvStorage = {
  getItem: (name: string): string | null =>
    storage.getString(name) ?? null,
  setItem: (name: string, value: string): void =>
    storage.set(name, value),
  removeItem: (name: string): void =>
    storage.delete(name),
};
