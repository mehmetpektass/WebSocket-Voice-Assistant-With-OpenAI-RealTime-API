const ws = new WebSocket("ws://localhost:3000");
ws.binaryType = "arraybuffer";

ws.onopen = () => {
    console.log("WS connected");
};

ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};

ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
};

// Handle messages from server
ws.onmessage = async (e) => {
    if (typeof e.data === "string") {
        console.log("Received string message from server");
        const msg = JSON.parse(e.data);
        console.log("Parsed message:", msg);

        if (msg.type === "session") {
            document.getElementById("status").textContent = "Bağlantı hazır, konuşabilirsiniz";
            console.log("Session ready");
        } else if (msg.type === "conversation_started") {
            console.log("Conversation started confirmation received");
        } else if (msg.type === "conversation_stopped") {
            console.log("Conversation stopped confirmation received");
        } else if (msg.type === "error") {
            console.error("Server error:", msg.error);
        }
    } else {
        console.log(`Received binary audio data: ${e.data.byteLength} bytes`);
        playAudio(e.data);
    }
};

let audioCtx, processor, source;

document.getElementById("voiceBtn").addEventListener("click", async () => {
    if (processor) {
        console.log("Stopping recording...");
        ws.send(JSON.stringify({ type: "stop_conversation" }));
        processor.disconnect();
        source.disconnect();
        await audioCtx.close();
        processor = null;
        document.getElementById("voiceBtn").textContent = "🎤";
        document.getElementById("status").textContent = "Stoped";
        viz.stop();
        return;
    } else {
        // Reset mute state on new recording
        isMuted = false;
        muteBtn.textContent = "🔇";
        muteBtn.title = "Mute microphone";
    }

    console.log("Starting recording...");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 48000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        console.log("Got media stream");
        viz.start(stream);

        // AudioContext – most browsers open at 48,000 Hz
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log(`AudioContext sample rate: ${audioCtx.sampleRate}`);

        source = audioCtx.createMediaStreamSource(stream);

        // ScriptProcessor – 16384 samples for better buffering
        processor = audioCtx.createScriptProcessor(16384, 1, 1);

        processor.onaudioprocess = (e) => {
            if (isMuted) {
                // Still process audio for visualization but don't send
                const floatBuf = e.inputBuffer.getChannelData(0);
                // ... (keep visualization code if needed)
                return;
            }



            const floatBuf = e.inputBuffer.getChannelData(0);

            // Check if we have actual audio data (not silence)
            let hasAudio = false;
            let maxAmplitude = 0;
            for (let i = 0; i < floatBuf.length; i++) {
                const amplitude = Math.abs(floatBuf[i]);
                maxAmplitude = Math.max(maxAmplitude, amplitude);
                if (amplitude > 0.001) {
                    hasAudio = true;
                }
            }

            // Downsample and PCM conversion
            const downsampled = downsample(floatBuf, audioCtx.sampleRate, 24000);
            if (!downsampled || downsampled.length === 0) {
                console.log("Downsampling failed or resulted in empty buffer");
                return;
            }

            const pcm16 = floatToPCM16(downsampled);

            if (!pcm16 || pcm16.length === 0) {
                console.log("PCM conversion failed or resulted in empty buffer");
                return;
            }

            // Send data in appropriate chunks - ensure minimum 100ms (2400 samples)
            if (pcm16.length >= 2400 && ws.readyState === WebSocket.OPEN) {
                if (hasAudio && maxAmplitude > 0.001) {
                    console.log(`Sending ${pcm16.length} samples (${pcm16.byteLength} bytes) to server, max amplitude: ${maxAmplitude.toFixed(4)}`);
                } else {
                    console.log(`Sending silence: ${pcm16.length} samples`);
                }
                ws.send(pcm16.buffer);
            } else if (pcm16.length > 0) {
                console.log(`Buffer too small: ${pcm16.length} samples, waiting for more data`);
            }
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);

        // Send start conversation message
        console.log("Sending start_conversation message");
        ws.send(JSON.stringify({ type: "start_conversation" }));

        document.getElementById("voiceBtn").textContent = "⏹️";
        document.getElementById("status").textContent = "Konuşun…";

    } catch (error) {
        console.error("Error starting recording:", error);
        document.getElementById("status").textContent = "Mikrofon hatası: " + error.message;
    }
});

function downsample(buffer, inRate, outRate) {
    if (inRate === outRate) return buffer;
    if (outRate > inRate) {
        console.warn(`Output rate (${outRate}) higher than input rate (${inRate})`);
        return buffer;
    }

    const ratio = inRate / outRate;
    const newLength = Math.floor(buffer.length / ratio);
    const result = new Float32Array(newLength);

    if (newLength === 0) {
        console.warn("Downsampling resulted in zero-length buffer");
        return new Float32Array(0);
    }

    for (let i = 0; i < newLength; i++) {
        const startIdx = Math.floor(i * ratio);
        const endIdx = Math.min(Math.floor((i + 1) * ratio), buffer.length);
        let sum = 0;
        let count = 0;

        for (let j = startIdx; j < endIdx; j++) {
            sum += buffer[j];
            count++;
        }

        result[i] = count > 0 ? sum / count : 0;
    }
    return result;
}

function floatToPCM16(floatBuf) {
    if (!floatBuf || floatBuf.length === 0) {
        console.warn("Empty float buffer provided to floatToPCM16");
        return new Int16Array(0);
    }

    const int16 = new Int16Array(floatBuf.length);
    for (let i = 0; i < floatBuf.length; i++) {
        const s = Math.max(-1, Math.min(1, floatBuf[i])); // clamp
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
}

let playAudioCtx, playbackTime = 0;
const activeSources = [];

function playAudio(arrayBuf) {
    console.log(`playAudio called with ${arrayBuf.byteLength} bytes`);

    if (!playAudioCtx) {
        playAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log(`Created playback AudioContext with sample rate: ${playAudioCtx.sampleRate}`);
    }

    const int16 = new Int16Array(arrayBuf);
    const float32 = new Float32Array(int16.length);

    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
    }

    console.log(`Converting ${int16.length} samples to audio buffer`);
    const audioBuffer = playAudioCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const src = playAudioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(playAudioCtx.destination);

    const now = playAudioCtx.currentTime;
    if (playbackTime < now) playbackTime = now;
    src.start(playbackTime);
    playbackTime += audioBuffer.duration;

    src.onended = () => {
        const idx = activeSources.indexOf(src);
        if (idx > -1) activeSources.splice(idx, 1);
        if (playAudioCtx.currentTime + 0.5 > playbackTime)
            playbackTime = playAudioCtx.currentTime;
    };
    activeSources.push(src);
}


let isMuted = false;
const muteBtn = document.getElementById("muteBtn");

// Mute button functionality
muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? "🔈" : "🔇";
    muteBtn.title = isMuted ? "Unmute microphone" : "Mute microphone";
    document.getElementById("status").textContent = isMuted
        ? "Muted (listening)"
        : "Speak";

    console.warn("Ws is not open, cannot send mute_state");  
});


class AudioVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.audioCtx = null;
        this.analyser = null;
        this.rafId = null;
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }
    start(stream) {
        if (!this.audioCtx)
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.7;
        this.audioCtx.createMediaStreamSource(stream).connect(this.analyser);
        this.draw();
    }
    draw() {
        if (!this.analyser) return;
        const bufLen = this.analyser.frequencyBinCount;
        const data = new Uint8Array(bufLen);
        this.analyser.getByteFrequencyData(data);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const barW = (this.canvas.width / bufLen) * 2.5;
        let x = 0;
        for (let i = 0; i < bufLen; i++) {
            const h = (data[i] / 255) * this.canvas.height * 0.6;
            const g = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
            g.addColorStop(0, "#4facfe");
            g.addColorStop(1, "#00f2fe");
            this.ctx.fillStyle = g;
            this.ctx.fillRect(x, this.canvas.height - h, barW, h);
            x += barW + 1;
        }
        this.rafId = requestAnimationFrame(() => this.draw());
        if (isMuted) {
            this.ctx.fillStyle = "rgba(255, 50, 50, 0.5)";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = "white";
            this.ctx.font = "20px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText("MUTED", this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    stop() {
        cancelAnimationFrame(this.rafId);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

const viz = new AudioVisualizer("audioVisualizer");