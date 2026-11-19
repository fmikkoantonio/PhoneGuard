
package com.phoneguard

import kotlin.math.pow
import kotlin.math.sqrt

enum class MotionSensitivity {
    LOW,
    MEDIUM,
    HIGH
}

data class MotionDetectionResult(
    val detected: Boolean,
    val accelerationChange: Double,
    val rotationSpeed: Double,
    val reason: String?
)

private data class CalibrationSample(
    val x: Double,
    val y: Double,
    val z: Double
)

class NativeMotionDetector(
    private var sensitivity: MotionSensitivity = MotionSensitivity.MEDIUM
) {

    companion object {
        private const val CALIBRATION_DURATION_MS = 2000L
        private const val MIN_CALIBRATION_SAMPLES = 10

        private val SENSITIVITY_THRESHOLDS =
            mapOf(
                MotionSensitivity.LOW to Pair(3.0, 1.5),
                MotionSensitivity.MEDIUM to Pair(2.0, 0.9),
                MotionSensitivity.HIGH to Pair(1.2, 0.5)
            )
    }

    private val calibrationSamples = mutableListOf<CalibrationSample>()

    private var baseline: CalibrationSample? = null
    private var calibrationStartedAt: Long? = null

    fun setSensitivity(newSensitivity: MotionSensitivity) {
        sensitivity = newSensitivity
    }

    fun reset() {
        calibrationSamples.clear()
        baseline = null
        calibrationStartedAt = null
    }

    fun isCalibrated(): Boolean {
        return baseline != null
    }

    fun getCalibrationProgress(): Int {
        if (baseline != null) {
            return 100
        }

        return minOf(
            100,
            (calibrationSamples.size / 20.0 * 100).toInt()
        )
    }

    fun process(
        sensorType: String,
        x: Double,
        y: Double,
        z: Double
    ): MotionDetectionResult {

        if (baseline == null) {
            collectCalibrationSample(sensorType, x, y, z)

            return emptyResult()
        }

        return when (sensorType) {
            "accelerometer" -> {
                val currentBaseline = baseline ?: return emptyResult()

                val accelerationChange = sqrt(
                    (x - currentBaseline.x).pow(2) +
                    (y - currentBaseline.y).pow(2) +
                    (z - currentBaseline.z).pow(2)
                )

                evaluateMotion(accelerationChange, 0.0)
            }

            "gyroscope" -> {
                val rotationSpeed = sqrt(
                    x * x + y * y + z * z
                )

                evaluateMotion(0.0, rotationSpeed)
            }

            else -> emptyResult()
        }
    }

    private fun collectCalibrationSample(
        sensorType: String,
        x: Double,
        y: Double,
        z: Double
    ) {
        if (sensorType != "accelerometer") {
            return
        }

        val now = System.currentTimeMillis()

        if (calibrationStartedAt == null) {
            calibrationStartedAt = now
        }

        val startedAt = calibrationStartedAt ?: return

        if (now - startedAt > CALIBRATION_DURATION_MS) {
            if (calibrationSamples.size < MIN_CALIBRATION_SAMPLES) {
                reset()
                return
            }

            calculateBaseline()
            return
        }

        calibrationSamples.add(
            CalibrationSample(x, y, z)
        )
    }

    private fun calculateBaseline() {
        val count = calibrationSamples.size

        if (count == 0) {
            return
        }

        val totalX = calibrationSamples.sumOf { it.x }
        val totalY = calibrationSamples.sumOf { it.y }
        val totalZ = calibrationSamples.sumOf { it.z }

        baseline = CalibrationSample(
            x = totalX / count,
            y = totalY / count,
            z = totalZ / count
        )
    }

    private fun evaluateMotion(
        accelerationChange: Double,
        rotationSpeed: Double
    ): MotionDetectionResult {

        val thresholds =
            SENSITIVITY_THRESHOLDS[sensitivity]
                ?: SENSITIVITY_THRESHOLDS.getValue(
                    MotionSensitivity.MEDIUM
                )

        val accelerationDetected =
            accelerationChange >= thresholds.first

        val rotationDetected =
            rotationSpeed >= thresholds.second

        val reason = when {
            accelerationDetected && rotationDetected ->
                "Acceleration and rotation detected"

            accelerationDetected ->
                "Significant acceleration detected"

            rotationDetected ->
                "Significant rotation detected"

            else -> null
        }

        return MotionDetectionResult(
            detected = accelerationDetected || rotationDetected,
            accelerationChange = accelerationChange,
            rotationSpeed = rotationSpeed,
            reason = reason
        )
    }

    private fun emptyResult(): MotionDetectionResult {
        return MotionDetectionResult(
            detected = false,
            accelerationChange = 0.0,
            rotationSpeed = 0.0,
            reason = null
        )
    }
}
