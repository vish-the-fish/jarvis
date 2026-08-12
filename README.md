# JARVIS (v0.2)

A voice assistant: wakes up when you say "Jarvis", handles a few built-in
commands, and asks Claude (an AI) for anything else.

## One-time setup (already done for you)

- Xcode Command Line Tools, Homebrew, `portaudio`, `flac` — system-level audio tools
- A Python virtual environment in `venv/` with:
  - `SpeechRecognition` + `PyAudio` — turns your voice into text
  - `anthropic` — talks to Claude for open-ended questions
  - `python-dotenv` — loads your API key from a `.env` file
- Speaking replies uses macOS's built-in `say` command (voice: Samantha)

## Enable the "ask Claude anything" feature (feature 3)

This step is on you, since it needs your own API key:

1. Go to **https://console.anthropic.com/settings/keys** and sign in / sign up
2. Create a new API key (starts with `sk-ant-...`)
3. In Terminal, run this (paste your real key in place of the placeholder —
   do this in your own terminal, not in a chat, since it's a secret):
   ```bash
   cd ~/jarvis
   echo "ANTHROPIC_API_KEY=sk-ant-your-real-key-here" > .env
   ```
   This creates a local `.env` file. It's already excluded from git via
   `.gitignore` so it won't accidentally get shared or committed.

Without this step, JARVIS still works for the built-in commands below — it'll
just say "I don't have a brain connected yet" for anything else.

Note: Claude API usage costs a small amount per request (fractions of a cent
for short voice exchanges on the Haiku model this uses). Check
console.anthropic.com for your usage/billing.

## Running it

```bash
cd ~/jarvis
source venv/bin/activate
python3 main.py
```

To stop: say "Jarvis, quit" (or "exit"/"stop"/"goodbye"), or press Ctrl+C.
To leave the virtual environment when done: `deactivate`

## How to talk to it

JARVIS stays silent until it hears its wake word, **"Jarvis"**, anywhere in
what you say. Then it looks at the rest of what you said:

- **"Jarvis, what time is it"** → tells you the time
- **"Jarvis, what's the date"** → tells you the date
- **"Jarvis, open Safari"** (or Chrome, Notes, Calculator, any installed app)
  → opens it
- **"Jarvis, search the web for best pizza in Chicago"** (or "google ...")
  → opens your browser with that search
- **"Jarvis, quit"** → says goodbye and exits
- **Anything else** → gets sent to Claude, and it speaks back the answer
  (e.g. "Jarvis, why is the sky blue")

You can also just say "Jarvis" by itself — it'll say "Yes?" and listen for
your next sentence as the command.

## Notes / things you can tweak

- `WAKE_WORD` and `VOICE` are set near the top of `main.py` — change `VOICE`
  to any name from `say -v '?'` in Terminal to hear other options. macOS also
  has higher-quality "Enhanced"/"Premium" voices you can download for free via
  System Settings → Accessibility → Spoken Content → System Voice → Manage Voices.
- The AI model used is `claude-haiku-4-5-20251001` — fast and cheap, good for
  quick voice replies. You can swap it for `claude-sonnet-5` in `main.py` if
  you want smarter (but slightly slower) answers.
- Speech-to-text needs internet (uses Google's free API). Text-to-speech works offline.
