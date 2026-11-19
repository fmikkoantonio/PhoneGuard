
package com.phoneguard

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

object AlarmController {

    private const val LOG_TAG = "PhoneGuardAlarm"

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    @Volatile
    private var alarmRunning = false

    @Synchronized
    fun start(
        context: Context,
        soundEnabled: Boolean,
        vibrationEnabled: Boolean
    ) {
        require(soundEnabled || vibrationEnabled) {
            "At least one alarm output must be enabled."
        }

        check(PinSecurity.hasPin(context)) {
            "A security PIN must be configured before starting the alarm."
        }

        stop()

        val appContext = context.applicationContext

        try {
            if (soundEnabled) {
                startSound(appContext)
            }

            if (vibrationEnabled) {
                startVibration(appContext)
            }

            alarmRunning = true

            Log.w(LOG_TAG, "SECURITY ALARM STARTED")
        } catch (error: Exception) {
            stop()

            Log.e(LOG_TAG, "Unable to start security alarm.", error)

            throw error
        }
    }

    @Synchronized
    fun stop() {
        try {
            mediaPlayer?.let { player ->
                if (player.isPlaying) {
                    player.stop()
                }

                player.release()
            }
        } catch (error: Exception) {
            Log.e(LOG_TAG, "Unable to stop alarm sound.", error)
        } finally {
            mediaPlayer = null
        }

        try {
            vibrator?.cancel()
        } catch (error: Exception) {
            Log.e(LOG_TAG, "Unable to stop alarm vibration.", error)
        } finally {
            vibrator = null
        }

        alarmRunning = false

        Log.i(LOG_TAG, "Security alarm outputs stopped")
    }

    fun isRunning(): Boolean = alarmRunning

    private fun startSound(context: Context) {
        val alarmUri =
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(
                    RingtoneManager.TYPE_NOTIFICATION
                )
                ?: throw IllegalStateException(
                    "No default alarm sound is available."
                )

        val player = MediaPlayer()

        try {
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(
                        AudioAttributes.CONTENT_TYPE_SONIFICATION
                    )
                    .build()
            )

            player.setDataSource(context, alarmUri)
            player.isLooping = true
            player.prepare()
            player.start()

            mediaPlayer = player
        } catch (error: Exception) {
            player.release()
            throw error
        }
    }

    private fun startVibration(context: Context) {
        val activeVibrator =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(
                    Context.VIBRATOR_MANAGER_SERVICE
                ) as VibratorManager

                manager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(
                    Context.VIBRATOR_SERVICE
                ) as Vibrator
            }

        check(activeVibrator.hasVibrator()) {
            "Vibration hardware is unavailable."
        }

        vibrator = activeVibrator

        val pattern = longArrayOf(0, 500, 500)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activeVibrator.vibrate(
                VibrationEffect.createWaveform(pattern, 0)
            )
        } else {
            @Suppress("DEPRECATION")
            activeVibrator.vibrate(pattern, 0)
        }
    }
}
