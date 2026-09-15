package com.team96.speakeasy.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.theme.GradientWarm
import com.team96.speakeasy.ui.theme.LessonColors
import com.team96.speakeasy.viewmodel.AppViewModel

private data class Badge(val emoji: String, val title: String, val needStars: Int)

@Composable
fun RewardsScreen(nav: NavController, vm: AppViewModel) {
    val stats by vm.stats.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.loadHome() }

    val badges = listOf(
        Badge("🌱", "First Words", 1),
        Badge("⭐", "Rising Star", 5),
        Badge("🔥", "On Fire", 10),
        Badge("🎤", "Mic Master", 20),
        Badge("🏆", "Champion", 35),
        Badge("👑", "Speech King", 50),
        Badge("🚀", "To the Moon", 75),
        Badge("💎", "Legend", 100),
    )

    AnimatedGradientBackground(GradientWarm) {
        Column(Modifier.fillMaxSize().padding(20.dp)) {
            Spacer(Modifier.height(34.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                BackCircle { nav.popBackStack() }
                Spacer(Modifier.width(14.dp))
                Text("Rewards", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
            }

            Spacer(Modifier.height(20.dp))
            // Animated star jar
            val t = rememberInfiniteTransition(label = "jar")
            val bob by t.animateFloat(0.96f, 1.04f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "bob")
            Box(
                Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(28.dp))
                    .background(Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.22f), Color.White.copy(alpha = 0.10f)))),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("⭐", fontSize = 64.sp, modifier = Modifier.scale(bob))
                    Text("${stats.stars} Stars Collected", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
                }
            }

            Spacer(Modifier.height(22.dp))
            Text("Badges", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(12.dp))

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(badges.size) { i ->
                    val b = badges[i]
                    val unlocked = stats.stars >= b.needStars
                    BadgeCard(b, unlocked, i)
                }
            }
        }
    }
}

@Composable
private fun BadgeCard(b: Badge, unlocked: Boolean, index: Int) {
    val grad = LessonColors[index % LessonColors.size]
    val t = rememberInfiniteTransition(label = "badge$index")
    val wob by t.animateFloat(-5f, 5f, infiniteRepeatable(tween(1800), RepeatMode.Reverse), label = "wob")
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(if (unlocked) Brush.linearGradient(grad) else Brush.linearGradient(listOf(Color.White.copy(0.12f), Color.White.copy(0.08f))))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            Modifier.size(60.dp).clip(CircleShape).background(Color.White.copy(alpha = if (unlocked) 0.9f else 0.25f)),
            contentAlignment = Alignment.Center
        ) {
            Text(if (unlocked) b.emoji else "🔒", fontSize = 30.sp, modifier = if (unlocked) Modifier.rotate(wob) else Modifier)
        }
        Spacer(Modifier.height(8.dp))
        Text(b.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp, textAlign = TextAlign.Center)
        Text(
            if (unlocked) "Unlocked!" else "${b.needStars} stars",
            color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp
        )
    }
}
