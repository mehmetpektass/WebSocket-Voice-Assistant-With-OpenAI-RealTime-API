import express from "express";
import dotenv from 'dotenv';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { WebSocketServer } from "ws";
import http from "http"
import path from "path";


dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(process.cwd(), "client")));

//For WebSocket connection
wss.on("connection", async (ws) => {
    console.log("New WebSocket connection established");

    const agent = new RealtimeAgent({
        name: 'Assistant',
        instructions: `
        You are a multilingual voice assistant. You are friendly, helpful, and speak in a polite and concise tone.

        Supported languages:
        - English (en)
        - Spanish (es)
        - Turkish (tr)
        - French (fr)
        - German (de)
        - Italian (it)

        Instructions:
        - When the user speaks in one of the supported languages, always reply in that same language.
        - Never switch languages unless the user switches.
        - If the user speaks in a language you do not support, reply in English and say: "I'm sorry, I currently support only English, Spanish, Turkish, French, German, and Italian."
        - Do not attempt to translate, detect or guess unsupported languages.
        - Keep your responses natural, clear, and not overly formal.

        Important:
        - Do not mix languages in the same response.
        - Always maintain the conversation in the user's language, as long as it is supported.
        `
    });

    const session = new RealtimeSession(agent, {
        apiKey: process.env.OPENAI_API_KEY,
        transport: 'websocket',
        voice: "alloy",
        model: 'gpt-4o-realtime-preview-2025-06-03',
        config: {
            inputAudioFormat: 'pcm16',
            outputAudioFormat: 'pcm16',
            inputAudioTranscription: { model: 'whisper-1'},
            turnDetection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 800
            }
        }
    });

    await session.connect({ apiKey: process.env.OPENAI_API_KEY });

    session.on('error', (err) => console.error('Session error:', err));


    let accumulatedAudio = Buffer.alloc(0);
    let isRecording = false;

    try {
        //Send the sound that comes from OpenAI to client directly
        session.on("conversation.updated", ({ delta }) => {
            if (!isRecording && delta?.audio && ws.readyState === WebSocket.OPEN) {
                console.log(`Sending ${delta.audio.buffer.byteLength} bytes of audio to client`);
                ws.send(Buffer.from(delta.audio.buffer));
            } else if (delta?.text) {
                console.log("There is only text", delta.text);
            }
        });

        session.on("input_audio_buffer.speech_started", async () => {
            console.log("User speech started – interrupting AI");
            isRecording = true;
            try { await session.interrupt(); } catch (e) { console.log("interrupt err", e); }
        });

        session.on("input_audio_buffer.speech_stopped", () => {
            console.log("User speech stopped");
            isRecording = false;
        });


        // Listen to all transport events for debugging
        session.transport.on('*', async (event) => {
            console.log("Transport event:", event.type);
            if (event.type === 'error') {
                console.log("Transport error:", event.error);
            }else if (event.type === "audio_interrupted")
                try { await session.interrupt(); } catch (e) { console.log("interrupt err", e); }

            // Handle audio data directly from transport events
            if (event.type === 'response.audio.delta' && event.delta && ws.readyState === WebSocket.OPEN) {
                console.log('Transport: Sending audio delta to client');
                const audioBuffer = Buffer.from(event.delta, 'base64');
                ws.send(audioBuffer);
            }
        });

        ws.send(
            JSON.stringify({
                type: "session",
                data: {
                    model: "gpt-4o-realtime-preview",
                    session_id: session.id,
                    voice: session.voice,
                    model: session.model,
                    expires_at: Date.now() + 3600000 // 1 hour valid
                },
            })
        );



        // Handle messages from client
        ws.on("message", async (message, isBinary) => {
            try {
                if (isBinary) {
                    // Handle binary audio data
                    if (!isRecording) return;

                    const audioBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message);
                    if (audioBuffer.length === 0) {
                        console.log("Received empty audio buffer, skipping");
                        return;
                    }

                    accumulatedAudio = Buffer.concat([accumulatedAudio, audioBuffer]);

                    // Send audio in chunks when we have enough data
                    if (accumulatedAudio.length >= 4800) { // 100ms worth of audio
                        try {
                            await session.sendAudio(accumulatedAudio, { commit: false });
                            console.log(`Sent ${accumulatedAudio.length} bytes to OpenAI`);
                            accumulatedAudio = Buffer.alloc(0); // Reset buffer
                        } catch (audioError) {
                            console.error("Error sending audio to OpenAI:", audioError);
                        }
                    }
                    return;
                }

                // Handle JSON messages
                const data = JSON.parse(message.toString());
                console.log("Received JSON message:", data.type);

                switch (data.type) {
                    case "start_conversation":
                        isRecording = true;
                        accumulatedAudio = Buffer.alloc(0);

                        try { await session.interrupt(); }
                        catch (e) { console.log("interrupt err", e); }

                        console.log("Started recording");
                        ws.send(JSON.stringify({
                            type: "conversation_started",
                            message: "Conversation Started",
                        }));
                        break;

                    case "stop_conversation":
                        isRecording = false;
                        console.log(`Stopping conversation. Buffer size: ${accumulatedAudio.length} bytes`);

                        // Send any remaining audio data and commit it
                        if (accumulatedAudio.length > 0) {
                            try {
                                await session.sendAudio(accumulatedAudio, { commit: true });
                                console.log(`Sent and committed final ${accumulatedAudio.length} bytes to OpenAI`);
                            } catch (audioError) {
                                console.error("Error sending/committing final audio to OpenAI:", audioError);
                            }
                        }


                        console.log("Server VAD should detect end of speech and generate response automatically");

                        accumulatedAudio = Buffer.alloc(0); // Reset buffer

                        ws.send(JSON.stringify({
                            type: "conversation_stopped",
                            message: "Conversation Stopped",
                        }));
                        break;

                    case "audio":
                        if (typeof data.audio === "string" && data.audio.length > 0) {
                            const audioBuffer = Buffer.from(data.audio, "base64");
                            if (audioBuffer.length > 0) {
                                await session.sendAudio(audioBuffer, { commit: false });
                            }
                        }
                        break;

                    case "mute_state":
                        isMuted = data.muted;
                        console.log(`Client mute state: ${isMuted}`);
                        break;

                    case "error":
                        console.error("Client error:", data.error);
                        break;

                    default:
                        console.log("Unknown message type:", data.type);
                }
            } catch (error) {
                console.error("Error processing message:", error);
                ws.send(JSON.stringify({
                    type: "error",
                    error: "Message processing failed"
                }));
            }
        });

        // Handle connection close
        ws.on("close", () => {
            isRecording = false;
            session.close();
            console.log("WebSocket connection closed");
        });

    } catch (error) {
        console.error("Error creating session:", error);
        ws.send(JSON.stringify({
            type: "error",
            error: "Failed to create session"
        }));
    }
});

app.get("/", (req, res) => {
    res.sendFile("index.html", { root: "./client" });
});

server.listen(3000, () => {
    console.log("WebSocket Server listening on http://localhost:3000");
});
