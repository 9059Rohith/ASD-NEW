package com.team96.speakeasy.data

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

interface ApiService {

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponse

    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @GET("api/auth/me")
    suspend fun me(): User

    @GET("api/therapy/lessons")
    suspend fun lessons(): List<Lesson>

    @Multipart
    @POST("api/evaluate/speech")
    suspend fun evaluateSpeech(
        @Part audio: MultipartBody.Part,
        @Part("target_phoneme") targetPhoneme: RequestBody,
        @Part("lesson_id") lessonId: RequestBody,
    ): SpeechResult

    @POST("api/progress/save")
    suspend fun saveProgress(@Body body: SaveProgressRequest): SaveProgressResponse

    @GET("api/progress/summary/{userId}")
    suspend fun progressSummary(@Path("userId") userId: String): ProgressSummary
}
