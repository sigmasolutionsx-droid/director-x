/**
 * assembly.js — Motion Assembly Engine
 * Takes scene images + voice audio and produces finished videos with cinematic motion.
 * Uses ffmpeg for Ken Burns zoom/pan effects, transitions, and final assembly.
 */

import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join, basename } from 'path';
import { writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);
const router = Router();

const OUTPUT_DIR = join(process.cwd(), 'output', 'assembled');

// Ensure output dir exists
mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

// ── Ken Burns Motion Presets ──────────────────────────────────
const MOTION_PRESETS = {
  'zoom-in-slow': {
    // Slow zoom from 100% to 120%, centered
    filter: (w, h, dur) =>
      `zoompan=z='min(zoom+0.0015,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * 30}:s=${w}x${h}:fps=30`,
    description: 'Slow dramatic zoom in',
  },
  'zoom-out-slow': {
    filter: (w, h, dur) =>
      `zoompan=z='if(eq(on,1),1.2,max(zoom-0.0015,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * 30}:s=${w}x${h}:fps=30`,
    description: 'Slow reveal zoom out',
  },
  'pan-left': {
    filter: (w, h, dur) =>
      `zoompan=z=1.15:x='iw*0.15*(1-on/${dur * 30})':y='ih/2-(ih/zoom/2)':d=${dur * 30}:s=${w}x${h}:fps=30`,
    description: 'Slow pan from right to left',
  },
  'pan-right': {
    filter: (w, h, dur) =>
      `zoompan=z=1.15:x='iw*0.15*on/${dur * 30}':y='ih/2-(ih/zoom/2)':d=${dur * 30}:s=${w}x${h}:fps=30`,
    description: 'Slow pan from left to right',
  },
  'zoom-in-top': {
    filter: (w, h, dur) =>
      `zoompan=z='min(zoom+0.002,1.25)':x='iw/2-(iw/zoom/2)':y='ih*0.1':d=${dur * 30}:s=${w}x${h}:fps=30`,
    description: 'Zoom into upper portion — good for skies/landscapes',
  },
  'zoom-in-bottom': {
    filter: (w, h, dur) =>
      `zoompan=z='min(zoom+0.002,1.25)':x='iw/2-(iw/zoom/2)':y='ih*0.4':d=${dur * 30}:s=${w}x${h}:fps=30`,
    description: 'Zoom into lower portion — good for ground/characters',
  },
  'drift-diagonal': {
    filter: (w, h, dur) =>
      `zoompan=z=1.15:x='iw*0.1*on/${dur * 30}':y='ih*0.1*on/${dur * 30}':d=${dur * 30}:s=${w}x${h}:fps=30`,
    description: 'Slow diagonal drift — contemplative mood',
  },
  'hold-still': {
    filter: (w, h, dur) =>
      `zoompan=z=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * 30}:s=${w}x${h}:fps=30`,
    description: 'No motion — for dialogue/text scenes',
  },
};

// ── Scene-to-motion mapping based on content ──────────────────
function selectMotion(sceneText, sceneIndex, totalScenes) {
  const text = (sceneText || '').toLowerCase();

  // Opening scenes get zoom-out reveals
  if (sceneIndex === 0) return 'zoom-out-slow';

  // Closing scenes get slow zoom-in
  if (sceneIndex === totalScenes - 1) return 'zoom-in-slow';

  // Content-based selection
  if (text.match(/walk|ride|travel|journey|approach|march/)) return 'pan-right';
  if (text.match(/retreat|leave|flee|escape|depart/)) return 'pan-left';
  if (text.match(/sky|horizon|vista|landscape|mountain|above/)) return 'zoom-in-top';
  if (text.match(/ground|earth|fallen|blood|floor|beneath/)) return 'zoom-in-bottom';
  if (text.match(/speak|said|whisper|voice|word|silence/)) return 'hold-still';
  if (text.match(/vast|empire|kingdom|city|world|domain/)) return 'zoom-out-slow';
  if (text.match(/face|eyes|stare|gaze|close|detail/)) return 'zoom-in-slow';

  // Alternate for variety
  const presets = ['zoom-in-slow', 'pan-right', 'zoom-out-slow', 'pan-left', 'drift-diagonal'];
  return presets[sceneIndex % presets.length];
}

// ── Platform output specs ─────────────────────────────────────
const PLATFORM_SPECS = {
  youtube:  { width: 1920, height: 1080, aspect: '16:9', fps: 30 },
  tiktok:   { width: 1080, height: 1920, aspect: '9:16', fps: 30 },
  instagram:{ width: 1080, height: 1350, aspect: '4:5',  fps: 30 },
  facebook: { width: 1080, height: 1080, aspect: '1:1',  fps: 30 },
};

// ── Apply Ken Burns to a single image ─────────────────────────
async function applyMotion(imagePath, outputPath, motionPreset, duration, width, height) {
  const preset = MOTION_PRESETS[motionPreset] || MOTION_PRESETS['zoom-in-slow'];
  const filter = preset.filter(width, height, duration);

  // Scale input image to be larger than output for zoom room
  const scaleW = Math.round(width * 1.5);
  const scaleH = Math.round(height * 1.5);

  const cmd = [
    'ffmpeg -y',
    `-loop 1 -i "${imagePath}"`,
    `-vf "scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${scaleW}:${scaleH},${filter}"`,
    `-t ${duration}`,
    `-c:v libx264 -pix_fmt yuv420p -preset fast -crf 18`,
    `"${outputPath}"`,
  ].join(' ');

  await execAsync(cmd, { timeout: 120000 });
  return outputPath;
}

// ── Add crossfade transitions between clips ───────────────────
async function concatWithTransitions(clipPaths, outputPath, transitionDuration = 0.5) {
  if (clipPaths.length === 0) throw new Error('No clips to concatenate');
  if (clipPaths.length === 1) {
    await execAsync(`cp "${clipPaths[0]}" "${outputPath}"`);
    return outputPath;
  }

  // Build ffmpeg concat with xfade transitions
  let inputs = clipPaths.map((p, i) => `-i "${p}"`).join(' ');
  let filterParts = [];
  let lastLabel = '[0:v]';

  for (let i = 1; i < clipPaths.length; i++) {
    const outLabel = i === clipPaths.length - 1 ? '[outv]' : `[v${i}]`;
    // Offset = cumulative duration minus overlap
    // We'll set each clip's presentation time via offsets
    filterParts.push(
      `${lastLabel}[${i}:v]xfade=transition=fade:duration=${transitionDuration}:offset=OFFSET_${i}${outLabel}`
    );
    lastLabel = outLabel;
  }

  // Get durations of each clip
  const durations = [];
  for (const clip of clipPaths) {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${clip}"`
    );
    durations.push(parseFloat(stdout.trim()));
  }

  // Calculate offsets
  let cumDuration = durations[0];
  let filterStr = filterParts.join(';');
  for (let i = 1; i < clipPaths.length; i++) {
    const offset = Math.max(0, cumDuration - transitionDuration);
    filterStr = filterStr.replace(`OFFSET_${i}`, offset.toFixed(2));
    cumDuration = offset + durations[i];
  }

  const cmd = `ffmpeg -y ${inputs} -filter_complex "${filterStr}" -map "[outv]" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 18 "${outputPath}"`;
  await execAsync(cmd, { timeout: 300000 });
  return outputPath;
}

// ── Mix video + audio narration ───────────────────────────────
async function mixAudio(videoPath, audioPath, outputPath) {
  // Get video and audio durations
  const { stdout: vDur } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`
  );
  const { stdout: aDur } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`
  );

  const videoDuration = parseFloat(vDur.trim());
  const audioDuration = parseFloat(aDur.trim());

  // Use the longer of the two as final duration
  const finalDuration = Math.max(videoDuration, audioDuration);

  let cmd;
  if (audioDuration > videoDuration) {
    // Loop/extend last frame of video to match audio
    cmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=${(audioDuration - videoDuration).toFixed(2)}[v]" -map "[v]" -map "1:a" -c:v libx264 -c:a aac -b:a 192k -shortest -pix_fmt yuv420p "${outputPath}"`;
  } else {
    // Audio fits within video — just mix
    cmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${outputPath}"`;
  }

  await execAsync(cmd, { timeout: 300000 });
  return outputPath;
}

// ── Assembly jobs tracking ────────────────────────────────────
const assemblyJobs = {};

// ── POST /api/assembly/create ─────────────────────────────────
// Accepts scene images (as URLs or base64) + optional audio,
// assembles into finished video with Ken Burns motion.
router.post('/create', async (req, res) => {
  try {
    const {
      scenes = [],           // [{ imageUrl, text, duration, motion }]
      audioUrl,              // Optional narration audio URL
      platform = 'youtube',  // youtube | tiktok | instagram | facebook
      transitionDuration = 0.5,
      title = 'untitled',
    } = req.body;

    if (!scenes.length) {
      return res.status(400).json({ error: 'scenes array is required' });
    }

    const jobId = randomUUID();
    const jobDir = join(OUTPUT_DIR, jobId);
    await mkdir(jobDir, { recursive: true });

    const spec = PLATFORM_SPECS[platform] || PLATFORM_SPECS.youtube;

    assemblyJobs[jobId] = {
      status: 'processing',
      progress: 0,
      totalSteps: scenes.length + 2, // scenes + concat + audio
      platform,
      title,
      createdAt: Date.now(),
      outputPath: null,
      error: null,
    };

    res.json({
      jobId,
      statusUrl: `/api/assembly/status/${jobId}`,
      message: `Assembling ${scenes.length} scenes for ${platform}`,
    });

    // ── Process in background ──
    (async () => {
      try {
        const clipPaths = [];

        // Step 1: Apply Ken Burns to each scene image
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          const duration = scene.duration || 5;
          const motion = scene.motion || selectMotion(scene.text, i, scenes.length);
          const imagePath = join(jobDir, `scene_${i}.png`);
          const clipPath = join(jobDir, `clip_${i}.mp4`);

          // Download or decode image
          if (scene.imageUrl) {
            if (scene.imageUrl.startsWith('data:')) {
              // Base64 image
              const base64Data = scene.imageUrl.split(',')[1];
              await writeFile(imagePath, Buffer.from(base64Data, 'base64'));
            } else {
              // URL — download
              const response = await fetch(scene.imageUrl);
              const buffer = await response.arrayBuffer();
              await writeFile(imagePath, Buffer.from(buffer));
            }
          } else if (scene.imageBase64) {
            await writeFile(imagePath, Buffer.from(scene.imageBase64, 'base64'));
          } else {
            throw new Error(`Scene ${i} has no image`);
          }

          await applyMotion(imagePath, clipPath, motion, duration, spec.width, spec.height);
          clipPaths.push(clipPath);

          assemblyJobs[jobId].progress = i + 1;
          console.log(`  Scene ${i + 1}/${scenes.length}: ${motion} (${duration}s)`);
        }

        // Step 2: Concatenate with transitions
        const concatPath = join(jobDir, 'concat.mp4');
        await concatWithTransitions(clipPaths, concatPath, transitionDuration);
        assemblyJobs[jobId].progress = scenes.length + 1;

        // Step 3: Mix audio if provided
        let finalPath = concatPath;
        if (audioUrl) {
          const audioPath = join(jobDir, 'narration.wav');
          if (audioUrl.startsWith('data:')) {
            const base64Audio = audioUrl.split(',')[1];
            await writeFile(audioPath, Buffer.from(base64Audio, 'base64'));
          } else {
            const response = await fetch(audioUrl);
            const buffer = await response.arrayBuffer();
            await writeFile(audioPath, Buffer.from(buffer));
          }
          finalPath = join(jobDir, `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${platform}.mp4`);
          await mixAudio(concatPath, audioPath, finalPath);
        }

        assemblyJobs[jobId].status = 'completed';
        assemblyJobs[jobId].progress = assemblyJobs[jobId].totalSteps;
        assemblyJobs[jobId].outputPath = finalPath;
        console.log(`✅ Assembly ${jobId.slice(0, 8)} complete: ${scenes.length} scenes → ${platform}`);

      } catch (err) {
        assemblyJobs[jobId].status = 'failed';
        assemblyJobs[jobId].error = err.message;
        console.error(`❌ Assembly ${jobId.slice(0, 8)} failed:`, err.message);
      }
    })();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/assembly/status/:jobId ───────────────────────────
router.get('/status/:jobId', (req, res) => {
  const job = assemblyJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const result = {
    status: job.status.toUpperCase(),
    progress: job.progress,
    totalSteps: job.totalSteps,
    platform: job.platform,
  };

  if (job.status === 'completed') {
    result.downloadUrl = `/api/assembly/download/${req.params.jobId}`;
  } else if (job.status === 'failed') {
    result.error = job.error;
  }

  res.json(result);
});

// ── GET /api/assembly/download/:jobId ─────────────────────────
router.get('/download/:jobId', async (req, res) => {
  const job = assemblyJobs[req.params.jobId];
  if (!job || !job.outputPath) {
    return res.status(404).json({ error: 'Video not found' });
  }

  try {
    await stat(job.outputPath);
    res.download(job.outputPath);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

// ── GET /api/assembly/presets ─────────────────────────────────
router.get('/presets', (req, res) => {
  res.json({
    motionPresets: Object.entries(MOTION_PRESETS).map(([key, val]) => ({
      id: key,
      description: val.description,
    })),
    platforms: Object.entries(PLATFORM_SPECS).map(([key, val]) => ({
      id: key,
      ...val,
    })),
  });
});

export default router;
