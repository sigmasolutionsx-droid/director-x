# Director-X Backend

Backend proxy server for the Director-X TWAIN Batch Video Router. Enables multi-provider video generation, LLM completion, voice synthesis, and Substack article parsing.

## Quick Start

```bash
cd backend
npm install
cp .env.example .env    # optional: add default API keys
npm start               # starts on http://localhost:3000
```

Then open `DirectorX.html` in your browser — it auto-connects to `localhost:3000`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check — returns `{ status: 'ok' }` |
| `POST` | `/api/llm/completion` | LLM proxy (OpenRouter, Groq, OpenAI, Anthropic, Gemini, DeepSeek, xAI, Mistral) |
| `POST` | `/api/video/submit` | Submit video generation job (Fal.ai, Replicate, Kling Direct) |
| `POST` | `/api/video/status` | Poll video generation status |
| `POST` | `/api/voice/synthesize` | Voice synthesis (Fal Kokoro, ElevenLabs, Neets) |
| `POST` | `/api/substack/parse` | Parse Substack articles into scenes with theme detection |

## Architecture

```
DirectorX.html (browser)
    │
    ├── /api/health ──────────── Connection check
    ├── /api/llm/completion ──── Scene prompt generation
    ├── /api/video/submit ────── Queue video generation
    ├── /api/video/status ────── Poll for completed videos
    ├── /api/voice/synthesize ── Generate voiceover audio
    └── /api/substack/parse ──── Article → Scenes pipeline
```

## Substack Parser

The `/api/substack/parse` endpoint accepts either a Substack URL or raw article text and returns structured scenes ready for video generation.

```bash
# Parse from raw text
curl -X POST http://localhost:3000/api/substack/parse \
  -H "Content-Type: application/json" \
  -d '{"text": "your article text here"}'

# Parse from URL
curl -X POST http://localhost:3000/api/substack/parse \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yoursite.substack.com/p/article-slug"}'
```

### Format Detection
- **Screenplay format**: Articles with `[EXT.]`/`[INT.]` scene markers, voiceover notation, character dialogue
- **Prose format**: Dramatic narrative with section headers, team spotlights, verdict blocks

### Theme Engine (8 Cinematic Universes)
| Theme Key | Show | Division | Name |
|-----------|------|----------|------|
| `hell-on-wheels` | Hell on Wheels | AFC West | The Kansas City Line |
| `the-revenant` | The Revenant | AFC North | Blood & Ice |
| `texas-rising` | Texas Rising | AFC South | The Wall |
| `the-departed` | The Departed | AFC East | Atlantic Command |
| `game-of-thrones` | Game of Thrones | NFC North | The Frozen Front |
| `black-sails` | Black Sails | NFC South | No Quarter |
| `we-own-this-city` | We Own This City | NFC East | Eastern Front |
| `the-audacity` | The Audacity | NFC West | The Pacific Coast |

Each theme includes: visual style prompts, color palette, narrator voice profile, scene transition descriptors, and keyword detection.

## Video Providers

### Fal.ai (Recommended — queue-based)
- Kling 1.6 Standard/Pro
- Hunyuan Video / Avatar
- Luma Dream Machine
- LTX Video
- MiniMax Video-01
- Google Veo 3
- Wan 2.1 14B

### Replicate
- Kling 1.5 Standard
- Hunyuan Video
- Wan 2.1
- Luma Dream Machine

### Kling Direct API
- Direct access with access_key + secret_key

## Multi-Platform Output (Coming Soon)
- YouTube: 16:9 full episodes
- TikTok/Reels/Shorts: 9:16 single-scene cuts
- Instagram: 1:1 or 9:16
- Facebook: 16:9 highlight reels
- SEO metadata with Substack backlinks per platform
