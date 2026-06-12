import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

import { handleLLMCompletion } from './routes/llm.js';
import { handleVideoSubmit, handleVideoStatus } from './routes/video.js';
import { handleVoiceSynthesize } from './routes/voice.js';
import { handleSubstackParse } from './routes/substack.js';
import { handleSEOGenerate } from './routes/seo.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve DirectorX.html from parent directory
app.use(express.static(join(__dirname, '../..')));

// ── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'director-x-backend',
    version: '1.2.0',
    endpoints: [
      'GET  /api/health',
      'POST /api/llm/completion',
      'POST /api/video/submit',
      'POST /api/video/status',
      'POST /api/voice/synthesize',
      'POST /api/substack/parse',
      'POST /api/seo/generate'
    ]
  });
});

// ── Core Director-X Proxy Endpoints ──────────────────────────────────
app.post('/api/llm/completion', handleLLMCompletion);
app.post('/api/video/submit', handleVideoSubmit);
app.post('/api/video/status', handleVideoStatus);
app.post('/api/voice/synthesize', handleVoiceSynthesize);

// ── Substack Article Parser (custom addition) ────────────────────────
app.post('/api/substack/parse', handleSubstackParse);

// ── SEO Metadata Engine ──────────────────────────────────────────────
app.post('/api/seo/generate', handleSEOGenerate);

// ── Error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🎬 Director-X Backend v1.2.0 running on http://localhost:${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  console.log(`🎥 Place DirectorX.html in the project root to serve it\n`);
});
