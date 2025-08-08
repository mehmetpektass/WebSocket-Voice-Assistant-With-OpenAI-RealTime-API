import express from "express";
import dotenv from 'dotenv';
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import http from "http";
import path from "path";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(process.cwd(), "client")));

// OpenAI Realtime API WebSocket URL
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

wss.on("connection", async (clientWs) => {
    console.log("New client WebSocket connection established");

    // Connect to OpenAI's Realtime API
    const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1",
        },
    });

    let sessionConfigured = false;

    openaiWs.on("open", () => {
        console.log("Connected to OpenAI Realtime API");
        
        // Configure session according to OpenAI documentation
        const sessionUpdate = {
            type: "session.update",
            session: {
                modalities: ["text", "audio"],
                instructions: `You are a multilingual voice assistant. You are friendly, helpful, and speak in a polite and concise tone.

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
                - Always maintain the conversation in the user's language, as long as it is supported.`,
                voice: "alloy",
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                input_audio_transcription: {
                    model: "whisper-1"
                },
                turn_detection: {
                    type: "server_vad",
                    threshold: 0.7,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 800
                },
                temperature: 0.8,
                max_response_output_tokens: 4096
            }
        };

        openaiWs.send(JSON.stringify(sessionUpdate));
        sessionConfigured = true;

        // Send session info to client
        clientWs.send(JSON.stringify({
            type: "session",
            data: {
                status: "connected",
                model: "gpt-4o-realtime-preview-2024-10-01"
            }
        }));
    });

    openaiWs.on("message", (data) => {
        try {
            const event = JSON.parse(data.toString());
            console.log("OpenAI event:", event.type);

            // Forward relevant events to client
            switch (event.type) {
                case "session.created":
                case "session.updated":
                    console.log("Session configured successfully");
                    break;

                case "input_audio_buffer.speech_started":
                    console.log("User speech started");
                    clientWs.send(JSON.stringify({
                        type: "speech_started"
                    }));
                    break;

                case "input_audio_buffer.speech_stopped":
                    console.log("User speech stopped");
                    clientWs.send(JSON.stringify({
                        type: "speech_stopped"
                    }));
                    break;

                case "conversation.item.input_audio_transcription.completed":
                    console.log("User transcript:", event.transcript);
                    clientWs.send(JSON.stringify({
                        type: "user_transcript",
                        transcript: event.transcript
                    }));
                    break;

                case "response.created":
                    console.log("Response created");
                    break;

                case "response.output_item.added":
                    console.log("Output item added");
                    break;

                case "response.content_part.added":
                    console.log("Content part added");
                    break;

                case "response.audio.delta":
                    // Forward audio data to client
                    if (event.delta) {
                        const audioBuffer = Buffer.from(event.delta, 'base64');
                        clientWs.send(audioBuffer);
                    }
                    break;

                case "response.audio_transcript.delta":
                    console.log("AI transcript delta:", event.delta);
                    clientWs.send(JSON.stringify({
                        type: "ai_transcript_delta",
                        delta: event.delta
                    }));
                    break;

                case "response.audio_transcript.done":
                    clientWs.send(JSON.stringify({
                        type: "ai_transcript_done"
                    }));
                    break;

                case "response.done":
                    console.log("Response completed");
                    clientWs.send(JSON.stringify({
                        type: "response_done"
                    }));
                    break;

                case "error":
                    console.error("OpenAI error:", event.error);
                    clientWs.send(JSON.stringify({
                        type: "error",
                        error: event.error
                    }));
                    break;

                default:
                    console.log("Unhandled OpenAI event:", event.type);
            }
        } catch (error) {
            console.error("Error parsing OpenAI message:", error);
        }
    });

    openaiWs.on("error", (error) => {
        console.error("OpenAI WebSocket error:", error);
        clientWs.send(JSON.stringify({
            type: "error",
            error: { message: "OpenAI connection error" }
        }));
    });

    openaiWs.on("close", () => {
        console.log("OpenAI WebSocket connection closed");
        clientWs.close();
    });

    // Handle messages from client
    clientWs.on("message", async (message, isBinary) => {
        if (!sessionConfigured) {
            console.log("Session not configured yet, ignoring message");
            return;
        }

        try {
            if (isBinary) {
                // Handle binary audio data
                const audioBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message);
                if (audioBuffer.length === 0) {
                    console.log("Received empty audio buffer, skipping");
                    return;
                }

                console.log(`Forwarding ${audioBuffer.length} bytes of audio to OpenAI`);
                
                // Send audio using input_audio_buffer.append
                const audioEvent = {
                    type: "input_audio_buffer.append",
                    audio: audioBuffer.toString('base64')
                };

                openaiWs.send(JSON.stringify(audioEvent));
                return;
            }

            // Handle JSON messages
            const data = JSON.parse(message.toString());
            console.log("Received client message:", data.type);

            switch (data.type) {
                case "start_conversation":
                    console.log("Starting conversation");
                    
                    // Clear any existing audio buffer
                    openaiWs.send(JSON.stringify({
                        type: "input_audio_buffer.clear"
                    }));

                    clientWs.send(JSON.stringify({
                        type: "conversation_started",
                        message: "Conversation Started"
                    }));
                    break;

                case "stop_conversation":
                    console.log("Stopping conversation");

                    clientWs.send(JSON.stringify({
                        type: "conversation_stopped",
                        message: "Conversation Stopped"
                    }));
                    break;

                case "cancel_response":
                    console.log("Cancelling current response");
                    openaiWs.send(JSON.stringify({
                        type: "response.cancel"
                    }));
                    break;

                case "create_response":
                    console.log("Creating response manually");
                    openaiWs.send(JSON.stringify({
                        type: "response.create",
                        response: {
                            modalities: ["text", "audio"],
                            instructions: data.instructions || "Please respond to the user."
                        }
                    }));
                    break;

                default:
                    console.log("Unknown client message type:", data.type);
            }
        } catch (error) {
            console.error("Error processing client message:", error);
            clientWs.send(JSON.stringify({
                type: "error",
                error: { message: "Invalid message format" }
            }));
        }
    });

    // Handle client disconnect
    clientWs.on("close", () => {
        console.log("Client WebSocket connection closed");
        if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
        }
    });

    clientWs.on("error", (error) => {
        console.error("Client WebSocket error:", error);
    });
});

app.get("/", (req, res) => {
    res.sendFile("index.html", { root: "./client" });
});

server.listen(3000, () => {
    console.log("WebSocket Server listening on http://localhost:3000");
});