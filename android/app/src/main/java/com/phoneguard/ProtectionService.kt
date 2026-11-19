package com.phoneguard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class ProtectionService : Service(), SensorEventListener {

    companion object {
        const val ACTION_START =
            "com.phoneguard.action.START_PROTECTION"

        const val ACTION_STOP =
            "com.phoneguard.action.STOP_PROTECTION"

        const val ACTION_UPDATE_SENSITIVITY =
            "com.phoneguard.action.UPDATE_SENSITIVITY"

        const val ACTION_UPDATE_COUNTDOWN =
            "com.phoneguard.action.UPDATE_COUNTDOWN"

        const val ACTION_UPDATE_ALARM_SETTINGS =
            "com.phoneguard.action.UPDATE_ALARM_SETTINGS"

        const val EXTRA_SENSITIVITY = "sensitivity"
        const val EXTRA_COUNTDOWN_DURATION = "countdown_duration"
        const val EXTRA_SOUND_ENABLED = "sound_enabled"
        const val EXTRA_VIBRATION_ENABLED = "vibration_enabled"

        private const val CHANNEL_ID = "phone_guard_protection"
        private const val NOTIFICATION_ID = 1001
        private const val WAKE_LOCK_TAG = "PhoneGuard:ProtectionSensors"
        private const val LOG_TAG = "PhoneGuardSensors"
        private const val DETECTION_LOG_TAG = "PhoneGuardDetection"
        private const val LOG_INTERVAL_MS = 5000L

        private const val PREFERENCES_NAME = "phone_guard_protection"
        private const val KEY_SENSITIVITY = "motion_sensitivity"
        private const val KEY_COUNTDOWN_DURATION = "countdown_duration"
        private const val KEY_SOUND_ENABLED = "sound_enabled"
        private const val KEY_VIBRATION_ENABLED = "vibration_enabled"
        private const val KEY_PROTECTION_ENABLED = "protection_enabled"
        private const val KEY_COUNTDOWN_ACTIVE = "countdown_active"
        private const val KEY_COUNTDOWN_REMAINING = "countdown_remaining"

        @Volatile
        private var serviceRunning = false

        fun getCountdownState(context: Context): Pair<Boolean, Int> {
            val preferences = getPreferences(context)
            return Pair(
                preferences.getBoolean(KEY_COUNTDOWN_ACTIVE, false),
                preferences.getInt(KEY_COUNTDOWN_REMAINING, 0)
            )
        }

        fun isRunning(context: Context): Boolean {
    return getPreferences(context)
        .getBoolean(KEY_PROTECTION_ENABLED, false)
}

        private fun getPreferences(context: Context) =
            context.getSharedPreferences(
                PREFERENCES_NAME,
                Context.MODE_PRIVATE
            )

        fun start(context: Context) {
            getPreferences(context)
                .edit()
                .putBoolean(KEY_PROTECTION_ENABLED, true)
                .apply()

            val intent = Intent(context, ProtectionService::class.java)
                .setAction(ACTION_START)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            getPreferences(context)
                .edit()
                .putBoolean(KEY_PROTECTION_ENABLED, false)
                .putBoolean(KEY_COUNTDOWN_ACTIVE, false)
                .putInt(KEY_COUNTDOWN_REMAINING, 0)
                .apply()

            val intent = Intent(context, ProtectionService::class.java)
                .setAction(ACTION_STOP)

            context.startService(intent)
        }

        fun updateSensitivity(
            context: Context,
            sensitivity: String
        ) {
            getPreferences(context)
                .edit()
                .putString(KEY_SENSITIVITY, sensitivity)
                .apply()

            Log.i(
                DETECTION_LOG_TAG,
                "Sensitivity preference saved: $sensitivity"
            )

            if (serviceRunning) {
                val intent = Intent(
                    context,
                    ProtectionService::class.java
                ).apply {
                    action = ACTION_UPDATE_SENSITIVITY
                    putExtra(EXTRA_SENSITIVITY, sensitivity)
                }

                context.startService(intent)
            }
        }

        fun updateCountdownDuration(
            context: Context,
            seconds: Int
        ) {
            require(seconds in listOf(3, 5, 10)) {
                "Countdown duration must be 3, 5, or 10 seconds."
            }

            getPreferences(context)
                .edit()
                .putInt(KEY_COUNTDOWN_DURATION, seconds)
                .apply()

            Log.i(
                DETECTION_LOG_TAG,
                "Countdown preference saved: $seconds seconds"
            )

            if (serviceRunning) {
                val intent = Intent(
                    context,
                    ProtectionService::class.java
                ).apply {
                    action = ACTION_UPDATE_COUNTDOWN
                    putExtra(EXTRA_COUNTDOWN_DURATION, seconds)
                }

                context.startService(intent)
            }
        }

        fun updateAlarmSettings(
            context: Context,
            soundEnabled: Boolean,
            vibrationEnabled: Boolean
        ) {
            getPreferences(context)
                .edit()
                .putBoolean(KEY_SOUND_ENABLED, soundEnabled)
                .putBoolean(KEY_VIBRATION_ENABLED, vibrationEnabled)
                .apply()

            Log.i(
                DETECTION_LOG_TAG,
                "Alarm preferences saved: sound=$soundEnabled, vibration=$vibrationEnabled"
            )

            if (serviceRunning) {
                val intent = Intent(
                    context,
                    ProtectionService::class.java
                ).apply {
                    action = ACTION_UPDATE_ALARM_SETTINGS
                    putExtra(EXTRA_SOUND_ENABLED, soundEnabled)
                    putExtra(EXTRA_VIBRATION_ENABLED, vibrationEnabled)
                }

                context.startService(intent)
            }
        }
    }

    private lateinit var sensorManager: SensorManager
    private lateinit var motionDetector: NativeMotionDetector

    private var accelerometer: Sensor? = null
    private var gyroscope: Sensor? = null

    private var isSensorMonitoring = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var movementCurrentlyDetected = false

    private var lastAccelerometerLogTime = 0L
    private var lastGyroscopeLogTime = 0L

    private var currentSensitivity = MotionSensitivity.MEDIUM
    private var countdownDurationSeconds = 3

    private var soundEnabled = true
    private var vibrationEnabled = true

    private var countdownTimer: CountDownTimer? = null
    private var countdownTriggered = false

    override fun onCreate() {
        super.onCreate()

        Log.i(LOG_TAG, "ProtectionService created")

        createNotificationChannel()

        sensorManager =
            getSystemService(Context.SENSOR_SERVICE) as SensorManager

        accelerometer =
            sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        gyroscope =
            sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

        currentSensitivity = loadSavedSensitivity()
        countdownDurationSeconds = loadSavedCountdownDuration()

        val savedAlarmSettings = loadSavedAlarmSettings()
        soundEnabled = savedAlarmSettings.first
        vibrationEnabled = savedAlarmSettings.second

        motionDetector = NativeMotionDetector(currentSensitivity)

        Log.i(
            DETECTION_LOG_TAG,
            "Native motion detector created. Sensitivity=$currentSensitivity"
        )

        Log.i(
            DETECTION_LOG_TAG,
            "Native countdown configured: $countdownDurationSeconds seconds"
        )

        Log.i(
            DETECTION_LOG_TAG,
            "Native alarm settings loaded: sound=$soundEnabled, vibration=$vibrationEnabled"
        )
    }

    private fun loadSavedSensitivity(): MotionSensitivity {
        val savedValue = getPreferences(this)
            .getString(KEY_SENSITIVITY, MotionSensitivity.MEDIUM.name)

        return try {
            MotionSensitivity.valueOf(
                savedValue ?: MotionSensitivity.MEDIUM.name
            )
        } catch (error: IllegalArgumentException) {
            Log.w(
                DETECTION_LOG_TAG,
                "Invalid saved sensitivity. Using MEDIUM."
            )
            MotionSensitivity.MEDIUM
        }
    }

    private fun loadSavedCountdownDuration(): Int {
        val savedValue = getPreferences(this)
            .getInt(KEY_COUNTDOWN_DURATION, 3)

        return if (savedValue in listOf(3, 5, 10)) {
            savedValue
        } else {
            Log.w(
                DETECTION_LOG_TAG,
                "Invalid saved countdown. Using 3 seconds."
            )
            3
        }
    }

    private fun loadSavedAlarmSettings(): Pair<Boolean, Boolean> {
        val preferences = getPreferences(this)

        val savedSoundEnabled = preferences.getBoolean(
            KEY_SOUND_ENABLED,
            true
        )

        val savedVibrationEnabled = preferences.getBoolean(
            KEY_VIBRATION_ENABLED,
            true
        )

        return Pair(
            savedSoundEnabled,
            savedVibrationEnabled
        )
    }

    private fun applySensitivity(sensitivityValue: String?) {
        val newSensitivity = try {
            MotionSensitivity.valueOf(
                sensitivityValue ?: return
            )
        } catch (error: IllegalArgumentException) {
            Log.e(
                DETECTION_LOG_TAG,
                "Invalid sensitivity received: $sensitivityValue"
            )
            return
        }

        currentSensitivity = newSensitivity
        motionDetector.setSensitivity(newSensitivity)

        movementCurrentlyDetected = false

        Log.i(
            DETECTION_LOG_TAG,
            "Native detector sensitivity updated: $newSensitivity"
        )
    }

    private fun applyCountdownDuration(seconds: Int) {
        if (seconds !in listOf(3, 5, 10)) {
            Log.e(
                DETECTION_LOG_TAG,
                "Invalid countdown duration received: $seconds"
            )
            return
        }

        countdownDurationSeconds = seconds

        Log.i(
            DETECTION_LOG_TAG,
            "Native countdown duration updated: $seconds seconds"
        )

        if (countdownTimer != null) {
            Log.i(
                DETECTION_LOG_TAG,
                "Current countdown will finish using its original duration. New duration applies to the next trigger."
            )
        }
    }

    private fun applyAlarmSettings(
        newSoundEnabled: Boolean,
        newVibrationEnabled: Boolean
    ) {
        soundEnabled = newSoundEnabled
        vibrationEnabled = newVibrationEnabled

        Log.i(
            DETECTION_LOG_TAG,
            "Native alarm settings updated: sound=$soundEnabled, vibration=$vibrationEnabled"
        )
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {
        when (intent?.action) {
            null -> {
                val protectionWasEnabled = getPreferences(this)
                    .getBoolean(KEY_PROTECTION_ENABLED, false)

                if (protectionWasEnabled) {
                    Log.i(
                        LOG_TAG,
                        "Protection service restarted by Android. Restoring monitoring."
                    )
                    startProtectionForeground()
                    serviceRunning = true
                    startSensorMonitoring()
                } else {
                    Log.i(
                        LOG_TAG,
                        "Service restarted without an active protection request. Stopping."
                    )
                    serviceRunning = false
                    stopSelf()
                    return START_NOT_STICKY
                }
            }

            ACTION_STOP -> {
                Log.i(LOG_TAG, "Stop protection requested")
                getPreferences(this)
                    .edit()
                    .putBoolean(KEY_PROTECTION_ENABLED, false)
                    .putBoolean(KEY_COUNTDOWN_ACTIVE, false)
                    .putInt(KEY_COUNTDOWN_REMAINING, 0)
                    .apply()
                serviceRunning = false
                stopSensorMonitoring()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_START -> {
                Log.i(LOG_TAG, "Start protection requested")
                getPreferences(this)
                    .edit()
                    .putBoolean(KEY_PROTECTION_ENABLED, true)
                    .apply()
                startProtectionForeground()
                serviceRunning = true
                startSensorMonitoring()
            }

            ACTION_UPDATE_SENSITIVITY -> {
                applySensitivity(
                    intent.getStringExtra(EXTRA_SENSITIVITY)
                )
            }

            ACTION_UPDATE_COUNTDOWN -> {
                val seconds = intent.getIntExtra(
                    EXTRA_COUNTDOWN_DURATION,
                    countdownDurationSeconds
                )

                applyCountdownDuration(seconds)
            }

            ACTION_UPDATE_ALARM_SETTINGS -> {
                val newSoundEnabled = intent.getBooleanExtra(
                    EXTRA_SOUND_ENABLED,
                    soundEnabled
                )

                val newVibrationEnabled = intent.getBooleanExtra(
                    EXTRA_VIBRATION_ENABLED,
                    vibrationEnabled
                )

                applyAlarmSettings(
                    newSoundEnabled,
                    newVibrationEnabled
                )
            }

            else -> {
                Log.w(LOG_TAG, "Unknown service action")
                getPreferences(this)
                    .edit()
                    .putBoolean(KEY_PROTECTION_ENABLED, false)
                    .apply()
                serviceRunning = false
                stopSensorMonitoring()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
        }

        return START_STICKY
    }

    private fun startProtectionForeground() {
        val notification = createNotification(
            "Starting background motion sensor monitoring..."
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startSensorMonitoring() {
        if (isSensorMonitoring) {
            Log.i(LOG_TAG, "Sensor monitoring already active")
            return
        }

        val accelerometerSensor = accelerometer

        if (accelerometerSensor == null) {
            Log.e(LOG_TAG, "Accelerometer unavailable")
            updateNotification("Accelerometer unavailable.")
            return
        }

        motionDetector.reset()
        movementCurrentlyDetected = false
        countdownTriggered = false
        cancelCountdown()

        val accelerometerRegistered = sensorManager.registerListener(
            this,
            accelerometerSensor,
            SensorManager.SENSOR_DELAY_UI
        )

        if (!accelerometerRegistered) {
            sensorManager.unregisterListener(this)
            Log.e(LOG_TAG, "Accelerometer registration failed")
            updateNotification("Unable to register accelerometer.")
            return
        }

        val gyroscopeRegistered = gyroscope?.let {
            sensorManager.registerListener(
                this,
                it,
                SensorManager.SENSOR_DELAY_UI
            )
        } ?: false

        isSensorMonitoring = true

        acquireWakeLock()

        Log.i(
            LOG_TAG,
            "Sensor monitoring started. Accelerometer=true, Gyroscope=$gyroscopeRegistered"
        )

        Log.i(
            DETECTION_LOG_TAG,
            "Motion detector initialized. Sensitivity=$currentSensitivity"
        )

        Log.i(
            DETECTION_LOG_TAG,
            "Countdown armed. Duration=$countdownDurationSeconds seconds"
        )

        updateNotification(
            if (gyroscopeRegistered) {
                "Accelerometer and gyroscope are monitoring device movement."
            } else {
                "Accelerometer monitoring is active. Gyroscope unavailable."
            }
        )
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) {
            return
        }

        val powerManager =
            getSystemService(Context.POWER_SERVICE) as PowerManager

        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            WAKE_LOCK_TAG
        ).apply {
            setReferenceCounted(false)
            acquire()
        }

        Log.i(LOG_TAG, "Partial wake lock acquired")
    }

    private fun saveCountdownState(
        active: Boolean,
        secondsRemaining: Int
    ) {
        getPreferences(this)
            .edit()
            .putBoolean(KEY_COUNTDOWN_ACTIVE, active)
            .putInt(KEY_COUNTDOWN_REMAINING, secondsRemaining.coerceAtLeast(0))
            .apply()
    }

    private fun startCountdown() {
        if (countdownTriggered || countdownTimer != null) {
            return
        }

        countdownTriggered = true

        val durationMillis = countdownDurationSeconds * 1000L
        saveCountdownState(true, countdownDurationSeconds)

        Log.w(
            DETECTION_LOG_TAG,
            "SECURITY COUNTDOWN STARTED: $countdownDurationSeconds seconds"
        )

        updateNotification(
            "Movement detected. Security countdown is running."
        )

        countdownTimer = object : CountDownTimer(
            durationMillis,
            1000L
        ) {
            override fun onTick(millisUntilFinished: Long) {
                val secondsRemaining =
                    ((millisUntilFinished + 999L) / 1000L).toInt()

                saveCountdownState(true, secondsRemaining)

                Log.i(
                    DETECTION_LOG_TAG,
                    "SECURITY COUNTDOWN: $secondsRemaining seconds remaining"
                )
            }

            override fun onFinish() {
                countdownTimer = null
                saveCountdownState(false, 0)

                Log.w(
                    DETECTION_LOG_TAG,
                    "SECURITY COUNTDOWN COMPLETED. Starting native security alarm."
                )

                try {
                    AlarmController.start(
                        this@ProtectionService,
                        soundEnabled,
                        vibrationEnabled
                    )

                    Log.w(
                        DETECTION_LOG_TAG,
                        "NATIVE SECURITY ALARM STARTED. PIN verification is required to stop it."
                    )

                    updateNotification(
                        "SECURITY ALARM ACTIVE. Open Phone Guard and enter your PIN to stop it."
                    )
                } catch (error: Exception) {
                    Log.e(
                        DETECTION_LOG_TAG,
                        "Unable to start the native security alarm.",
                        error
                    )

                    updateNotification(
                        "Alarm could not start. Check your PIN and alarm settings."
                    )
                }
            }
        }.start()
    }

    private fun cancelCountdown() {
        countdownTimer?.cancel()
        countdownTimer = null
        saveCountdownState(false, 0)

        Log.i(
            DETECTION_LOG_TAG,
            "Security countdown cancelled"
        )
    }

    private fun stopSensorMonitoring() {
        if (::sensorManager.isInitialized) {
            sensorManager.unregisterListener(this)
        }

        isSensorMonitoring = false
        movementCurrentlyDetected = false
        countdownTriggered = false

        cancelCountdown()

        if (::motionDetector.isInitialized) {
            motionDetector.reset()
        }

        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.i(LOG_TAG, "Partial wake lock released")
            }
        }

        wakeLock = null

        Log.i(LOG_TAG, "Sensor monitoring stopped")
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || !isSensorMonitoring) {
            return
        }

        val currentTime = System.currentTimeMillis()

        val sensorType = when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> "accelerometer"
            Sensor.TYPE_GYROSCOPE -> "gyroscope"
            else -> return
        }

        when (sensorType) {
            "accelerometer" -> {
                if (currentTime - lastAccelerometerLogTime >= LOG_INTERVAL_MS) {
                    lastAccelerometerLogTime = currentTime

                    Log.d(
                        LOG_TAG,
                        "ACCELEROMETER x=${event.values[0]}, y=${event.values[1]}, z=${event.values[2]}"
                    )
                }
            }

            "gyroscope" -> {
                if (currentTime - lastGyroscopeLogTime >= LOG_INTERVAL_MS) {
                    lastGyroscopeLogTime = currentTime

                    Log.d(
                        LOG_TAG,
                        "GYROSCOPE x=${event.values[0]}, y=${event.values[1]}, z=${event.values[2]}"
                    )
                }
            }
        }

        val result = motionDetector.process(
            sensorType = sensorType,
            x = event.values[0].toDouble(),
            y = event.values[1].toDouble(),
            z = event.values[2].toDouble()
        )

        if (!motionDetector.isCalibrated()) {
            return
        }

        if (result.detected && !movementCurrentlyDetected) {
            movementCurrentlyDetected = true

            Log.w(
                DETECTION_LOG_TAG,
                "MOVEMENT DETECTED: ${result.reason} | " +
                    "Sensitivity=$currentSensitivity | " +
                    "Acceleration=${result.accelerationChange} | " +
                    "Rotation=${result.rotationSpeed}"
            )

            startCountdown()
        } else if (!result.detected && movementCurrentlyDetected) {
            movementCurrentlyDetected = false

            Log.i(
                DETECTION_LOG_TAG,
                "Movement returned below detection thresholds"
            )
        }
    }

    override fun onAccuracyChanged(
        sensor: Sensor?,
        accuracy: Int
    ) {
        // No accuracy handling is required for this diagnostic test.
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Phone Guard Protection",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description =
                    "Shows when Phone Guard device protection is active."
                setShowBadge(false)
            }

            val manager =
                getSystemService(NotificationManager::class.java)

            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(
        contentText: String
    ): Notification {
        val launchIntent =
            packageManager.getLaunchIntentForPackage(packageName)

        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or
                    PendingIntent.FLAG_IMMUTABLE
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Phone Guard is active")
            .setContentText(contentText)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun updateNotification(contentText: String) {
        val manager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        manager.notify(
            NOTIFICATION_ID,
            createNotification(contentText)
        )
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.i(LOG_TAG, "ProtectionService destroyed")
        serviceRunning = false
        stopSensorMonitoring()
        super.onDestroy()
    }
}
