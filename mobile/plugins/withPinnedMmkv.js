const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * react-native-mmkv only asks for "MMKV >= 1.3.3", so every CI build resolves
 * whatever CocoaPods considers newest. MMKV 2.4.1 (July 2026) added a
 * secure_wipe() that calls memset_s, which is not declared when the pod's
 * prefix header pulls in <string.h> before __STDC_WANT_LIB_EXT1__ is set —
 * the iOS 26 SDK then fails with "use of undeclared identifier 'memset_s'"
 * (Tencent/MMKV#1675). Same commit built fine on 2.4.0 a week earlier.
 *
 * Pin both pods until upstream ships a fix, then delete this plugin.
 */
const PINNED_VERSION = '2.4.0';

const PIN_BLOCK = [
  '',
  "  # Pinned: MMKV 2.4.1 does not compile against the iOS 26 SDK (memset_s).",
  '  # See Tencent/MMKV#1675 — drop this once upstream releases a fix.',
  `  pod 'MMKV', '${PINNED_VERSION}'`,
  `  pod 'MMKVCore', '${PINNED_VERSION}'`,
].join('\n');

/** Insert the pins into the app target of a generated Podfile. */
function addMmkvPin(contents) {
  if (contents.includes("pod 'MMKVCore'")) {
    return contents;
  }

  // Preferred anchor: the Expo template opens its app target with this call.
  const useExpoModules = /^[ \t]*use_expo_modules!.*$/m;
  if (useExpoModules.test(contents)) {
    return contents.replace(useExpoModules, (line) => `${line}\n${PIN_BLOCK}`);
  }

  // Fallback: first target block.
  const targetLine = /^target ['"][^'"]+['"] do$/m;
  if (targetLine.test(contents)) {
    return contents.replace(targetLine, (line) => `${line}\n${PIN_BLOCK}`);
  }

  throw new Error(
    '[withPinnedMmkv] Could not find an anchor in the Podfile. The Expo template ' +
      'changed — update this plugin or remove it if MMKV is fixed upstream.'
  );
}

const withPinnedMmkv = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, addMmkvPin(contents), 'utf8');
      return cfg;
    },
  ]);

module.exports = withPinnedMmkv;
module.exports.addMmkvPin = addMmkvPin;
