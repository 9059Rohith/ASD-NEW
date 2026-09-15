`jfk.wav` is the public human-speech example distributed by whisper.cpp:
https://github.com/ggml-org/whisper.cpp/blob/master/samples/jfk.wav

The live Chromium test feeds it through the browser's audio capture device,
MediaRecorder, WAV conversion, API, real ONNX inference, and database persistence.
It is English speech and deliberately does not match a Tamil single-vowel target.
It verifies transport and acoustic inference, not Tamil clinical accuracy and not
a physical microphone or a child's speech.
