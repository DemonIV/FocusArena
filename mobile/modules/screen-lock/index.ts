import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Native "ScreenLock" module — null on platforms/builds where it isn't linked
 * (e.g. Expo Go). Consumers must guard for null. See src/services/screenLock.ts.
 */
export default requireOptionalNativeModule('ScreenLock');
