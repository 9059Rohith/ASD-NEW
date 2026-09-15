package com.team96.speakeasy.ui.screens

import androidx.compose.animation.core.EaseOutBack
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.RecordVoiceOver
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.team96.speakeasy.data.SessionManager
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.navigation.Routes
import com.team96.speakeasy.ui.theme.GradientPlay
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(nav: NavController) {
    var visible by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (visible) 1f else 0.3f,
        animationSpec = tween(800, easing = EaseOutBack),
        label = "logoScale"
    )
    val pulse = rememberInfiniteTransition(label = "pulse")
    val ring by pulse.animateFloat(
        initialValue = 1f, targetValue = 1.25f,
        animationSpec = infiniteRepeatable(tween(1100), RepeatMode.Reverse),
        label = "ring"
    )

    LaunchedEffect(Unit) {
        visible = true
        delay(1700)
        val dest = if (SessionManager.isLoggedIn) Routes.HOME else Routes.ONBOARDING
        nav.navigate(dest) {
            popUpTo(Routes.SPLASH) { inclusive = true }
        }
    }

    AnimatedGradientBackground(GradientPlay) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(contentAlignment = Alignment.Center) {
                Box(
                    Modifier
                        .size(160.dp)
                        .scale(ring)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.18f))
                )
                Box(
                    Modifier
                        .size(130.dp)
                        .scale(scale)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.RecordVoiceOver,
                        contentDescription = null,
                        tint = com.team96.speakeasy.ui.theme.Purple,
                        modifier = Modifier.size(72.dp)
                    )
                }
            }
            Text(
                "SpeakEasy",
                color = Color.White,
                fontWeight = FontWeight.Black,
                fontSize = 40.sp,
                modifier = Modifier.scale(scale)
            )
            Text(
                "Fun speech therapy for little stars ⭐",
                color = Color.White.copy(alpha = 0.92f),
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding()
            )
        }
    }
}

private fun Modifier.padding() = this
