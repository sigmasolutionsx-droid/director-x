import fetch from 'node-fetch';

/**
 * Voice Synthesis Proxy
 * Handles: Fal Kokoro, ElevenLabs, Neets
 * 
 * Request:  { provider, text, voiceId, apiKey, falApiKey? }
 * Response: { audioUrl }
 */

async function synthesizeKokoro({ text, voiceId, apiKey }) {
  const res = await fetch('https://queue.fal.run/fal-ai/kokoro/tts/v1', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      voice: voiceId || 'am_adam'
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || JSON.stringify(data));
  }

  // Kokoro returns audio in the queue response or needs polling
  if (data.request_id) {
    // Queue-based: poll for result
    const statusUrl = data.status_url || `https://queue.fal.run/fal-ai/kokoro/tts/v1/requests/${data.request_id}/status`;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${apiKey}` }
      });
      const statusData = await statusRes.json();

      if (statusData.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/fal-ai/kokoro/tts/v1/requests/${data.request_id}`,
          { headers: { 'Authorization': `Key ${apiKey}` } }
        );
        const resultData = await resultRes.json();
        return resultData.audio?.url || resultData.audio_url || resultData.output?.url;
      }
      if (statusData.status === 'FAILED') {
        throw new Error('Kokoro TTS generation failed');
      }
      attempts++;
    }
    throw new Error('Kokoro TTS polling timeout');
  }

  // Direct response
  return data.audio?.url || data.audio_url || data.output?.url;
}

async function synthesizeElevenLabs({ text, voiceId, apiKey, falApiKey }) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.15,
        similarity_boost: 0.65,
        style: 0.3,
        use_speaker_boost: true
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error: ${err}`);
  }

  // ElevenLabs returns raw audio bytes — we need to upload to a CDN
  // Use Fal's file upload if available, otherwise return as data URL
  const audioBuffer = await res.arrayBuffer();

  if (falApiKey) {
    // Upload to Fal CDN for a public URL
    try {
      const uploadRes = await fetch('https://fal.run/fal-ai/file-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falApiKey}`,
          'Content-Type': 'audio/mpeg'
        },
        body: Buffer.from(audioBuffer)
      });
      const uploadData = await uploadRes.json();
      if (uploadData.url) return uploadData.url;
    } catch (e) {
      console.warn('Fal CDN upload failed, falling back to base64:', e.message);
    }
  }

  // Fallback: base64 data URL (works for playback, not for video generation)
  const b64 = Buffer.from(audioBuffer).toString('base64');
  return `data:audio/mpeg;base64,${b64}`;
}

async function synthesizeNeets({ text, voiceId, apiKey }) {
  const res = await fetch('https://api.neets.ai/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId || 'us-male-1',
      params: {
        model: 'ar-diff-50k'
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Neets error: ${err}`);
  }

  const data = await res.json();
  return data.url || data.audio_url;
}

export async function handleVoiceSynthesize(req, res) {
  try {
    const { provider, text, voiceId, apiKey, falApiKey } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing required field: text' });
    }

    let audioUrl;

    switch (provider) {
      case 'fal-kokoro':
      case 'kokoro':
        audioUrl = await synthesizeKokoro({ text, voiceId, apiKey: apiKey || falApiKey });
        break;
      case 'elevenlabs':
        audioUrl = await synthesizeElevenLabs({ text, voiceId, apiKey, falApiKey });
        break;
      case 'neets':
        audioUrl = await synthesizeNeets({ text, voiceId, apiKey });
        break;
      default:
        // Default to Kokoro
        audioUrl = await synthesizeKokoro({ text, voiceId, apiKey: apiKey || falApiKey });
    }

    res.json({ audioUrl });
  } catch (err) {
    console.error('Voice synthesis error:', err.message);
    res.status(502).json({ error: err.message });
  }
}
