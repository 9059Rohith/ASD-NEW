package com.team96.speakeasy.ui.screens

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChildCare
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.team96.speakeasy.data.SessionManager
import com.team96.speakeasy.ui.components.AnimatedGradientBackground
import com.team96.speakeasy.ui.components.BouncyButton
import com.team96.speakeasy.ui.navigation.Routes
import com.team96.speakeasy.ui.theme.Coral
import com.team96.speakeasy.ui.theme.GradientPlay
import com.team96.speakeasy.viewmodel.AuthViewModel

@Composable
fun ProfileScreen(nav: NavController, vm: AuthViewModel) {
    val name = SessionManager.fullName ?: "Parent"
    val child = SessionManager.childName ?: "Little Star"
    val email = SessionManager.email ?: "—"

    AnimatedGradientBackground(GradientPlay) {
        Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(34.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                BackCircle { nav.popBackStack() }
                Spacer(Modifier.width(14.dp))
                Text("Profile", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
            }

            Spacer(Modifier.height(28.dp))
            Box(
                Modifier.size(110.dp).clip(CircleShape).background(Color.White),
                contentAlignment = Alignment.Center
            ) { Text("🧒", fontSize = 56.sp) }
            Spacer(Modifier.height(14.dp))
            Text(child, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black)
            Text("Little learner", color = Color.White.copy(alpha = 0.9f), fontSize = 14.sp)

            Spacer(Modifier.height(28.dp))
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color.White.copy(alpha = 0.16f)).padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                InfoRow(Icons.Rounded.Person, "Parent", name)
                InfoRow(Icons.Rounded.Email, "Email", email)
                InfoRow(Icons.Rounded.ChildCare, "Child", child)
                InfoRow(Icons.Rounded.Language, "Language", "Tamil")
            }

            Spacer(Modifier.weight(1f))
            BouncyButton("Log Out", listOf(Coral, Color(0xFFFF5252))) {
                vm.logout {
                    nav.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            Text("SpeakEasy v1.0 • Team 96", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun InfoRow(icon: ImageVector, label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.22f)),
            contentAlignment = Alignment.Center
        ) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(22.dp)) }
        Spacer(Modifier.width(14.dp))
        Column {
            Text(label, color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp)
            Text(value, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}
