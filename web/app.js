// JARVIS - browser edition
//
// Mirrors the logic in the Python version's main.py, using the browser's
// built-in speech APIs instead of Python libraries:
//   - webkitSpeechRecognition -> turns your voice into text (mic -> text)
//   - speechSynthesis         -> turns text into spoken audio (text -> mic)
// Anything not handled locally (time/date/search) is sent to a Vercel
// serverless function (api/ask.js), which asks Claude and returns the answer.
//
// Note: this can't open apps or files on your computer - browsers sandbox
// JavaScript away from your filesystem for security. That's desktop-only
// (see main.py in the repo root).

const WAKE_WORD = "jarvis";

const micBtn = document.getElementById("mic-btn");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let recognition = null;
let listening = false;   // are we supposed to be listening at all right now
let speaking = false;    // is JARVIS currently talking (pause mic while true)
let awaitingCommand = false; // did we just say "Yes?" and are waiting for the follow-up

function log(text, cls) {
  const p = document.createElement("p");
  p.textContent = text;
  if (cls) p.className = cls;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => /Samantha/i.test(v.name)) ||
    voices.find((v) => /Google US English/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices[0]
  );
}

function speak(text) {
  log(`JARVIS: ${text}`, "jarvis");
  speaking = true;
  if (recognition) {
    try { recognition.stop(); } catch (e) { /* already stopped */ }
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.05;
  const voice = pickVoice();
  if (voice) utter.voice = voice;

  utter.onend = utter.onerror = () => {
    speaking = false;
    if (listening) startRecognition();
  };
  speechSynthesis.speak(utter);
}

function normalize(text) {
  return text.toLowerCase().trim().replace(/[.?!]+$/, "").trim();
}

async function askClaude(question) {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    return data.answer || "I didn't get a clear answer back.";
  } catch (e) {
    return "I had trouble reaching my brain just now.";
  }
}

async function handleCommand(command) {
  if (!command) {
    awaitingCommand = true;
    speak("Yes?");
    return;
  }

  if (["quit", "exit", "stop", "goodbye"].includes(command)) {
    speak("Goodbye.");
    stopListening();
    return;
  }

  if (/\btime\b/.test(command)) {
    const now = new Date();
    speak(`It's ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
    return;
  }

  if (/\bdate\b/.test(command)) {
    const now = new Date();
    speak(`It's ${now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}.`);
    return;
  }

  const searchMatch = command.match(/^(?:search the web for|search for|google) (.+)/);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    speak(`Searching the web for ${query}.`);
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
    return;
  }

  // Nothing built-in matched - ask Claude
  setStatus("thinking...");
  const answer = await askClaude(command);
  speak(answer);
}

function startRecognition() {
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) {
    setStatus("Speech recognition isn't supported in this browser. Try Chrome, Edge, or Safari.");
    return;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = async (event) => {
    const heard = normalize(event.results[0][0].transcript);
    log(`Heard: ${heard}`, "you");

    if (awaitingCommand) {
      awaitingCommand = false;
      await handleCommand(heard);
      return;
    }

    if (heard.includes(WAKE_WORD)) {
      const command = heard.split(WAKE_WORD, 2)[1].trim();
      await handleCommand(command);
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      log("Microphone access was denied. Allow it in your browser's site settings and reload.", "sys");
      stopListening();
    }
    // "no-speech" and similar are normal and get retried by onend below
  };

  recognition.onend = () => {
    if (listening && !speaking) {
      // keep the mic open, waiting for the wake word again
      recognition.start();
    }
  };

  setStatus(awaitingCommand ? "listening for your command..." : 'listening for "Jarvis"...');
  recognition.start();
}

function stopListening() {
  listening = false;
  awaitingCommand = false;
  if (recognition) {
    try { recognition.stop(); } catch (e) { /* ignore */ }
  }
  micBtn.classList.remove("active");
  setStatus("Click the mic to start");
}

function startListening() {
  listening = true;
  micBtn.classList.add("active");
  log('Hello, I am JARVIS. Say my name whenever you need me.', "sys");
  speak("Hello, I am JARVIS. Say my name whenever you need me.");
}

micBtn.addEventListener("click", () => {
  if (listening) {
    stopListening();
  } else {
    startListening();
  }
});

// Some browsers load voices asynchronously - this warms the list up
// so pickVoice() has something to choose from on the first call.
speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
