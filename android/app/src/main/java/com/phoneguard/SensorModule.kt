package com.phoneguard

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class SensorModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), SensorEventListener {

    companion object {
        private const val EVENT_SENSOR_DATA = "PhoneGuardSensorData"
    }

    private val sensorManager =
        reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    private val accelerometer =
        sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private val gyroscope =
        sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    private var isMonitoring = false
    private var listenerCount = 0

    override fun getName(): String = "PhoneGuardSensor"

    @ReactMethod
    fun startSensors(promise: Promise) {
        try {
            if (accelerometer == null) {
                promise.reject(
                    "ACCELEROMETER_UNAVAILABLE",
                    "This device does not have an accelerometer."
                )
                return
            }

            if (isMonitoring) {
                promise.resolve(true)
                return
            }

            val accelerometerRegistered = sensorManager.registerListener(
                this,
                accelerometer,
                SensorManager.SENSOR_DELAY_UI
            )

            val gyroscopeRegistered = gyroscope?.let {
                sensorManager.registerListener(
                    this,
                    it,
                    SensorManager.SENSOR_DELAY_UI
                )
            } ?: false

            if (!accelerometerRegistered) {
                sensorManager.unregisterListener(this)
                promise.reject(
                    "SENSOR_REGISTRATION_FAILED",
                    "Unable to start accelerometer monitoring."
                )
                return
            }

            isMonitoring = true

            val result = Arguments.createMap().apply {
                putBoolean("accelerometerAvailable", accelerometerRegistered)
                putBoolean("gyroscopeAvailable", gyroscopeRegistered)
            }

            promise.resolve(result)
        } catch (error: Exception) {
            sensorManager.unregisterListener(this)
            isMonitoring = false
            promise.reject("SENSOR_START_ERROR", error.message, error)
        }
    }

    @ReactMethod
    fun stopSensors(promise: Promise) {
        try {
            sensorManager.unregisterListener(this)
            isMonitoring = false
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("SENSOR_STOP_ERROR", error.message, error)
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || !isMonitoring) return

        val sensorType = when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> "accelerometer"
            Sensor.TYPE_GYROSCOPE -> "gyroscope"
            else -> return
        }

        val payload = Arguments.createMap().apply {
            putString("sensorType", sensorType)
            putDouble("x", event.values[0].toDouble())
            putDouble("y", event.values[1].toDouble())
            putDouble("z", event.values[2].toDouble())
            putDouble("timestamp", event.timestamp.toDouble())
        }

        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(
                    DeviceEventManagerModule.RCTDeviceEventEmitter::class.java
                )
                .emit(EVENT_SENSOR_DATA, payload)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No accuracy handling is required for the initial sensor test.
    }

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount += 1
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount = (listenerCount - count).coerceAtLeast(0)
    }

    override fun invalidate() {
        sensorManager.unregisterListener(this)
        isMonitoring = false
        listenerCount = 0
        super.invalidate()
    }
}