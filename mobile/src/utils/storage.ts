import AsyncStorage from '@react-native-async-storage/async-storage';

/** Zustand-compatible StateStorage backed by AsyncStorage (Expo Go compatible) */
export const mmkvStorage = {
  getItem: (name: string): Promise<string | null> =>
    AsyncStorage.getItem(name),
  setItem: (name: string, value: string): Promise<void> =>
    AsyncStorage.setItem(name, value),
  removeItem: (name: string): Promise<void> =>
    AsyncStorage.removeItem(name),
};
