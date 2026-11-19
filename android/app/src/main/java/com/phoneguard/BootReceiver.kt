package com.phoneguard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) {
            return
        }

        val preferences = context.getSharedPreferences(
            "phone_guard_protection",
            Context.MODE_PRIVATE
        )

        val protectionWasEnabled = preferences.getBoolean(
            "protection_enabled",
            false
        )

        if (!protectionWasEnabled) {
            Log.i(
                "PhoneGuardBoot",
                "Device boot completed. Protection was disabled; service will remain stopped."
            )
            return
        }

        try {
            Log.i(
                "PhoneGuardBoot",
                "Device boot completed. Restoring Phone Guard protection."
            )
            ProtectionService.start(context)
        } catch (error: Exception) {
            Log.e(
                "PhoneGuardBoot",
                "Unable to restore Phone Guard protection after boot.",
                error
            )
        }
    }
}
