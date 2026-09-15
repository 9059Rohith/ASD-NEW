package com.team96.speakeasy.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.team96.speakeasy.data.Api
import com.team96.speakeasy.data.LoginRequest
import com.team96.speakeasy.data.RegisterRequest
import com.team96.speakeasy.data.SessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val loggedIn: Boolean = SessionManager.isLoggedIn,
)

class AuthViewModel : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _state.value = _state.value.copy(error = "Please fill in both fields")
            return
        }
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val res = Api.service.login(LoginRequest(email.trim(), password))
                SessionManager.save(res.accessToken, res.user)
                _state.value = AuthUiState(loggedIn = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = friendly(e))
            }
        }
    }

    fun register(
        email: String,
        password: String,
        confirm: String,
        fullName: String,
        childName: String,
        childAge: Int,
        language: String,
    ) {
        when {
            listOf(email, password, fullName, childName).any { it.isBlank() } ->
                _state.value = _state.value.copy(error = "Please fill in all fields")
            password.length < 8 ->
                _state.value = _state.value.copy(error = "Password must be at least 8 characters")
            password != confirm ->
                _state.value = _state.value.copy(error = "Passwords do not match")
            childAge !in 4..12 ->
                _state.value = _state.value.copy(error = "Child age must be between 4 and 12")
            else -> {
                _state.value = _state.value.copy(loading = true, error = null)
                viewModelScope.launch {
                    try {
                        val res = Api.service.register(
                            RegisterRequest(
                                email = email.trim(),
                                password = password,
                                confirmPassword = confirm,
                                fullName = fullName.trim(),
                                childName = childName.trim(),
                                childAge = childAge,
                                language = language,
                            )
                        )
                        SessionManager.save(res.accessToken, res.user)
                        _state.value = AuthUiState(loggedIn = true)
                    } catch (e: Exception) {
                        _state.value = _state.value.copy(loading = false, error = friendly(e))
                    }
                }
            }
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                Api.service // best effort; backend logout clears cookie only
            } catch (_: Exception) {
            }
            SessionManager.clear()
            _state.value = AuthUiState(loggedIn = false)
            onDone()
        }
    }

    private fun friendly(e: Exception): String {
        val msg = e.message ?: ""
        return when {
            msg.contains("Unable to resolve host", true) ||
                msg.contains("Failed to connect", true) ||
                msg.contains("timeout", true) ->
                "Can't reach the server. Make sure the backend is running on port 8000."
            msg.contains("400") -> "Email already registered or invalid details."
            msg.contains("401") -> "Invalid email or password."
            else -> "Something went wrong. Please try again."
        }
    }
}
