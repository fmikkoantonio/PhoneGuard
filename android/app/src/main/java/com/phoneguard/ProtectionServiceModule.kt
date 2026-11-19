package com.phoneguard

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ProtectionServiceModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PhoneGuardProtection"

    @ReactMethod
    fun startProtection(promise: Promise) {
        try {
            ProtectionService.start(reactContext)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject(
                "PROTECTION_START_ERROR",
                error.message ?: "Unable to start protection service.",
                error
            )
        }
    }

    @ReactMethod
    fun stopProtection(promise: Promise) {
        try {
            ProtectionService.stop(reactContext)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject(
                "PROTECTION_STOP_ERROR",
                error.message ?: "Unable to stop protection service.",
                error
            )
        }
    }

    @ReactMethod
    fun updateSensitivity(
        sensitivity: String,
        promise: Promise
    ) {
        try {
            val normalizedSensitivity = sensitivity.uppercase()

            MotionSensitivity.valueOf(normalizedSensitivity)

            ProtectionService.updateSensitivity(
                reactContext,
                normalizedSensitivity
            )

            promise.resolve(true)
        } catch (error: IllegalArgumentException) {
            promise.reject(
                "INVALID_SENSITIVITY",
                "Sensitivity must be Low, Medium, or High.",
                error
            )
        } catch (error: Exception) {
            promise.reject(
                "SENSITIVITY_UPDATE_ERROR",
                error.message ?: "Unable to update motion sensitivity.",
                error
            )
        }
    }

    @ReactMethod
    fun updateCountdownDuration(
        seconds: Int,
        promise: Promise
    ) {
        try {
            if (seconds !in listOf(3, 5, 10)) {
                promise.reject(
                    "INVALID_COUNTDOWN",
                    "Countdown duration must be 3, 5, or 10 seconds."
                )
                return
            }

            ProtectionService.updateCountdownDuration(
                reactContext,
                seconds
            )

            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject(
                "COUNTDOWN_UPDATE_ERROR",
                error.message ?: "Unable to update countdown duration.",
                error
            )
        }
    }

    @ReactMethod
    fun updateAlarmSettings(
        soundEnabled: Boolean,
        vibrationEnabled: Boolean,
        promise: Promise
    ) {
        try {
            ProtectionService.updateAlarmSettings(
                reactContext,
                soundEnabled,
                vibrationEnabled
            )
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject(
                "ALARM_SETTINGS_UPDATE_ERROR",
                error.message ?: "Unable to update alarm settings.",
                error
            )
        }
    }

    @ReactMethod
    fun isProtectionRunning(promise: Promise) {
        try {
            promise.resolve(ProtectionService.isRunning(reactApplicationContext))
        } catch (error: Exception) {
            promise.reject(
                "PROTECTION_STATUS_ERROR",
                error.message ?: "Unable to read protection service status.",
                error
            )
        }
    }

    @ReactMethod
    fun getCountdownState(promise: Promise) {
        try {
            val countdownState =
                ProtectionService.getCountdownState(reactContext)

            val result = Arguments.createMap().apply {
                putBoolean("isActive", countdownState.first)
                putInt("secondsRemaining", countdownState.second)
            }

            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject(
                "COUNTDOWN_STATE_ERROR",
                error.message ?: "Unable to read countdown state.",
                error
            )
        }
    }
}
