"""
JARVIS v0.2

New in this version:
- Wake word: JARVIS stays quiet until it hears "jarvis" in what you say
- Real commands: time, date, opening apps, web search
- A nicer built-in voice
- Anything it doesn't recognize gets sent to Claude (an AI) for a real answer,
  if you've set up an API key (see README.md) - otherwise it just says so.

How the loop works:
1. Keep listening in short bursts, ignoring anything that doesn't contain "jarvis"
2. Once it hears "jarvis", pull out whatever came after it as the command
   (if nothing came after, it asks "Yes?" and listens once more for the command)
3. Look at the command: is it one we specifically handle (time, date, open app,
   web search, quit)? If yes, do that. If not, ask Claude and speak its answer.
"""

import re
import subprocess
import webbrowser
from datetime import datetime

import speech_recognition as sr

try:
    from dotenv import load_dotenv
    load_dotenv()  # reads ANTHROPIC_API_KEY from a .env file in this folder, if present
except ImportError:
    pass  # dotenv is optional - you can also just set the env var yourself

try:
    import anthropic
    _client = anthropic.Anthropic()  # picks up ANTHROPIC_API_KEY from the environment
except Exception:
    _client = None  # no key configured yet - LLM fallback will explain this when used

WAKE_WORD = "jarvis"
VOICE = "Samantha"      # run `say -v '?'` to see all voices installed on your Mac
RATE = 185               # words per minute


def speak(text):
    """Say something out loud and print it, so you can see what JARVIS said."""
    print(f"JARVIS: {text}")
    subprocess.run(["say", "-v", VOICE, "-r", str(RATE), text])


def listen_once(prompt_label="listening"):
    """Record one phrase from the mic and return it as lowercase text, or None."""
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print(f"\n({prompt_label}...)")
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        audio = recognizer.listen(source)

    try:
        text = recognizer.recognize_google(audio)
        # Google's speech-to-text often tacks on trailing punctuation (e.g. a
        # period at the end of a sentence) which breaks exact-word matching
        # and app names below, so strip it off here, once, for everything downstream.
        text = re.sub(r"[.?!]+$", "", text.lower()).strip()
        print(f"Heard: {text}")
        return text
    except sr.UnknownValueError:
        return None
    except sr.RequestError as e:
        print(f"(speech service error: {e})")
        return None


def wait_for_wake_word():
    """Block until we hear the wake word. Returns whatever came after it (may be empty)."""
    while True:
        heard = listen_once("waiting for wake word")
        if heard is None:
            continue
        if WAKE_WORD in heard:
            # grab whatever the person said *after* the wake word, in the same breath
            after = heard.split(WAKE_WORD, 1)[1].strip()
            return after


def ask_llm(question):
    """Send anything JARVIS doesn't have a built-in command for to Claude."""
    if _client is None:
        return (
            "I don't have a brain connected yet. "
            "Add an Anthropic API key to the .env file to enable that - check the README."
        )
    try:
        response = _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=(
                "You are JARVIS, a helpful voice assistant. Keep answers short and "
                "conversational (1-3 sentences) since they'll be read aloud."
            ),
            messages=[{"role": "user", "content": question}],
        )
        return response.content[0].text
    except Exception as e:
        return f"I had trouble reaching my brain: {e}"


def open_app(command):
    """Handle things like 'open safari' or 'open chrome'."""
    match = re.search(r"open (.+)", command)
    if not match:
        return False
    app_name = match.group(1).strip()
    result = subprocess.run(["open", "-a", app_name], capture_output=True, text=True)
    if result.returncode == 0:
        speak(f"Opening {app_name}.")
    else:
        speak(f"I couldn't find an app called {app_name}.")
    return True


def web_search(command):
    """Handle things like 'search the web for pizza recipes' or 'google pizza recipes'."""
    match = re.search(r"(?:search the web for|search for|google) (.+)", command)
    if not match:
        return False
    query = match.group(1).strip()
    speak(f"Searching the web for {query}.")
    webbrowser.open(f"https://www.google.com/search?q={query.replace(' ', '+')}")
    return True


def handle_command(command):
    """The command router: figure out what was asked and do it. Returns False to quit."""
    if not command:
        speak("Yes?")
        command = listen_once("listening for command")
        if not command:
            speak("Sorry, I didn't catch that.")
            return True

    if command in ("quit", "exit", "stop", "goodbye"):
        speak("Goodbye.")
        return False

    # Check specific intents (open app / web search) before the looser
    # keyword checks below, so e.g. "open time machine" opens the app
    # instead of being mistaken for a time question.
    if command.startswith("open "):
        if open_app(command):
            return True

    if command.startswith(("search the web for", "search for", "google ")):
        if web_search(command):
            return True

    # Loose keyword match (word-boundary, not exact phrase) so variations
    # like "what's the time", "tell me the time", "time please" all work -
    # not just the one exact phrasing.
    if re.search(r"\btime\b", command):
        speak(datetime.now().strftime("It's %I:%M %p."))
        return True

    if re.search(r"\bdate\b", command):
        speak(datetime.now().strftime("It's %A, %B %d."))
        return True

    # Nothing built-in matched - ask the AI
    speak(ask_llm(command))
    return True


def main():
    speak("Hello, I am JARVIS. Say my name whenever you need me.")
    while True:
        after_wake_word = wait_for_wake_word()
        if not handle_command(after_wake_word):
            break


if __name__ == "__main__":
    main()
