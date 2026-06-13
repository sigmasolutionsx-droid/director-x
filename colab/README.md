# 🎬 Director-X Free GPU Servers

Run AI generation on free cloud GPUs — no local hardware needed.

## Two Modes

### 🎨 Image Pipeline (Recommended)
Generates stunning SDXL images → applies cinematic Ken Burns motion (zoom, pan, parallax) → finished video.

**Why this is better on free GPUs:**
- SDXL runs flawlessly on free T4 — no crashes, no OOM
- ~5-10 seconds per image (vs 3-5 minutes for video)
- Image quality is stunning — 1024×576 cinematic shots
- Ken Burns motion makes it look like a premium documentary
- Unlimited generation on Kaggle (30 hrs/week)

| Notebook | Platform |
|---|---|
| `DirectorX_Image_Server_Colab.ipynb` | Google Colab |
| `DirectorX_Image_Server_Kaggle.ipynb` | Kaggle |

### 🎬 Video Generation (Experimental)
Direct AI video generation — higher motion quality but needs more GPU power.

Auto-selects the best model: CogVideoX-2B → Wan2.1-1.3B → ModelScope-1.7B

| Notebook | Platform |
|---|---|
| `DirectorX_Free_Video_Server.ipynb` | Google Colab |
| `DirectorX_Kaggle_Video_Server.ipynb` | Kaggle |

## Quick Start

### 1. Get ngrok token (free, one-time)
→ [ngrok.com](https://ngrok.com) → Sign up → Dashboard → Your Authtoken

### 2. Open notebook

**Colab:** Upload `.ipynb` → Runtime → Change runtime type → **T4 GPU**

**Kaggle:** kaggle.com → New Notebook → Import → Upload `.ipynb` → Sidebar: **GPU T4 x2** + **Internet ON**

### 3. Run All
- Paste ngrok token in Step 2
- Wait for model to load
- Copy the ngrok URL

### 4. Connect to Director-X

**For Image Pipeline:**
- Select **🎨 Image Pipeline** as Video Provider
- Paste the ngrok URL into the Image Server field

**For Video Generation:**
- Select **🆓 Colab Free** as Video Provider
- Paste the ngrok URL

## Image Server API

```
POST /api/image/generate   { "prompt": "...", "aspect_ratio": "16:9", "style": "western" }
POST /api/image/batch      { "scenes": [{ "prompt": "...", "style": "..." }, ...] }
GET  /api/image/status/{id} → { status, imageUrl, thumbnail }
GET  /api/image/download/{id} → PNG
GET  /api/health | /api/queue
```

### Styles
| Style | Shows |
|-------|-------|
| `cinematic` | Default — dramatic lighting, film grain |
| `western` | Hell on Wheels / The Kansas City Line |
| `frozen` | The Frozen Front / Game of Thrones |
| `pirate` | No Quarter / Black Sails |
| `noir` | The Departed / Atlantic Command |
| `warfare` | Texas Rising / The Wall |
| `urban` | We Own This City / Eastern Front |
| `fantasy` | The Audacity / The Pacific Coast |

## Video Server API

```
POST /api/video/submit  { "prompt": "...", "aspect_ratio": "16:9", "duration": 3 }
GET  /api/video/status/{id} → { status, videoUrl }
GET  /api/video/download/{id} → mp4
GET  /api/health | /api/queue
```

## Troubleshooting

| Issue | Fix |
|---|---|
| No GPU | Change runtime to T4 GPU |
| Model fails to load | Restart runtime, re-run all cells |
| ngrok URL dies | Re-run the last cell |
| OOM (video only) | Switch to Image Pipeline instead |
| Kaggle won't import | Re-download the `.ipynb` from GitHub |
