package com.team96.speakeasy.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.team96.speakeasy.data.Api
import com.team96.speakeasy.data.Lesson
import com.team96.speakeasy.data.ProgressSummary
import com.team96.speakeasy.data.SaveProgressRequest
import com.team96.speakeasy.data.SpeechResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

data class HomeStats(
    val stars: Int = 0,
    val sessions: Int = 0,
    val childName: String = "Friend",
    val completedLessons: Int = 0,
)

class AppViewModel : ViewModel() {

    private val _lessons = MutableStateFlow<List<Lesson>>(emptyList())
    val lessons: StateFlow<List<Lesson>> = _lessons

    private val _summary = MutableStateFlow(ProgressSummary())
    val summary: StateFlow<ProgressSummary> = _summary

    private val _lessonsError = MutableStateFlow<String?>(null)
    val lessonsError: StateFlow<String?> = _lessonsError

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    private val _stats = MutableStateFlow(HomeStats())
    val stats: StateFlow<HomeStats> = _stats

    fun loadHome() {
        viewModelScope.launch {
            _loading.value = true
            try {
                val me = Api.service.me()
                _stats.value = _stats.value.copy(
                    childName = me.childName?.takeIf { it.isNotBlank() } ?: "Friend",
                )
            } catch (_: Exception) {
            }
            try {
                _lessons.value = Api.service.lessons()
                _lessonsError.value = null
            } catch (_: Exception) {
                _lessonsError.value = "Lessons could not be loaded. Check your connection and try again."
            }
            refreshStats()
            _loading.value = false
        }
    }

    fun lessonById(id: Int): Lesson? = _lessons.value.firstOrNull { it.id == id }

    /** Records audio result -> uploads -> saves progress. Returns SpeechResult via callback. */
    fun evaluate(
        file: File,
        lesson: Lesson,
        durationMs: Long,
        onResult: (SpeechResult, Int) -> Unit,
        onError: (String) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val part = MultipartBody.Part.createFormData(
                        "audio", file.name,
                        file.asRequestBody("audio/mp4".toMediaTypeOrNull())
                    )
                    val phoneme = lesson.phoneme.toRequestBody("text/plain".toMediaTypeOrNull())
                    val lid = lesson.id.toString().toRequestBody("text/plain".toMediaTypeOrNull())
                    Api.service.evaluateSpeech(part, phoneme, lid)
                }
                val accuracy = (result.accuracy ?: 0.0)
                if (result.scorable != true || result.evaluationReceipt.isNullOrBlank()) {
                    onError(result.feedback?.takeIf { it.isNotBlank() }
                        ?: "This recording could not be scored. Please retry.")
                    return@launch
                }
                val saved = try {
                    Api.service.saveProgress(
                        SaveProgressRequest(
                            evaluationReceipt = result.evaluationReceipt,
                            lessonId = lesson.id,
                            phoneme = lesson.phoneme,
                            lessonType = lesson.type,
                            accuracy = accuracy,
                            phonemeMatch = result.phonemeMatch ?: false,
                            mfccScore = result.mfccScore ?: 0.0,
                            feedback = result.feedback ?: "",
                            durationMs = durationMs,
                        )
                    )
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    onError("Analysis completed, but progress could not be saved. Check your connection.")
                    return@launch
                }
                onResult(result, saved.starsEarned ?: result.starsEarned ?: starsFor(accuracy))
                viewModelScope.launch { refreshStats() }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                onError(
                    if ((e.message ?: "").contains("connect", true))
                        "Can't reach the server. Is the backend running?"
                    else "Could not evaluate audio. Try again."
                )
            } finally {
                file.delete()
            }
        }
    }

    private suspend fun refreshStats() {
        try {
            val latest = Api.service.progressSummary("me")
            _summary.value = latest
            _stats.value = _stats.value.copy(
                stars = latest.totalStars ?: 0,
                sessions = latest.totalSessions ?: 0,
                completedLessons = latest.completedLessons ?: 0,
            )
        } catch (_: Exception) {
        }
    }

    companion object {
        fun starsFor(accuracy: Double): Int = when {
            accuracy >= 90 -> 3
            accuracy >= 70 -> 2
            accuracy >= 50 -> 1
            else -> 0
        }
    }
}
