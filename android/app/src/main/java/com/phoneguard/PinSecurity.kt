
package com.phoneguard

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey

object PinSecurity {

    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "phoneguard.pin.hmac"
    private const val PREFS_NAME = "phoneguard_secure_pin"
    private const val SALT_KEY = "pin_salt"
    private const val HASH_KEY = "pin_hash"

    private val lock = Any()

    private fun getPreferences(context: android.content.Context) =
        context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        val existingKey = keyStore.getKey(KEY_ALIAS, null)

        if (existingKey is SecretKey) {
            return existingKey
        }

        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_HMAC_SHA256,
            KEYSTORE_PROVIDER
        )

        val keySpec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setDigests(KeyProperties.DIGEST_SHA256)
            .build()

        keyGenerator.init(keySpec)

        return keyGenerator.generateKey()
    }

    private fun calculatePinHash(
        pin: String,
        salt: ByteArray
    ): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(getOrCreateSecretKey())
        mac.update(salt)

        return mac.doFinal(pin.toByteArray(Charsets.UTF_8))
    }

    fun savePin(
        context: android.content.Context,
        pin: String
    ) = synchronized(lock) {
        require(Regex("^\\d{4}(\\d{2})?$").matches(pin)) {
            "PIN must contain exactly 4 or 6 digits."
        }

        val salt = ByteArray(32)
        SecureRandom().nextBytes(salt)

        val hash = calculatePinHash(pin, salt)

        val saved = getPreferences(context)
            .edit()
            .putString(SALT_KEY, Base64.encodeToString(salt, Base64.NO_WRAP))
            .putString(HASH_KEY, Base64.encodeToString(hash, Base64.NO_WRAP))
            .commit()

        if (!saved) {
            throw IllegalStateException("Unable to save PIN securely.")
        }
    }

    fun verifyPin(
        context: android.content.Context,
        pin: String
    ): Boolean = synchronized(lock) {
        if (!Regex("^\\d{4}(\\d{2})?$").matches(pin)) {
            return@synchronized false
        }

        val preferences = getPreferences(context)

        val saltValue = preferences.getString(SALT_KEY, null)
            ?: return@synchronized false

        val hashValue = preferences.getString(HASH_KEY, null)
            ?: return@synchronized false

        val salt = Base64.decode(saltValue, Base64.NO_WRAP)
        val expectedHash = Base64.decode(hashValue, Base64.NO_WRAP)
        val actualHash = calculatePinHash(pin, salt)

        MessageDigest.isEqual(expectedHash, actualHash)
    }

    fun hasPin(context: android.content.Context): Boolean {
        val preferences = getPreferences(context)

        return preferences.contains(SALT_KEY) &&
            preferences.contains(HASH_KEY)
    }

    fun removePin(context: android.content.Context) =
        synchronized(lock) {
            val removed = getPreferences(context)
                .edit()
                .remove(SALT_KEY)
                .remove(HASH_KEY)
                .commit()

            if (!removed) {
                throw IllegalStateException("Unable to remove PIN.")
            }
        }
}
