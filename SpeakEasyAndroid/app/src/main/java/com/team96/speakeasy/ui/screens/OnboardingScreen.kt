package com.team96.speakeasy.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.foundation.background
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.School
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.components.BouncyButton
import com.team96.speakeasy.ui.components.GhostButton
import com.team96.speakeasy.ui.navigation.Routes
import com.team96.speakeasy.ui.theme.GradientCalm
import com.team96.speakeasy.ui.theme.GradientPlay
import com.team96.speakeasy.ui.theme.GradientWarm
import com.team96.speakeasy.ui.theme.Pink
import kotlinx.coroutines.launch

private data class Page(val icon: ImageVector, val title: String, val body: String, val grad: List<Color>)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(nav: NavController) {
    val pages = listOf(
        Page(Icons.Rounded.School, "Learn Letters & Words", "Practice Tamil sounds with playful lessons made just for you.", GradientPlay),
        Page(Icons.Rounded.Mic, "Speak & Get Feedback", "Tap the mic, say the sound, and our AI cheers you on!", GradientCalm),
        Page(Icons.Rounded.EmojiEvents, "Earn Stars & Rewards", "Collect stars, blow out candles, and become a speaking superstar!", GradientWarm),
    )
    val pager = rememberPagerState(pageCount = { pages.size })
    val scope = rememberCoroutineScope()
    val current = pages[pager.currentPage]

    AnimatedGradientBackground(current.grad) {
        Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (pager.currentPage < pages.size - 1) {
                    Text(
                        "Skip",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 28.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.15f)).padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
            }
            HorizontalPager(state = pager, modifier = Modifier.weight(1f)) { index ->
                val p = pages[index]
                Column(
                    Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    WobbleIcon(p.icon)
                    Spacer(Modifier.height(40.dp))
                    Text(p.title, color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(14.dp))
                    Text(p.body, color = Color.White.copy(alpha = 0.92f), fontSize = 17.sp, textAlign = TextAlign.Center, lineHeight = 24.sp)
                }
            }
            Row(Modifier.padding(vertical = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(pages.size) { i ->
                    val selected = i == pager.currentPage
                    Box(
                        Modifier
                            .height(10.dp)
                            .size(if (selected) 28.dp else 10.dp, 10.dp)
                            .clip(CircleShape)
                            .background(if (selected) Color.White else Color.White.copy(alpha = 0.45f))
                    )
                }
            }
            if (pager.currentPage == pages.size - 1) {
                BouncyButton("Get Started 🚀", listOf(Color.White, Color(0xFFFFE9F4))) {
                    nav.navigate(Routes.REGISTER)
                }
                Spacer(Modifier.height(12.dp))
                GhostButton("I already have an account") { nav.navigate(Routes.LOGIN) }
            } else {
                BouncyButton("Next", listOf(Pink, Color(0xFFFF7AB6))) {
                    scope.launch { pager.animateScrollToPage(pager.currentPage + 1) }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun WobbleIcon(icon: ImageVector) {
    val t = rememberInfiniteTransition(label = "wobble")
    val rot by t.animateFloat(-8f, 8f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "rot")
    val sc by t.animateFloat(0.95f, 1.05f, infiniteRepeatable(tween(1200), RepeatMode.Reverse), label = "sc")
    Box(
        Modifier.size(180.dp).scale(sc).clip(CircleShape).background(Color.White.copy(alpha = 0.20f)),
        contentAlignment = Alignment.Center
    ) {
        Box(
            Modifier.size(130.dp).clip(CircleShape).background(Color.White),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, null, tint = com.team96.speakeasy.ui.theme.Purple, modifier = Modifier.size(70.dp).rotate(rot))
        }
    }
}
