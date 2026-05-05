# Amazon Roaster

Paste an Amazon product URL, get a short roast (roast + verdict), and optionally generate audio with TTS.

## Setup

1. Install deps and start the app:

```bash
npm install
npm run dev
```

2. Configure Ollama + TTS:
   - You can set Ollama/TTS values in the in-app **API Settings** dialog (gear icon).
   - Alternatively, you can provide server-side defaults via environment variables (used when a setting isn’t provided in the dialog).

Then open `http://localhost:3000`.

## Roast configuration (in Settings)

Open **API Settings** (gear icon, top-right).

- **Roast mode**: `Standard`, `Harder`, `Re-roast`
- **Roast language**: `English`, `Hindi`, `Hinglish`
- **Roast Persona (LLM)**:
  - **Female persona name** (used when you select “Woman voice”)
  - **Male persona name** (used when you select “Man voice”)

Voice persona selection is on the main page under **Voice persona** (“Woman voice” / “Man voice”).

## TTS: ElevenLabs primary, Noiz fallback

In **API Settings**:

- **Primary TTS Provider (Optional)**: ElevenLabs
  - **API Key**
  - **Voice ID (Female)** / **Voice ID (Male)**
- **Fallback TTS Provider (Optional)**: Noiz
  - **API Key**
  - **Voice ID (Female)** / **Voice ID (Male)**
  - **Legacy Voice ID (Optional)**: used when gender-specific Noiz voice IDs are not set

Runtime behavior:
- If an ElevenLabs API key is provided, the app attempts ElevenLabs first.
- If ElevenLabs fails, it falls back to Noiz.

To disable external TTS calls entirely, set:
- `SKIP_TTS=true`

## Optional environment overrides (no UI)

These override TTS output configuration when set.

ElevenLabs:
- `ELEVENLABS_TTS_MODEL` (default: `eleven_turbo_v2_5`)

Noiz output:
- `NOIZ_TTS_OUTPUT_FORMAT` (default: `mp3`)
- `NOIZ_TTS_SPEED` (default: `1`)
- `NOIZ_TTS_QUALITY_PRESET` (default: `3`)

## Optional environment overrides (Ollama defaults)

- `OLLAMA_MODEL` (default: `gemma4:e2b`)
- `OLLAMA_BASE_URL` (default: `http://127.0.0.1:11434`)
