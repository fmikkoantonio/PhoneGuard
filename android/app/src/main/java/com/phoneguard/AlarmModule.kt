
package com.phoneguard

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PREFS_NAME = "phoneguard_alarm_security"
        private const val KEY_FAILED_ATTEMPTS = "failed_pin_attempts"
        private const val KEY_LOCKOUT_UNTIL = "pin_lockout_until"

        private const val MAX_FAILED_ATTEMPTS = 5
        private const val LOCKOUT_DURATION_MS = 30_000L

        fun isAlarmActive(): Boolean {
            return AlarmController.isRunning()
        }
    }

    override fun getName(): String = "PhoneGuardAlarm"

    @ReactMethod
    fun startAlarm(
        soundEnabled: Boolean,
        vibrationEnabled: Boolean,
        promise: Promise
    ) {
        try {
            if (!PinSecurity.hasPin(reactApplicationContext)) {
                promise.reject(
                    "PIN_NOT_CONFIGURED",
                    "A security PIN must be configured before starting the alarm."
                )
                return
            }

            if (!soundEnabled && !vibrationEnabled) {
                promise.reject(
                    "NO_ALARM_OUTPUT",
                    "Enable sound or vibration before starting the alarm."
                )
                return
            }

            AlarmController.start(
                reactApplicationContext,
                soundEnabled,
                vibrationEnabled
            )

            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject(
                "ALARM_START_FAILED",
                error.message ?: "Unable to start the security alarm.",
                error
            )
        }
    }

    @ReactMethod
    fun stopAlarm(pin: String, promise: Promise) {
        try {
            val preferences = reactApplicationContext.getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
            )

            val currentTime = System.currentTimeMillis()
            val lockoutUntil = preferences.getLong(
                KEY_LOCKOUT_UNTIL,
                0L
            )

            if (currentTime < lockoutUntil) {
                val remainingSeconds =
                    ((lockoutUntil - currentTime) / 1000L) + 1L

                promise.reject(
                    "PIN_LOCKED",
                    "Too many incorrect attempts. Try again in $remainingSeconds seconds."
                )
                return
            }

            if (!PinSecurity.hasPin(reactApplicationContext)) {
                promise.reject(
                    "PIN_NOT_CONFIGURED",
                    "No security PIN is configured."
                )
                return
            }

            if (!PinSecurity.verifyPin(reactApplicationContext, pin)) {
                val failedAttempts = preferences.getInt(
                    KEY_FAILED_ATTEMPTS,
                    0
                ) + 1

                val editor = preferences.edit()
                    .putInt(KEY_FAILED_ATTEMPTS, failedAttempts)

                if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                    editor.putLong(
                        KEY_LOCKOUT_UNTIL,
                        currentTime + LOCKOUT_DURATION_MS
                    )
                }

                editor.apply()

                if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                    promise.reject(
                        "PIN_LOCKED",
                        "Too many incorrect attempts. Alarm deactivation is locked for 30 seconds."
                    )
                } else {
                    val remainingAttempts =
                        MAX_FAILED_ATTEMPTS - failedAttempts

                    promise.reject(
                        "INVALID_PIN",
                        "Incorrect PIN. $remainingAttempts attempts remaining."
                    )
                }

                return
            }

            preferences.edit()
                .putInt(KEY_FAILED_ATTEMPTS, 0)
                .putLong(KEY_LOCKOUT_UNTIL, 0L)
                .apply()

            AlarmController.stop()

            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject(
                "ALARM_STOP_FAILED",
                error.message ?: "Unable to stop the security alarm.",
                error
            )
        }
    }

    @ReactMethod
    fun isAlarmRunning(promise: Promise) {
        promise.resolve(AlarmController.isRunning())
    }
}
