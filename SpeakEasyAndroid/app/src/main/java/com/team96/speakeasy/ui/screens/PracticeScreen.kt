package com.team96.speakeasy.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.speech.tts.TextToSpeech
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
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
import com.team96.speakeasy.data.Lesson
import com.team96.speakeasy.data.SpeechResult
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.components.BouncyButton
import com.team96.speakeasy.ui.components.ConfettiOverlay
import com.team96.speakeasy.ui.components.StarRow
import com.team96.speakeasy.ui.theme.GradientWarm
import com.team96.speakeasy.ui.theme.LessonColors
import com.team96.speakeasy.ui.theme.Pink
import com.team96.speakeasy.ui.theme.Purple
import com.team96.speakeasy.ui.theme.Sunny
import com.team96.speakeasy.ui.theme.Teal
import com.team96.speakeasy.viewmodel.AppViewModel
import java.util.Locale

private enum class Phase { IDLE, RECORDING, EVALUATING, RESULT }

@Composable
fun PracticeScreen(nav: NavController, vm: AppViewModel, lessonId: Int) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val lesson = vm.lessonById(lessonId)

    val recorder = remember { VoiceRecorder(context) }
    var phase by remember { mutableStateOf(Phase.IDLE) }
    var startTime by remember { mutableStateOf(0L) }
    var result by remember { mutableStateOf<SpeechResult?>(null) }
    var stars by remember { mutableStateOf(0) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var tamilVoiceReady by remember { mutableStateOf(false) }

    // Text-to-speech for the "Listen" button
    val tts = remember {
        var engine: TextToSpeech? = null
        engine = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val support = engine?.setLanguage(Locale.forLanguageTag("ta-IN")) ?: TextToSpeech.ERROR
                tamilVoiceReady = support >= TextToSpeech.LANG_AVAILABLE
                if (!tamilVoiceReady) errorMsg = "Tamil voice is unavailable. Install Tamil speech data in your device settings."
            } else {
                errorMsg = "Text-to-speech could not start on this device."
            }
        }
        engine
    }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP && phase == Phase.RECORDING) {
                recorder.cancel()
                phase = Phase.IDLE
                errorMsg = "Recording stopped when the app went to the background."
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            tts.shutdown()
            recorder.cancel()
        }
    }

    fun beginRecording() {
        if (recorder.start()) {
            startTime = System.currentTimeMillis()
            phase = Phase.RECORDING
            errorMsg = null
        } else {
            errorMsg = "Microphone is busy. Try again."
        }
    }

    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) beginRecording() else errorMsg = "Microphone permission is needed to practice."
    }

    fun onMicTap() {
        when (phase) {
            Phase.IDLE, Phase.RESULT -> {
                result = null
                val has = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                if (has) beginRecording() else micPermission.launch(Manifest.permission.RECORD_AUDIO)
            }
            Phase.RECORDING -> {
                val file = recorder.stop()
                val duration = System.currentTimeMillis() - startTime
                if (file != null && lesson != null) {
                    phase = Phase.EVALUATING
                    vm.evaluate(
                        file = file,
                        lesson = lesson,
                        durationMs = duration,
                        onResult = { r, s -> result = r; stars = s; phase = Phase.RESULT },
                        onError = { msg -> errorMsg = msg; phase = Phase.IDLE }
                    )
                } else {
                    errorMsg = "Recording too short. Hold and speak!"
                    phase = Phase.IDLE
                }
            }
            else -> {}
        }
    }

    if (lesson == null) {
        AnimatedGradientBackground(GradientWarm) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Lesson not found", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(16.dp))
                    BouncyButton("Go Back", listOf(Color.White, Color(0xFFFFE9F4)), modifier = Modifier.width(200.dp)) { nav.popBackStack() }
                }
            }
        }
        return
    }

    val grad = LessonColors[(lesson.id - 1).coerceAtLeast(0) % LessonColors.size]

    AnimatedGradientBackground(grad) {
        Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(34.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                BackCircle { nav.popBackStack() }
                Spacer(Modifier.width(14.dp))
                Text(if (lesson.type == "word") "Practice Word" else "Practice Sound", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
            }

            Spacer(Modifier.height(20.dp))
            // Big animated letter card
            val t = rememberInfiniteTransition(label = "letter")
            val bob by t.animateFloat(0.97f, 1.03f, infiniteRepeatable(tween(1500), RepeatMode.Reverse), label = "bob")
            Box(
                Modifier
                    .size(220.dp)
                    .scale(bob)
                    .shadow(16.dp, RoundedCornerShape(40.dp))
                    .clip(RoundedCornerShape(40.dp))
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                Text(lesson.symbol, fontSize = 110.sp, fontWeight = FontWeight.Black, color = grad.first())
            }
            Spacer(Modifier.height(12.dp))
            Text(lesson.english, color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black)

            Spacer(Modifier.height(10.dp))
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White.copy(alpha = 0.18f)).padding(14.dp)
            ) {
                Text("💡 ${lesson.tip}", color = Color.White, fontSize = 15.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }

            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                ActionCircle("Listen", Icons.Rounded.VolumeUp, Color.White.copy(alpha = 0.25f)) {
                    if (tamilVoiceReady) {
                        if (tts.speak(lesson.symbol, TextToSpeech.QUEUE_FLUSH, null, "say") == TextToSpeech.ERROR) {
                            errorMsg = "Tamil speech could not play. Try again."
                        }
                    } else {
                        errorMsg = "Tamil voice is not ready. Check your text-to-speech settings."
                    }
                }
                MicButton(phase = phase, onTap = { onMicTap() })
                Spacer(Modifier.size(64.dp))
            }

            Spacer(Modifier.height(14.dp))
            when (phase) {
                Phase.RECORDING -> Text("Listening… tap to stop 🎤", color = Color.White, fontWeight = FontWeight.Bold)
                Phase.EVALUATING -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 3.dp, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    Text("Checking your speech…", color = Color.White, fontWeight = FontWeight.Bold)
                }
                else -> Text("Tap the mic and say it out loud!", color = Color.White.copy(alpha = 0.9f))
            }
            errorMsg?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = Color(0xFFFFF0A0), fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
            }
        }

        // Result overlay
        AnimatedVisibility(
            visible = phase == Phase.RESULT && result != null,
            enter = fadeIn(tween(300)) + scaleIn(tween(400))
        ) {
            ResultOverlay(
                result = result,
                stars = stars,
                onRetry = { phase = Phase.IDLE; result = null },
                onClose = { nav.popBackStack() }
            )
        }
        ConfettiOverlay(play = phase == Phase.RESULT && stars >= 1)
    }
}

@Composable
private fun MicButton(phase: Phase, onTap: () -> Unit) {
    val recording = phase == Phase.RECORDING
    val t = rememberInfiniteTransition(label = "mic")
    val pulse by t.animateFloat(1f, 1.18f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "pulse")
    val scale = if (recording) pulse else 1f
    Box(contentAlignment = Alignment.Center) {
        if (recording) {
            Box(Modifier.size(110.dp).scale(pulse).clip(CircleShape).background(Color.White.copy(alpha = 0.25f)))
        }
        Box(
            Modifier
                .size(92.dp)
                .scale(scale)
                .shadow(14.dp, CircleShape)
                .clip(CircleShape)
                .background(Brush.linearGradient(if (recording) listOf(Pink, Color(0xFFFF5252)) else listOf(Color.White, Color(0xFFFFF0F8))))
                .clickable { onTap() },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                if (recording) Icons.Rounded.Stop else Icons.Rounded.Mic,
                contentDescription = "Record",
                tint = if (recording) Color.White else Purple,
                modifier = Modifier.size(44.dp)
            )
        }
    }
}

@Composable
private fun ActionCircle(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, bg: Color, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.size(64.dp).clip(CircleShape).background(bg).clickable { onClick() },
            contentAlignment = Alignment.Center
        ) { Icon(icon, label, tint = Color.White, modifier = Modifier.size(32.dp)) }
        Spacer(Modifier.height(6.dp))
        Text(label, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ResultOverlay(result: SpeechResult?, stars: Int, onRetry: () -> Unit, onClose: () -> Unit) {
    val accuracy = (result?.accuracy ?: 0.0).toInt()
    val win = stars >= 1
    Box(
        Modifier.fillMaxSize().background(Color(0xCC2A1A4A)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(28.dp)
                .clip(RoundedCornerShape(32.dp))
                .background(Color.White)
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(if (win) "Great Job! 🎉" else "Good Try! 💪", fontSize = 28.sp, fontWeight = FontWeight.Black, color = Purple)
            Spacer(Modifier.height(12.dp))
            StarRow(filled = stars, total = 3, starSize = 46, color = Sunny)
            Spacer(Modifier.height(16.dp))
            Box(
                Modifier.size(110.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Teal, Color(0xFF26C6DA)))),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("$accuracy%", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black)
                    Text("phoneme score", color = Color.White.copy(alpha = 0.9f), fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(
                result?.feedback?.takeIf { it.isNotBlank() } ?: "Keep practicing — you're improving!",
                color = Color(0xFF6B5B95), fontSize = 15.sp, textAlign = TextAlign.Center
            )
            if (!result?.transcription.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text("I heard: \"${result?.transcription}\"", color = Color(0xFF9A8FB8), fontSize = 13.sp, textAlign = TextAlign.Center)
            }
            val syllables = result?.syllableScores.orEmpty()
            if (!result?.actualPhonemes.isNullOrEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text("Target: /${result?.expectedPhonemes.orEmpty().joinToString(" ")}/", fontSize = 13.sp)
                Text("Detected: /${result?.actualPhonemes.orEmpty().joinToString(" ")}/", fontSize = 13.sp)
                Text("Automatic sound estimates can make mistakes.", fontSize = 11.sp, color = Color.Gray)
            }
            if (syllables.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    syllables.forEach { s ->
                        val pct = (s.gop * 100).toInt()
                        val tint = when {
                            pct >= 70 -> Color(0xFF2BB673)
                            pct >= 40 -> Color(0xFFE0A800)
                            else -> Color(0xFFE5484D)
                        }
                        Box(
                            Modifier
                                .background(tint.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("${s.syllable} · $pct%", color = tint, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            Spacer(Modifier.height(22.dp))
            BouncyButton("Try Again", listOf(Purple, Pink)) { onRetry() }
            Spacer(Modifier.height(12.dp))
            Text("Back to lessons", color = Purple, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onClose() }.padding(8.dp))
        }
    }
}
