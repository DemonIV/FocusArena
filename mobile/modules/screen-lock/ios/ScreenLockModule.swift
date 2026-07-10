import ExpoModulesCore
import UIKit

/**
 * ScreenLock — reports whether the device screen was locked since the last
 * `reset()`. Used so a focus reminder fires only when the user switched to
 * ANOTHER APP, not when they simply locked the phone to study.
 *
 * iOS has no reliable, App-Store-safe "screen locked" event, so we use the
 * public `protectedDataWillBecomeUnavailable` signal (fires when a passcode-
 * protected device locks). It can be delayed or, on passcode-less devices, not
 * fire at all — hence this is best-effort. The JS layer fails safe: if a lock
 * can't be confirmed it errs toward "locked" so it never nags on a real lock.
 */
public final class ScreenLockModule: Module {
  private var lockedSinceReset = false
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ScreenLock")

    // Clear the flag at the start of an absence (called when the app backgrounds
    // during a running session).
    Function("reset") {
      self.lockedSinceReset = false
    }

    // Read-and-clear: did the screen lock during the last absence?
    Function("consumeLocked") { () -> Bool in
      let value = self.lockedSinceReset
      self.lockedSinceReset = false
      return value
    }

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: UIApplication.protectedDataWillBecomeUnavailableNotification,
        object: nil,
        queue: nil
      ) { [weak self] _ in
        self?.lockedSinceReset = true
      }
    }

    OnDestroy {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
        self.observer = nil
      }
    }
  }
}
