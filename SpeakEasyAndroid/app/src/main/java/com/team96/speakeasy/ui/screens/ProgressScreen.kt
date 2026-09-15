package com.team96.speakeasy.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.theme.GradientCalm
import com.team96.speakeasy.ui.theme.LessonColors
import com.team96.speakeasy.ui.theme.Pink
import com.team96.speakeasy.ui.theme.Sunny
import com.team96.speakeasy.ui.theme.Teal
import com.team96.speakeasy.viewmodel.AppViewModel

@Composable
fun ProgressScreen(nav: NavController, vm: AppViewModel) {
    val stats by vm.stats.collectAsStateWithLifecycle()
    val lessons by vm.lessons.collectAsStateWithLifecycle()
    val summary by vm.summary.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.loadHome() }

    AnimatedGradientBackground(GradientCalm) {
        Column(Modifier.fillMaxSize().padding(20.dp)) {
            Spacer(Modifier.height(34.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                BackCircle { nav.popBackStack() }
                Spacer(Modifier.width(14.dp))
                Text("My Progress", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.height(20.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard("Stars", stats.stars.toString(), Icons.Rounded.Star, listOf(Sunny, Color(0xFFFF9800)), Modifier.weight(1f))
                MetricCard("Sessions", stats.sessions.toString(), Icons.Rounded.LocalFireDepartment, listOf(Pink, Color(0xFFFF5252)), Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
            MetricCard("Lessons Mastered", "${stats.completedLessons} / ${(summary.totalLessons ?: 0).takeIf { it > 0 } ?: lessons.size}", Icons.Rounded.TrendingUp, listOf(Teal, Color(0xFF26C6DA)), Modifier.fillMaxWidth())

            Spacer(Modifier.height(24.dp))
            Text("Recent pronunciation scores", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(12.dp))

            val recentScores = summary.chartData.orEmpty().takeLast(6)
            Box(
                Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(24.dp)).background(Color.White.copy(alpha = 0.16f)).padding(16.dp)
            ) {
                if (recentScores.isEmpty()) {
                    Text("Complete a speech lesson to see your scores here.", color = Color.White, modifier = Modifier.align(Alignment.Center))
                } else {
                    Row(
                        Modifier.fillMaxSize(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.Bottom
                    ) {
                        recentScores.forEachIndexed { i, point ->
                            val score = (point.accuracy ?: 0.0).coerceIn(0.0, 100.0)
                            val frac by animateFloatAsState((score / 100).toFloat(), tween(900), label = "bar$i")
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f).padding(horizontal = 3.dp)) {
                                Text("${score.toInt()}%", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(4.dp))
                                Box(Modifier.weight(1f), contentAlignment = Alignment.BottomCenter) {
                                    Box(
                                        Modifier
                                            .width(20.dp)
                                            .fillMaxHeight(frac.coerceIn(0f, 1f))
                                            .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
                                            .background(Brush.verticalGradient(LessonColors[i % LessonColors.size]))
                                    )
                                }
                                Spacer(Modifier.height(6.dp))
                                Text(point.date.orEmpty(), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White.copy(alpha = 0.18f)).padding(16.dp)
            ) {
                Text(
                    "🌟 You've earned ${stats.stars} stars across ${stats.sessions} sessions. Keep going — every practice makes you stronger!",
                    color = Color.White, fontSize = 14.sp
                )
            }
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector, grad: List<Color>, modifier: Modifier = Modifier) {
    Row(
        modifier
            .clip(RoundedCornerShape(22.dp))
            .background(Brush.horizontalGradient(grad))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(34.dp))
        Spacer(Modifier.width(12.dp))
        Column {
            Text(value, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text(label, color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }
    }
}
