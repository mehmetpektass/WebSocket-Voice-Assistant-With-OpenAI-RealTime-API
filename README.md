 # 🗣️ Multilingual Real-Time AI Voice Assistant

## Description  
This project is a real-time, multilingual AI voice assistant built on Node.js and WebSockets. It leverages OpenAI's advanced GPT-4o Real-Time API to provide instant, natural, and conversational interactions. It also includes custom tool-calling capabilities to perform actions like sending emails, making it a highly functional and interactive application.

<br>

## Features

### 1. Real-Time Communication ⚡
* **🌐 WebSockets:** Uses WebSockets for low-latency, real-time communication between the client and the server, and the server and OpenAI's API.

* **👂 Live Audio Streaming:** Streams raw audio data to the AI model and receives real-time audio responses, creating a fluid conversational experience.

* **🖼️ Audio Visualization:** Includes a live audio visualizer on the client-side to provide visual feedback during speech.

### 2. Multilingual Support 🌍
* **🗣️ Natural Conversation:** Provides a smooth, turn-based conversational flow.

* **🇹🇷 Multilingual:** Supports English, Spanish, Turkish, French, German, and Italian. The assistant automatically detects and responds in the user's language.

### 3. Tool-Calling Integration 🛠️
* **✉️ Email Sending:** Integrates with a separate local email service to allow the AI to send emails on behalf of the user. This functionality is enabled through OpenAI's function-calling mechanism.

* **📝 Templated Emails:** The project supports sending both basic text emails and advanced, professionally-styled HTML emails using predefined templates.

### 4. Robust Architecture 🚀
* **⚙️ Node.js Backend:** The server is built with Node.js and Express, acting as a secure intermediary between the client and OpenAI.

* **🚀 Efficient Audio Processing:** Implements audio processing on the client to downsample and convert audio to the required PCM16 format before sending it to the server, ensuring optimal performance.

<br>

## Core Technologies
### Frameworks & Libraries
* **Node.js:** The JavaScript runtime environment for the backend.

* **Express.js:** A minimal and flexible Node.js web application framework.

* **WebSockets (ws):** Used for real-time, bidirectional communication.

* **OpenAI API:** Specifically, the GPT-4o Real-Time API is used for its low-latency and conversational capabilities.

* **dotenv:** Loads environment variables for secure API key management.

<br>

## Installation & Setup

### Prerequisites:
- Node.js 16+
- An OpenAI API key
- The **local email service** project (available [here](https://github.com/mehmetpektass/Services/tree/main/Sending_Email_With_Nodemailer)) must be running on `http://localhost:4000`.

<br>

* **1.Clone the repository:**
```
git clone https://github.com/mehmetpektass/WebSocket-Voice-Assistant-With-OpenAI-RealTime-API.git
cd CbotAIVoiceAssistant
```

* **2.Install dependencies:**
```
npm install express openai openai-realtime-api ws body-parser dotenv 
```

* **3. Set up environment variables:**
```
OPENAI_API_KEY="YOUR_API_KEY_HERE"
```

* **4.Start the email service:**

*Ensure your email service project is running and accessible at, this project is required for the email-sending tools to function.*
```
http://localhost:4000
```


* **5. Run the application:**
```
npm start
```

<br>
<br>

## Usage

* Click the "🎤" button to start a conversation. The button will change to "⏹️" to indicate that the assistant is listening.

* Speak naturally. The assistant will detect when you're done speaking and begin its response.

* The conversation transcript will appear on the screen in real-time.

* You can ask the assistant to perform actions like sending an email by using a phrase like, "Can you send an email to [recipient] with the subject [subject] and the message [message]?"

<br>
<br>

## Contribution Guidelines 🚀

##### Pull requests are welcome. If you'd like to contribute, please:
- Fork the repository
- Create a feature branch
- Submit a pull request with a clear description of changes
- Ensure code follows existing style patterns
- Update documentation as needed
