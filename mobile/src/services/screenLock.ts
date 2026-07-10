import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Thin wrapper over the native ScreenLock module. Everything fails safe: when
 * the module is unavailable (Expo Go, older build) or errors, we report the
 * screen as "locked" so the focus reminder never fires on what might be a lock.
 */
const native = requireOptionalNativeModule('ScreenLock') as
  | { reset: () => void; consumeLocked: () => boolean }
  | null;

export const screenLockAvailable = native != null;

/** Start watching for a screen-lock during the current absence. */
export function resetLockFlag(): void {
  try { native?.reset(); } catch { /* ignore */ }
}

/**
 * Did the screen lock since the last {@link resetLockFlag}? Read-and-clear.
 * Fail-safe: no module / error → `true` (assume locked → suppress the nudge).
 */
export function consumeScreenLocked(): boolean {
  if (!native) return true;
  try { return Boolean(native.consumeLocked()); } catch { return true; }
}
