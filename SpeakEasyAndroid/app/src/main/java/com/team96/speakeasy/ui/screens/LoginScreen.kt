package com.team96.speakeasy.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.components.BouncyButton
import com.team96.speakeasy.ui.components.CuteTextField
import com.team96.speakeasy.ui.components.GlassCard
import com.team96.speakeasy.ui.navigation.Routes
import com.team96.speakeasy.ui.theme.GradientCalm
import com.team96.speakeasy.ui.theme.Sunny
import com.team96.speakeasy.viewmodel.AuthViewModel

@Composable
fun LoginScreen(nav: NavController, vm: AuthViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(state.loggedIn) {
        if (state.loggedIn) {
            nav.navigate(Routes.HOME) { popUpTo(Routes.LOGIN) { inclusive = true } }
        }
    }

    AnimatedGradientBackground(GradientCalm) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(Modifier.height(40.dp))
            Text("Welcome Back! 👋", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
            Text("Let's keep learning together", color = Color.White.copy(alpha = 0.9f), fontSize = 16.sp)
            Spacer(Modifier.height(32.dp))

            GlassCard {
                CuteTextField(value = email, onChange = { email = it; vm.clearError() }, label = "Email", keyboard = KeyboardType.Email)
                Spacer(Modifier.height(16.dp))
                CuteTextField(value = password, onChange = { password = it; vm.clearError() }, label = "Password", visual = PasswordVisualTransformation())

                state.error?.let {
                    Spacer(Modifier.height(14.dp))
                    Text(it, color = Color(0xFFFFE0E0), fontSize = 14.sp, fontWeight = FontWeight.Medium)
                }

                Spacer(Modifier.height(22.dp))
                if (state.loading) {
                    CircularProgressIndicator(color = Color.White)
                } else {
                    BouncyButton("Log In", listOf(Sunny, Color(0xFFFFB74D))) {
                        vm.login(email, password)
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Text(
                "New here? Create an account",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(8.dp),
            )
            BouncyButton("Sign Up", listOf(Color.White.copy(alpha = 0.25f), Color.White.copy(alpha = 0.18f))) {
                nav.navigate(Routes.REGISTER)
            }
            Spacer(Modifier.height(24.dp))
            Text(
                "Tip: the backend must be running on your PC (port 8000).",
                color = Color.White.copy(alpha = 0.75f),
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}
