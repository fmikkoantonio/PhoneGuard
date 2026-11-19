package com.phoneguard

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PinModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PhoneGuardPin"

    @ReactMethod
    fun savePin(pin: String, promise: Promise) {
        try {
            if (AlarmModule.isAlarmActive()) {
                promise.reject(
                    "ALARM_ACTIVE",
                    "PIN cannot be changed while the alarm is active."
                )
                return
            }

            PinSecurity.savePin(reactContext, pin)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("PIN_SAVE_ERROR", error.message, error)
        }
    }

    @ReactMethod
    fun verifyPin(pin: String, promise: Promise) {
        try {
            promise.resolve(PinSecurity.verifyPin(reactContext, pin))
        } catch (error: Exception) {
            promise.reject("PIN_VERIFY_ERROR", error.message, error)
        }
    }

    @ReactMethod
    fun hasPin(promise: Promise) {
        try {
            promise.resolve(PinSecurity.hasPin(reactContext))
        } catch (error: Exception) {
            promise.reject("PIN_CHECK_ERROR", error.message, error)
        }
    }

    @ReactMethod
    fun removePin(promise: Promise) {
        try {
            if (AlarmModule.isAlarmActive()) {
                promise.reject(
                    "ALARM_ACTIVE",
                    "PIN cannot be removed while the alarm is active."
                )
                return
            }

            PinSecurity.removePin(reactContext)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("PIN_REMOVE_ERROR", error.message, error)
        }
    }
}
