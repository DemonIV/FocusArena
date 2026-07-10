package expo.modules.screenlock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * ScreenLock — reports whether the screen turned off (device locked) since the
 * last `reset()`, so a focus reminder fires only when the user switched to
 * another app, not when they locked the phone to study.
 *
 * Android is reliable here: ACTION_SCREEN_OFF fires on lock/screen-off, while
 * an app-switch leaves the screen on. The receiver is registered dynamically
 * (screen state broadcasts can't be declared in the manifest).
 */
class ScreenLockModule : Module() {
  private var lockedSinceReset = false
  private var receiver: BroadcastReceiver? = null

  private val appContextOrNull: Context?
    get() = appContext.reactContext?.applicationContext

  override fun definition() = ModuleDefinition {
    Name("ScreenLock")

    Function("reset") {
      lockedSinceReset = false
    }

    Function("consumeLocked") {
      val value = lockedSinceReset
      lockedSinceReset = false
      value
    }

    OnCreate {
      val ctx = appContextOrNull ?: return@OnCreate
      val r = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent?.action == Intent.ACTION_SCREEN_OFF) {
            lockedSinceReset = true
          }
        }
      }
      receiver = r
      val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
      if (Build.VERSION.SDK_INT >= 34) {
        ctx.registerReceiver(r, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        ctx.registerReceiver(r, filter)
      }
    }

    OnDestroy {
      receiver?.let {
        try {
          appContextOrNull?.unregisterReceiver(it)
        } catch (_: Exception) {
        }
      }
      receiver = null
    }
  }
}
