package com.team96.speakeasy.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Air
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.MenuBook
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.ShowChart
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.navigation.Routes
import com.team96.speakeasy.ui.theme.Coral
import com.team96.speakeasy.ui.theme.GradientPlay
import com.team96.speakeasy.ui.theme.Ocean
import com.team96.speakeasy.ui.theme.Orange
import com.team96.speakeasy.ui.theme.Pink
import com.team96.speakeasy.ui.theme.Purple
import com.team96.speakeasy.ui.theme.Sky
import com.team96.speakeasy.ui.theme.Sunny
import com.team96.speakeasy.ui.theme.Teal
import com.team96.speakeasy.viewmodel.AppViewModel

private data class Feature(val title: String, val subtitle: String, val icon: ImageVector, val grad: List<Color>, val route: String)

@Composable
fun HomeScreen(nav: NavController, vm: AppViewModel) {
    val stats by vm.stats.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.loadHome() }

    val animatedStars by animateIntAsState(targetValue = stats.stars, animationSpec = tween(900), label = "stars")

    val features = listOf(
        Feature("Lessons", "Letters & words", Icons.Rounded.MenuBook, listOf(Pink, Coral), Routes.LESSONS),
        Feature("Candle Game", "Blow to win!", Icons.Rounded.Air, listOf(Teal, Color(0xFF26C6DA)), Routes.CANDLE),
        Feature("My Progress", "See how you grow", Icons.Rounded.ShowChart, listOf(Sky, Ocean), Routes.PROGRESS),
        Feature("Rewards", "Your shiny stars", Icons.Rounded.EmojiEvents, listOf(Sunny, Orange), Routes.REWARDS),
    )

    AnimatedGradientBackground(GradientPlay) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)
        ) {
            Spacer(Modifier.height(36.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Hi, ${stats.childName}! 👋", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Ready to play and learn?", color = Color.White.copy(alpha = 0.9f), fontSize = 15.sp)
                }
                Box(
                    Modifier.size(54.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.22f))
                        .clickable { nav.navigate(Routes.PROFILE) },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.Person, null, tint = Color.White, modifier = Modifier.size(30.dp))
                }
            }

            Spacer(Modifier.height(22.dp))
            StatsBanner(stars = animatedStars, sessions = stats.sessions, completed = stats.completedLessons)

            Spacer(Modifier.height(26.dp))
            Text("Choose an activity", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(14.dp))

            for (rowIndex in features.indices step 2) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    FeatureCard(features[rowIndex], Modifier.weight(1f)) { nav.navigate(features[rowIndex].route) }
                    if (rowIndex + 1 < features.size) {
                        FeatureCard(features[rowIndex + 1], Modifier.weight(1f)) { nav.navigate(features[rowIndex + 1].route) }
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                }
                Spacer(Modifier.height(14.dp))
            }

            Spacer(Modifier.height(8.dp))
            MascotTip()
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun StatsBanner(stars: Int, sessions: Int, completed: Int) {
    Row(
        Modifier
            .fillMaxWidth()
            .shadow(10.dp, RoundedCornerShape(26.dp))
            .clip(RoundedCornerShape(26.dp))
            .background(Color.White)
            .padding(vertical = 18.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        StatItem(stars.toString(), "Stars", Sunny, Icons.Rounded.Star)
        Divider()
        StatItem(sessions.toString(), "Sessions", Teal, Icons.Rounded.Air)
        Divider()
        StatItem(completed.toString(), "Mastered", Pink, Icons.Rounded.EmojiEvents)
    }
}

@Composable
private fun StatItem(value: String, label: String, color: Color, icon: ImageVector) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, null, tint = color, modifier = Modifier.size(26.dp))
        Spacer(Modifier.height(4.dp))
        Text(value, color = Color(0xFF2A1A4A), fontSize = 24.sp, fontWeight = FontWeight.Black)
        Text(label, color = Color(0xFF8A7FB0), fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun Divider() {
    Box(Modifier.width(1.dp).height(48.dp).background(Color(0xFFEDE8F7)))
}

@Composable
private fun FeatureCard(f: Feature, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val t = rememberInfiniteTransition(label = "card")
    val float by t.animateFloat(-3f, 3f, infiniteRepeatable(tween(2000), RepeatMode.Reverse), label = "float")
    Box(
        modifier
            .aspectRatio(1f)
            .scale(1f)
            .shadow(10.dp, RoundedCornerShape(26.dp))
            .clip(RoundedCornerShape(26.dp))
            .background(Brush.linearGradient(f.grad))
            .clickable { onClick() }
            .padding(18.dp)
    ) {
        Box(
            Modifier.size(52.dp).rotate(float).clip(CircleShape).background(Color.White.copy(alpha = 0.25f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(f.icon, null, tint = Color.White, modifier = Modifier.size(30.dp))
        }
        Column(Modifier.align(Alignment.BottomStart)) {
            Text(f.title, color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
            Text(f.subtitle, color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp)
        }
    }
}

@Composable
private fun MascotTip() {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Color.White.copy(alpha = 0.18f))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(48.dp).clip(CircleShape).background(Color.White),
            contentAlignment = Alignment.Center
        ) { Text("🦉", fontSize = 26.sp) }
        Spacer(Modifier.width(14.dp))
        Column {
            Text("Tip from Hooty", color = Color.White, fontWeight = FontWeight.Bold)
            Text("Speak slowly and clearly — you've got this!", color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp)
        }
    }
}
