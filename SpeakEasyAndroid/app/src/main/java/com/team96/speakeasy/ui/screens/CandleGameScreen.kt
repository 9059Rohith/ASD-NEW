package com.team96.speakeasy.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavController
import com.team96.speakeasy.audio.VoiceRecorder
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.components.BouncyButton
import com.team96.speakeasy.ui.components.ConfettiOverlay
import com.team96.speakeasy.ui.theme.GradientCalm
import com.team96.speakeasy.ui.theme.Sunny
import com.team96.speakeasy.ui.theme.Teal
import kotlinx.coroutines.delay

@Composable
fun CandleGameScreen(nav: NavController) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val recorder = remember { VoiceRecorder(context) }

    var active by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf(0f) }   // 0 = full flame, 1 = blown out
    var blowing by remember { mutableStateOf(false) }
    var won by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP && active) {
                recorder.cancel()
                active = false
                blowing = false
                error = "Game paused when the app went to the background. Start again when ready."
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            recorder.cancel()
        }
    }

    fun startGame() {
        progress = 0f; won = false; error = null
        if (recorder.start()) active = true else error = "Microphone is busy. Try again."
    }

    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startGame() else error = "Microphone permission is needed to blow the candle."
    }

    fun tryStart() {
        val has = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (has) startGame() else micPermission.launch(Manifest.permission.RECORD_AUDIO)
    }

    // Game loop: sample mic amplitude and shrink the flame as the child blows.
    LaunchedEffect(active) {
        if (!active) return@LaunchedEffect
        while (active && progress < 1f) {
            val amp = recorder.amplitude() / 32767f
            blowing = amp > 0.18f
            if (blowing) progress = (progress + 0.05f).coerceAtMost(1f)
            else progress = (progress - 0.012f).coerceAtLeast(0f) // flame recovers slightly
            delay(70)
        }
        if (progress >= 1f) {
            recorder.cancel()
            active = false
            won = true
        }
    }

    AnimatedGradientBackground(GradientCalm) {
        Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(34.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                BackCircle { recorder.cancel(); nav.popBackStack() }
                Spacer(Modifier.width(14.dp))
                Column {
                    Text("Candle Game", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black)
                    Text("Take a deep breath and blow! 🌬️", color = Color.White.copy(alpha = 0.9f), fontSize = 14.sp)
                }
            }

            Spacer(Modifier.height(24.dp))
            // Progress bar
            Box(
                Modifier.fillMaxWidth().height(16.dp).clip(RoundedCornerShape(10.dp)).background(Color.White.copy(alpha = 0.25f))
            ) {
                Box(
                    Modifier.fillMaxWidth(progress).height(16.dp).clip(RoundedCornerShape(10.dp))
                        .background(Brush.horizontalGradient(listOf(Sunny, Color(0xFFFF7043))))
                )
            }
            Spacer(Modifier.height(8.dp))
            Text("${(progress * 100).toInt()}%", color = Color.White, fontWeight = FontWeight.Bold)

            Spacer(Modifier.height(20.dp))
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                CandleArt(flame = 1f - progress, flickering = active && !blowing)
            }

            when {
                won -> {
                    Text("You did it! Candle's out! 🎂", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(14.dp))
                    BouncyButton("Play Again", listOf(Teal, Color(0xFF26C6DA))) { tryStart() }
                }
                active -> {
                    Text(if (blowing) "Keep blowing! 💨" else "Blow harder into the mic!", color = Color.White, fontWeight = FontWeight.Bold)
                }
                else -> {
                    BouncyButton("Start Blowing 🌬️", listOf(Sunny, Color(0xFFFFB74D))) { tryStart() }
                }
            }
            error?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, color = Color(0xFFFFF0A0), fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(16.dp))
        }

        ConfettiOverlay(play = won)
    }
}

@Composable
private fun CandleArt(flame: Float, flickering: Boolean) {
    val t = rememberInfiniteTransition(label = "flame")
    val flicker by t.animateFloat(0.9f, 1.1f, infiniteRepeatable(tween(220), RepeatMode.Reverse), label = "flick")
    val wobble = if (flickering) flicker else 1f

    Canvas(Modifier.size(220.dp, 320.dp)) {
        val w = size.width
        val h = size.height
        val candleW = w * 0.34f
        val candleLeft = (w - candleW) / 2f
        val candleTop = h * 0.42f

        // Candle body (striped fun colors)
        drawRoundRect(
            brush = Brush.verticalGradient(listOf(Color(0xFFFF6FB5), Color(0xFFFF477E))),
            topLeft = Offset(candleLeft, candleTop),
            size = Size(candleW, h - candleTop),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(18f, 18f)
        )
        // Wick
        drawRect(
            color = Color(0xFF4A4A4A),
            topLeft = Offset(w / 2f - 2f, candleTop - 18f),
            size = Size(4f, 18f)
        )
        // Flame (scales with `flame` 0..1)
        if (flame > 0.02f) {
            val flameH = 70f * flame * wobble
            val flameW = 34f * flame
            val cx = w / 2f
            val baseY = candleTop - 18f
            // Outer flame
            drawOval(
                brush = Brush.verticalGradient(listOf(Color(0xFFFFE082), Color(0xFFFF7043))),
                topLeft = Offset(cx - flameW / 2f, baseY - flameH),
                size = Size(flameW, flameH)
            )
            // Inner flame
            drawOval(
                color = Color(0xFFFFF59D),
                topLeft = Offset(cx - flameW / 4f, baseY - flameH * 0.6f),
                size = Size(flameW / 2f, flameH * 0.5f)
            )
            // Glow
            drawCircle(
                color = Color(0x33FFD54F),
                radius = flameH,
                center = Offset(cx, baseY - flameH / 2f)
            )
        } else {
            // Smoke puff when out
            drawCircle(color = Color(0x55BDBDBD), radius = 14f, center = Offset(w / 2f, candleTop - 40f))
            drawCircle(color = Color(0x33BDBDBD), radius = 18f, center = Offset(w / 2f + 10f, candleTop - 70f))
        }
    }
}
