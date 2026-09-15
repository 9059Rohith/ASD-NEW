package com.team96.speakeasy.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/**
 * Records microphone audio to an .m4a (AAC) file for upload to the speech-evaluation
 * endpoint, and also exposes live amplitude for the candle-blow mini-game.
 */
class VoiceRecorder(private val context: Context) {

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null

    fun start(): Boolean {
        if (recorder != null) return false
        return try {
            val file = File(context.cacheDir, "speech_${System.currentTimeMillis()}.m4a")
            outputFile = file
            val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            recorder = rec
            rec.setAudioSource(MediaRecorder.AudioSource.MIC)
            rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            rec.setAudioEncodingBitRate(128000)
            rec.setAudioSamplingRate(44100)
            rec.setOutputFile(file.absolutePath)
            rec.prepare()
            rec.start()
            recorder = rec
            true
        } catch (e: Exception) {
            e.printStackTrace()
            cancel()
            false
        }
    }

    /** Current peak amplitude (0..32767). Safe to call repeatedly while recording. */
    fun amplitude(): Int = try {
        recorder?.maxAmplitude ?: 0
    } catch (e: Exception) {
        0
    }

    /** Stops recording and returns the recorded file (or null on failure). */
    fun stop(): File? {
        if (recorder == null) return null
        return try {
            recorder?.stop()
            recorder?.release()
            recorder = null
            outputFile
        } catch (e: Exception) {
            recorder?.release()
            recorder = null
            outputFile?.delete()
            outputFile = null
            null
        }
    }

    fun cancel() {
        try {
            recorder?.stop()
        } catch (_: Exception) {
        }
        recorder?.release()
        recorder = null
        outputFile?.delete()
        outputFile = null
    }
}
