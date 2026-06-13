# 🎬 Director-X Free Video Servers

Run **LTX-Video** on a free cloud GPU and connect it to Director-X. No local GPU required.

## Two Options

| | Google Colab | Kaggle |
|---|---|---|
| **Notebook** | `DirectorX_Free_Video_Server.ipynb` | `DirectorX_Kaggle_Video_Server.ipynb` |
| **Free GPU** | T4 (16GB VRAM) | T4 x2 (16GB VRAM) |
| **Weekly limit** | Variable (~4-12 hrs) | **30 hours/week** |
| **Availability** | Can run out during peak hours | Almost always available |
| **Session length** | ~90 min idle / ~12 hrs active | ~12 hrs active |
| **Best for** | Quick tests | Full episode batches |

## Quick Start (Both Platforms)

### 1. Get an ngrok token (free, one-time)
- Go to [ngrok.com](https://ngrok.com) → Sign up → Dashboard → Your Authtoken
- Copy the token — you'll paste it into the notebook

### 2. Open the notebook

**Colab:**
1. Open `DirectorX_Free_Video_Server.ipynb` in GitHub
2. Click "Open in Colab"
3. Runtime → Change runtime type → **T4 GPU**

**Kaggle:**
1. Go to [kaggle.com/code](https://www.kaggle.com/code) → New Notebook → Import
2. Upload `DirectorX_Kaggle_Video_Server.ipynb`
3. Sidebar → Settings → Accelerator → **GPU T4 x2**
4. Turn on **Internet** (required for ngrok)

### 3. Run all cells
- Paste your ngrok token in Step 2
- Run All → wait for model download (~5 min first time)
- Copy the ngrok URL printed at the end

### 4. Connect to Director-X
- In Director-X, select **Colab (Local)** as your video provider
- Paste the ngrok URL as the server address
- Hit Full Pipeline — videos render on the cloud GPU for free!

## Specs

- **Model:** LTX-Video (Lightricks)
- **Resolution:** 512×320 (standard) or 1024×640 (high)
- **FPS:** 12
- **Duration:** 1-7 seconds per clip
- **Aspect ratios:** 16:9, 9:16, 1:1, 4:3
- **Queue:** Automatic job queue for batch processing

## API Reference

```
POST /api/video/submit
{
  "prompt": "A dusty frontier town at sunset, cinematic",
  "aspect_ratio": "16:9",
  "duration": 3,
  "quality": "standard",
  "seed": 42
}

GET /api/video/status/{requestId}  → { status, videoUrl, error }
GET /api/video/download/{requestId} → video/mp4
GET /api/health → { provider, model, gpu, vram, queue_length }
GET /api/queue → { queue_length, is_generating, recent_jobs }
```

## Troubleshooting

| Issue | Fix |
|---|---|
| "No GPU detected" | Change runtime to T4 GPU (Colab: Runtime menu; Kaggle: sidebar Settings) |
| "Internet disabled" (Kaggle) | Sidebar → Settings → Turn on Internet. May require phone verification |
| ngrok tunnel dies | Re-run the last cell to get a new URL |
| Session disconnected | Re-run all cells. Model loads from cache (~2 min) |
| Out of GPU quota (Colab) | Switch to Kaggle — 30 hrs/week almost never runs out |
