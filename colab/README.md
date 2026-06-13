# 🎬 Director-X Free Video Servers (V2)

Run AI video generation on free cloud GPUs. Both notebooks auto-select the best model for your hardware.

## Model Auto-Selection

The notebooks try models in order and use the best one that fits:

| Priority | Model | Params | VRAM | Resolution | Quality |
|----------|-------|--------|------|------------|---------|
| 1st | CogVideoX-2B | 2B | ~12GB | 720×480 | ⭐⭐⭐⭐ |
| 2nd | Wan2.1-T2V-1.3B | 1.3B | ~5GB | 640×360 | ⭐⭐⭐ |
| 3rd | ModelScope-1.7B | 1.7B | ~4GB | 512×320 | ⭐⭐ |

## Two Platforms

| | Google Colab | Kaggle |
|---|---|---|
| **Notebook** | `DirectorX_Free_Video_Server.ipynb` | `DirectorX_Kaggle_Video_Server.ipynb` |
| **Free GPU** | T4 (16GB) | T4 x2 (16GB) |
| **Weekly limit** | ~4-12 hrs | **30 hours/week** |
| **Best for** | Quick tests | Full production batches |

## Quick Start

### 1. Get ngrok token (free, one-time)
→ [ngrok.com](https://ngrok.com) → Sign up → Dashboard → Your Authtoken

### 2. Open notebook

**Colab:** Open `.ipynb` → Runtime → Change runtime type → **T4 GPU**

**Kaggle:** kaggle.com → New Notebook → Import → Upload `.ipynb` → Sidebar: **GPU T4 x2** + **Internet ON**

### 3. Run All
- Paste ngrok token in Step 2
- Wait for model to load (3-5 min first time, ~2 min after)
- Copy the ngrok URL

### 4. Connect to Director-X
- Select **Colab (Local)** as video provider
- Paste the ngrok URL
- Generate!

## API

```
POST /api/video/submit  { "prompt": "...", "aspect_ratio": "16:9", "duration": 3 }
GET  /api/video/status/{id}  → { status, videoUrl }
GET  /api/video/download/{id} → mp4
GET  /api/health → { model, gpu, vram, resolution }
GET  /api/queue → { queue_length, recent_jobs }
```

## Troubleshooting

| Issue | Fix |
|---|---|
| No GPU | Change runtime to T4 GPU |
| All models fail | Restart runtime, re-run all cells |
| ngrok dies | Re-run last cell for new URL |
| OOM during generation | Reduce duration to 2-3 seconds |
| Kaggle won't import | Make sure you're uploading the `.ipynb` file directly |
