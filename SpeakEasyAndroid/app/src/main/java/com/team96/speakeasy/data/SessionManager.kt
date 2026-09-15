package com.team96.speakeasy.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val Context.dataStore by preferencesDataStore(name = "speakeasy_session")

/**
 * Holds the JWT in memory (for the OkHttp interceptor) and persists only its
 * Keystore-encrypted representation to DataStore.
 */
object SessionManager {
    @Volatile var token: String? = null
        private set
    @Volatile var childName: String? = null
    @Volatile var fullName: String? = null
    @Volatile var email: String? = null

    private val TOKEN_KEY = stringPreferencesKey("token")
    private val CHILD_KEY = stringPreferencesKey("child")
    private val NAME_KEY = stringPreferencesKey("name")
    private val EMAIL_KEY = stringPreferencesKey("email")

    private lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext
        runBlocking {
            val prefs = appContext.dataStore.data.first()
            token = prefs[TOKEN_KEY]?.let { encrypted -> runCatching { TokenCipher.decrypt(encrypted) }.getOrNull() }
            childName = prefs[CHILD_KEY]
            fullName = prefs[NAME_KEY]
            email = prefs[EMAIL_KEY]
        }
    }

    suspend fun save(token: String, user: User?) {
        this.token = token
        this.childName = user?.childName
        this.fullName = user?.fullName
        this.email = user?.email
        appContext.dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = TokenCipher.encrypt(token)
            user?.childName?.let { prefs[CHILD_KEY] = it }
            user?.fullName?.let { prefs[NAME_KEY] = it }
            user?.email?.let { prefs[EMAIL_KEY] = it }
        }
    }

    suspend fun clear() {
        token = null
        childName = null
        fullName = null
        email = null
        appContext.dataStore.edit { it.clear() }
    }

    val isLoggedIn: Boolean get() = !token.isNullOrBlank()
}
