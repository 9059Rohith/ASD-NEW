package com.team96.speakeasy.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val SpeakEasyColors = lightColorScheme(
    primary = Purple,
    onPrimary = CloudWhite,
    secondary = Pink,
    onSecondary = CloudWhite,
    tertiary = Teal,
    background = CloudWhite,
    onBackground = InkDark,
    surface = CardWhite,
    onSurface = InkDark,
    primaryContainer = Lemon,
    onPrimaryContainer = InkDark,
)

@Composable
fun SpeakEasyTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = SpeakEasyColors,
        typography = AppTypography,
        content = content
    )
}
