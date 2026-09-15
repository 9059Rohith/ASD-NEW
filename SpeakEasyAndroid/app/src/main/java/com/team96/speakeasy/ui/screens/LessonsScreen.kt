package com.team96.speakeasy.ui.screens

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.team96.speakeasy.data.Lesson
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.components.BouncyButton
import com.team96.speakeasy.ui.components.StarRow
import com.team96.speakeasy.ui.navigation.Routes
import com.team96.speakeasy.ui.theme.GradientCalm
import com.team96.speakeasy.ui.theme.LessonColors
import com.team96.speakeasy.viewmodel.AppViewModel

@Composable
fun LessonsScreen(nav: NavController, vm: AppViewModel) {
    val lessons by vm.lessons.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.lessonsError.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { if (lessons.isEmpty()) vm.loadHome() }

    AnimatedGradientBackground(GradientCalm) {
        Column(Modifier.fillMaxSize().padding(20.dp)) {
            Spacer(Modifier.height(34.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                BackCircle { nav.popBackStack() }
                Spacer(Modifier.width(14.dp))
                Column {
                    Text("Lessons", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Tap a card to start practicing", color = Color.White.copy(alpha = 0.9f), fontSize = 14.sp)
                }
            }
            Spacer(Modifier.height(18.dp))

            if (loading && lessons.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color.White)
                }
            } else if (lessons.isEmpty()) {
                Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Text(error ?: "No lessons are available yet.", color = Color.White)
                    Spacer(Modifier.height(16.dp))
                    BouncyButton("Try Again", LessonColors.first()) { vm.loadHome() }
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    itemsIndexed(lessons) { index, lesson ->
                        LessonCard(lesson, index) { nav.navigate("${Routes.PRACTICE}/${lesson.id}") }
                    }
                }
            }
        }
    }
}

@Composable
private fun LessonCard(lesson: Lesson, index: Int, onClick: () -> Unit) {
    val grad = LessonColors[index % LessonColors.size]
    Row(
        Modifier
            .fillMaxWidth()
            .shadow(8.dp, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.horizontalGradient(grad))
            .clickable { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(64.dp).clip(RoundedCornerShape(18.dp)).background(Color.White),
            contentAlignment = Alignment.Center
        ) {
            Text(lesson.symbol, fontSize = 30.sp, fontWeight = FontWeight.Black, color = grad.first())
        }
        Spacer(Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            Text(lesson.english, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            Text(
                if (lesson.type == "word") "Word • say \"${lesson.phoneme}\"" else "Letter • sound \"${lesson.phoneme}\"",
                color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp
            )
            Spacer(Modifier.height(6.dp))
            StarRow(filled = lesson.difficulty, total = 3, starSize = 16)
        }
        Box(
            Modifier.size(36.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.3f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Rounded.ChevronRight, null, tint = Color.White)
        }
    }
}

@Composable
fun BackCircle(onClick: () -> Unit) {
    Box(
        Modifier.size(44.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.22f)).clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Icon(Icons.AutoMirrored.Rounded.ArrowBack, null, tint = Color.White)
    }
}
