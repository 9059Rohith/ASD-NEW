package com.team96.speakeasy.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.team96.speakeasy.ui.screens.CandleGameScreen
import com.team96.speakeasy.ui.screens.HomeScreen
import com.team96.speakeasy.ui.screens.LessonsScreen
import com.team96.speakeasy.ui.screens.LoginScreen
import com.team96.speakeasy.ui.screens.OnboardingScreen
import com.team96.speakeasy.ui.screens.PracticeScreen
import com.team96.speakeasy.ui.screens.ProfileScreen
import com.team96.speakeasy.ui.screens.ProgressScreen
import com.team96.speakeasy.ui.screens.RegisterScreen
import com.team96.speakeasy.ui.screens.RewardsScreen
import com.team96.speakeasy.ui.screens.SplashScreen
import com.team96.speakeasy.viewmodel.AppViewModel
import com.team96.speakeasy.viewmodel.AuthViewModel

object Routes {
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val HOME = "home"
    const val LESSONS = "lessons"
    const val PRACTICE = "practice"
    const val CANDLE = "candle"
    const val PROGRESS = "progress"
    const val REWARDS = "rewards"
    const val PROFILE = "profile"
}

@Composable
fun AppNavGraph() {
    val nav = rememberNavController()
    val authVm: AuthViewModel = viewModel()
    val appVm: AppViewModel = viewModel()

    NavHost(
        navController = nav,
        startDestination = Routes.SPLASH,
        enterTransition = { slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Left, tween(380)) + fadeIn(tween(380)) },
        exitTransition = { fadeOut(tween(250)) },
        popEnterTransition = { fadeIn(tween(300)) },
        popExitTransition = { slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Right, tween(380)) + fadeOut(tween(380)) },
    ) {
        composable(Routes.SPLASH) { SplashScreen(nav) }
        composable(Routes.ONBOARDING) { OnboardingScreen(nav) }
        composable(Routes.LOGIN) { LoginScreen(nav, authVm) }
        composable(Routes.REGISTER) { RegisterScreen(nav, authVm) }
        composable(Routes.HOME) { HomeScreen(nav, appVm) }
        composable(Routes.LESSONS) { LessonsScreen(nav, appVm) }
        composable(
            "${Routes.PRACTICE}/{lessonId}",
            arguments = listOf(navArgument("lessonId") { type = NavType.IntType })
        ) { entry ->
            val id = entry.arguments?.getInt("lessonId") ?: 1
            PracticeScreen(nav, appVm, id)
        }
        composable(Routes.CANDLE) { CandleGameScreen(nav) }
        composable(Routes.PROGRESS) { ProgressScreen(nav, appVm) }
        composable(Routes.REWARDS) { RewardsScreen(nav, appVm) }
        composable(Routes.PROFILE) { ProfileScreen(nav, authVm) }
    }
}
