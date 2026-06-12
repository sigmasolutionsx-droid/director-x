import fetch from 'node-fetch';

/**
 * Voice Synthesis Proxy
 * Handles: Fal Kokoro (free), ElevenLabs (w/ character presets), Neets
 * 
 * Request:  { provider, text, voiceId, apiKey, falApiKey?, character?, voiceSettings? }
 * Response: { audioUrl }
 */

// ── Director-X Character Voice Presets ───────────────────────────────
// Jerry's ElevenLabs config — tuned per character archetype
const CHARACTER_PRESETS = {
  adam: {
    voiceId: 'pNInz6obpgDQGcFmaJgB',   // Adam (ElevenLabs default)
    label: 'Adam — The Narrator',
    description: 'Smooth, sharp, educated villain. Cold authority.',
    settings: {
      stability: 0.15,          // 0-20% — very expressive
      similarity_boost: 0.65,   // 60-70% clarity
      style: 0.3,
      use_speaker_boost: true
    }
  },
  sam: {
    voiceId: 'yoZ06aMxZJJ28mfd3POQ',   // Sam (ElevenLabs)
    label: 'Sam — The Enforcer',
    description: 'Sinister, slight rasp. Dangerous undercurrent.',
    settings: {
      stability: 0.35,          // 30-40%
      similarity_boost: 0.50,   // 50% clarity
      style: 0.25,
      use_speaker_boost: true
    }
  },
  bill: {
    voiceId: 'pqHfZKP75CvOlQylNhV4',   // Bill (ElevenLabs)
    label: 'Bill — The Frontier Voice',
    description: 'Rougher, frontier-worn. Gravelly authenticity.',
    settings: {
      stability: 0.15,          // 10-20%
      similarity_boost: 0.45,   // 40-50% clarity
      style: 0.35,
      use_speaker_boost: true
    }
  }
};

// ── Theme-to-Voice Mapping ───────────────────────────────────────────
// Each show theme defaults to a specific narrator voice
const THEME_VOICE_MAP = {
  'hell-on-wheels':     'bill',    // Frontier-worn for railroad frontier
  'the-revenant':       'sam',     // Sinister rasp for frozen wilderness
  'texas-rising':       'bill',    // Rough frontier for Texas revolution
  'the-departed':       'adam',    // Sharp, educated for Boston noir
  'game-of-thrones':    'sam',     // Cold, dangerous for ice walls
  'black-sails':        'bill',    // Weathered for pirate seas
  'we-own-this-city':   'adam',    // Sharp authority for city streets
  'the-audacity':       'adam'     // Confident swagger for NFC West
};

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

  if (data.request_id) {
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

  return data.audio?.url || data.audio_url || data.output?.url;
}

async function synthesizeElevenLabs({ text, voiceId, apiKey, falApiKey, character, voiceSettings }) {
  // Resolve character preset
  let finalVoiceId = voiceId;
  let finalSettings = voiceSettings || {
    stability: 0.15,
    similarity_boost: 0.65,
    style: 0.3,
    use_speaker_boost: true
  };

  if (character && CHARACTER_PRESETS[character]) {
    const preset = CHARACTER_PRESETS[character];
    finalVoiceId = finalVoiceId || preset.voiceId;
    finalSettings = { ...preset.settings, ...voiceSettings };
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: finalSettings
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error: ${err}`);
  }

  const audioBuffer = await res.arrayBuffer();

  if (falApiKey) {
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
    const { provider, text, voiceId, apiKey, falApiKey, character, theme, voiceSettings } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing required field: text' });
    }

    // Auto-resolve character from theme if not specified
    let resolvedCharacter = character;
    if (!resolvedCharacter && theme && THEME_VOICE_MAP[theme]) {
      resolvedCharacter = THEME_VOICE_MAP[theme];
    }

    let audioUrl;

    switch (provider) {
      case 'fal-kokoro':
      case 'kokoro':
        audioUrl = await synthesizeKokoro({ text, voiceId, apiKey: apiKey || falApiKey });
        break;
      case 'elevenlabs':
        audioUrl = await synthesizeElevenLabs({
          text, voiceId, apiKey, falApiKey,
          character: resolvedCharacter,
          voiceSettings
        });
        break;
      case 'neets':
        audioUrl = await synthesizeNeets({ text, voiceId, apiKey });
        break;
      default:
        audioUrl = await synthesizeKokoro({ text, voiceId, apiKey: apiKey || falApiKey });
    }

    res.json({
      audioUrl,
      character: resolvedCharacter,
      characterInfo: resolvedCharacter ? CHARACTER_PRESETS[resolvedCharacter] : null
    });
  } catch (err) {
    console.error('Voice synthesis error:', err.message);
    res.status(502).json({ error: err.message });
  }
}

// Export for other modules
export { CHARACTER_PRESETS, THEME_VOICE_MAP };
