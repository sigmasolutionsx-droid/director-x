# Director-X

AI-powered cinematic video production pipeline. Turns Substack articles into multi-platform video content across 8 cinematic universes.

## Structure

```
├── DirectorX.html          # Frontend — TWAIN Batch Video Router (open in browser)
└── backend/                # Backend proxy server
    ├── package.json
    ├── .env.example
    └── src/
        ├── server.js       # Express server (port 3000)
        └── routes/
            ├── llm.js      # Multi-provider LLM proxy
            ├── video.js    # Video generation (Fal.ai, Replicate, Kling)
            ├── voice.js    # Voice synthesis (Kokoro, ElevenLabs, Neets)
            └── substack.js # Article parser + 8-theme engine
```

## Quick Start

```bash
# 1. Start the backend
cd backend
npm install
npm start

# 2. Open DirectorX.html in your browser
# It auto-connects to localhost:3000
```

See [backend/README.md](backend/README.md) for full API docs.
