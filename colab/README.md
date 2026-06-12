# 🎬 Director-X Free Video Server (Google Colab)

Generate unlimited AI videos for **$0** using Google Colab's free T4 GPU.

## Quick Start

1. **Open the notebook:** [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/sigmasolutionsx-droid/director-x/blob/main/colab/DirectorX_Free_Video_Server.ipynb)

2. **Get a free ngrok token:** Sign up at [ngrok.com](https://ngrok.com) and copy your auth token

3. **Run all cells** — the last cell starts the server and prints your public URL

4. **Paste the URL into Director-X** — Settings → Colab Server URL

5. **Generate videos!** 🚀

## What's Included

- **LTX-Video** model optimized for T4 GPU (free tier)
- Text-to-video generation
- Multiple aspect ratios: 16:9 (YouTube), 9:16 (TikTok/Reels), 1:1 (Instagram), 4:3
- Job queue system — submit multiple scenes, they process in order
- REST API that Director-X connects to directly

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status, GPU info, queue length |
| `/api/video/submit` | POST | Submit a video generation job |
| `/api/video/status/{id}` | GET | Check job status |
| `/api/video/download/{id}` | GET | Download completed video |
| `/api/queue` | GET | View generation queue |

## Limits

- Free Colab: ~4 hours GPU time per session
- Resolution: 512x320 (standard) — good for drafts and social media
- Duration: 1-7 seconds per clip
- One video generates at a time (queued)

## Want Higher Quality?

- **Colab Pro ($10/mo):** A100 GPU → 1080p output, faster generation
- **Fal.ai ($10 free credits):** Higher quality models (Kling, Veo 3)
- **Replicate ($5 free credits):** Wan 2.1 720p

The Director-X backend supports all providers simultaneously — use Colab for drafts, paid providers for final renders.
