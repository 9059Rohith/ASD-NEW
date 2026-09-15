package com.team96.speakeasy.data

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.team96.speakeasy.viewmodel.AppViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiContractTest {
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()

    @Test
    fun speechResponseKeepsScoringReceiptAndServerStars() {
        val json = """{"scorable":true,"accuracy":89,"stars_earned":2,"evaluation_receipt":"signed-receipt","actual_phonemes":["a"],"expected_phonemes":["a"]}"""
        val result = moshi.adapter(SpeechResult::class.java).fromJson(json)!!

        assertTrue(result.scorable == true)
        assertEquals("signed-receipt", result.evaluationReceipt)
        assertEquals(2, result.starsEarned)
        assertEquals(listOf("a"), result.actualPhonemes)
    }

    @Test
    fun failedEvaluationWithoutScorableFlagCannotAppearScored() {
        val json = """{"error":"evaluation_failed","accuracy":0,"feedback":"Could not process audio"}"""
        val result = moshi.adapter(SpeechResult::class.java).fromJson(json)!!

        assertFalse(result.scorable == true)
        assertNull(result.evaluationReceipt)
    }

    @Test
    fun progressSummaryReadsSavedTotalsAndRecentScores() {
        val json = """{"total_sessions":3,"total_stars":5,"completed_lessons":2,"total_lessons":16,"avg_accuracy":74.5,"chart_data":[{"date":"09/14","accuracy":82,"lesson_id":1}]}"""
        val summary = moshi.adapter(ProgressSummary::class.java).fromJson(json)!!

        assertEquals(3, summary.totalSessions)
        assertEquals(5, summary.totalStars)
        assertEquals(2, summary.completedLessons)
        assertEquals(16, summary.totalLessons)
        assertEquals(82.0, summary.chartData?.single()?.accuracy)
    }

    @Test
    fun localRewardFallbackMatchesServerThresholds() {
        assertEquals(2, AppViewModel.starsFor(89.0))
        assertEquals(3, AppViewModel.starsFor(90.0))
    }
}
