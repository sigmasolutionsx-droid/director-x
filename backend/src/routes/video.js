import fetch from 'node-fetch';

/**
 * Video Generation Proxy
 * Handles: Fal.ai (queue-based) and Replicate (prediction-based)
 * 
 * Submit Request:  { provider, model, apiKey, secretKey?, prompt, duration, input? }
 * Submit Response: { requestId, statusUrl, responseUrl, provider, model }
 * 
 * Status Request:  { provider, requestId, model, apiKey, secretKey?, statusUrl }
 * Status Response: { status, videoUrl?, error?, logs? }
 */

// ── Fal.ai ───────────────────────────────────────────────────────────

async function falSubmit({ model, apiKey, prompt, duration, input }) {
  const url = `https://queue.fal.run/${model}`;

  const body = input || {
    prompt,
    aspect_ratio: '16:9',
    duration: String(duration || 5)
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || data.message || JSON.stringify(data));
  }

  return {
    requestId: data.request_id,
    statusUrl: data.status_url || `https://queue.fal.run/${model}/requests/${data.request_id}/status`,
    responseUrl: data.response_url || `https://queue.fal.run/${model}/requests/${data.request_id}`,
    provider: 'fal-ai',
    model
  };
}

async function falStatus({ model, requestId, apiKey, statusUrl }) {
  const headers = { 'Authorization': `Key ${apiKey}` };

  // Check status
  const statusRes = await fetch(statusUrl, { headers });
  const statusJson = await statusRes.json();
  if (!statusRes.ok) {
    throw new Error(JSON.stringify(statusJson));
  }

  if (statusJson.status === 'COMPLETED') {
    // Fetch the actual result
    const resultUrl = `https://queue.fal.run/${model}/requests/${requestId}`;
    const resultRes = await fetch(resultUrl, { headers });
    const resultJson = await resultRes.json();

    const videoUrl = resultJson.video?.url
      || resultJson.images?.[0]?.url
      || resultJson.output?.video?.url
      || null;

    return { status: 'COMPLETED', videoUrl };
  }

  if (statusJson.status === 'FAILED') {
    return { status: 'FAILED', error: statusJson.error || 'Generation failed' };
  }

  return {
    status: statusJson.status || 'IN_PROGRESS',
    logs: statusJson.logs || []
  };
}

// ── Replicate ────────────────────────────────────────────────────────

async function replicateSubmit({ model, apiKey, prompt, duration }) {
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: {
        prompt,
        duration: duration || 5
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || JSON.stringify(data));
  }

  return {
    requestId: data.id,
    statusUrl: data.urls?.get || `https://api.replicate.com/v1/predictions/${data.id}`,
    responseUrl: data.urls?.get || `https://api.replicate.com/v1/predictions/${data.id}`,
    provider: 'replicate',
    model
  };
}

async function replicateStatus({ requestId, apiKey, statusUrl }) {
  const res = await fetch(statusUrl || `https://api.replicate.com/v1/predictions/${requestId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || JSON.stringify(data));
  }

  if (data.status === 'succeeded') {
    const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output;
    return { status: 'COMPLETED', videoUrl };
  }

  if (data.status === 'failed' || data.status === 'canceled') {
    return { status: 'FAILED', error: data.error || 'Generation failed' };
  }

  return {
    status: 'IN_PROGRESS',
    logs: data.logs ? [{ message: data.logs }] : []
  };
}

// ── Kling Direct API ─────────────────────────────────────────────────

async function klingSubmit({ apiKey, secretKey, prompt, duration }) {
  // Kling direct uses access_key + secret_key for JWT auth
  const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Secret-Key': secretKey || ''
    },
    body: JSON.stringify({
      prompt,
      duration: String(duration || 5),
      aspect_ratio: '16:9'
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }

  return {
    requestId: data.data?.task_id || data.task_id,
    statusUrl: `https://api.klingai.com/v1/videos/text2video/${data.data?.task_id || data.task_id}`,
    provider: 'kling-direct',
    model: 'kling-direct'
  };
}

async function klingStatus({ requestId, apiKey, secretKey }) {
  const res = await fetch(`https://api.klingai.com/v1/videos/text2video/${requestId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Secret-Key': secretKey || ''
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }

  const task = data.data || data;

  if (task.task_status === 'succeed') {
    const videoUrl = task.task_result?.videos?.[0]?.url;
    return { status: 'COMPLETED', videoUrl };
  }

  if (task.task_status === 'failed') {
    return { status: 'FAILED', error: task.task_status_msg || 'Generation failed' };
  }

  return { status: 'IN_PROGRESS', logs: [] };
}

// ── Gemini Omni via MuAPI ─────────────────────────────────────────────

async function geminiOmniSubmit({ apiKey, prompt, duration, aspectRatio, resolution, audioIds, characterIds, imageUrls, seed }) {
  // Determine endpoint based on whether images are provided
  let endpoint = 'gemini-omni-text-to-video';
  const body = {
    prompt,
    duration: duration || 8,
    aspect_ratio: aspectRatio || '16:9',
    resolution: resolution || '1080p'
  };

  if (imageUrls && imageUrls.length > 0) {
    endpoint = 'gemini-omni-image-to-video';
    body.image_urls = imageUrls;
  }

  if (audioIds && audioIds.length > 0) {
    body.audio_ids = audioIds;
  }
  if (characterIds && characterIds.length > 0) {
    body.character_ids = characterIds;
  }
  if (seed && seed >= 0) {
    body.seed = seed;
  }

  const res = await fetch(`https://api.muapi.ai/api/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid MuAPI key — check your key at muapi.ai');
    if (res.status === 402) throw new Error('Insufficient MuAPI credits — top up at muapi.ai/topup');
    if (res.status === 429) throw new Error('MuAPI rate limited — reduce request frequency');
    throw new Error(data.message || data.detail || JSON.stringify(data));
  }

  return {
    requestId: data.request_id,
    statusUrl: `https://api.muapi.ai/api/v1/predictions/${data.request_id}/result`,
    provider: 'gemini-omni',
    model: endpoint
  };
}

async function geminiOmniStatus({ requestId, apiKey }) {
  const res = await fetch(`https://api.muapi.ai/api/v1/predictions/${requestId}/result`, {
    headers: { 'x-api-key': apiKey }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }

  if (data.status === 'completed') {
    const videoUrl = data.outputs?.[0] || null;
    return { status: 'COMPLETED', videoUrl };
  }

  if (data.status === 'failed' || data.status === 'cancelled') {
    return { status: 'FAILED', error: `Job ${requestId} ended with status: ${data.status}` };
  }

  return { status: 'IN_PROGRESS', logs: [] };
}

// ── Gemini Omni — Video Edit ─────────────────────────────────────────

async function geminiOmniEditSubmit({ apiKey, prompt, videoUrl, duration, aspectRatio, resolution, trimStart, trimEnd, audioIds, characterIds, imageUrls, seed }) {
  const body = {
    prompt,
    duration: duration || 8,
    aspect_ratio: aspectRatio || '16:9',
    resolution: resolution || '1080p',
    trim_start: trimStart || 0,
    trim_end: trimEnd || 8
  };

  if (videoUrl) body.video_url = videoUrl;
  if (imageUrls && imageUrls.length > 0) body.image_urls = imageUrls;
  if (audioIds && audioIds.length > 0) body.audio_ids = audioIds;
  if (characterIds && characterIds.length > 0) body.character_ids = characterIds;
  if (seed && seed >= 0) body.seed = seed;

  const res = await fetch('https://api.muapi.ai/api/v1/gemini-omni-video-edit', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid MuAPI key');
    if (res.status === 402) throw new Error('Insufficient MuAPI credits — muapi.ai/topup');
    throw new Error(data.message || JSON.stringify(data));
  }

  return {
    requestId: data.request_id,
    statusUrl: `https://api.muapi.ai/api/v1/predictions/${data.request_id}/result`,
    provider: 'gemini-omni',
    model: 'gemini-omni-video-edit'
  };
}

// ── Gemini Omni — Character Creation ─────────────────────────────────

async function geminiOmniCreateCharacter({ apiKey, imageUrl, descriptions, characterName, audioIds }) {
  const body = {
    images_list: [imageUrl],
    descriptions
  };
  if (characterName) body.character_name = characterName;
  if (audioIds && audioIds.length > 0) body.audio_ids = audioIds;

  const res = await fetch('https://api.muapi.ai/api/v1/gemini-omni-character', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }

  // Poll for result
  const requestId = data.request_id;
  let attempts = 0;
  while (attempts < 90) { // 15min max
    await new Promise(r => setTimeout(r, 10000));
    const pollRes = await fetch(`https://api.muapi.ai/api/v1/predictions/${requestId}/result`, {
      headers: { 'x-api-key': apiKey }
    });
    const pollData = await pollRes.json();
    if (pollData.status === 'completed') {
      try {
        const charData = JSON.parse(pollData.outputs[0]);
        return {
          characterId: charData.characterId,
          characterName: charData.characterName || characterName,
          characterImage: charData.image || ''
        };
      } catch {
        return { characterId: pollData.outputs[0] };
      }
    }
    if (pollData.status === 'failed') throw new Error('Character creation failed');
    attempts++;
  }
  throw new Error('Character creation timed out');
}

// ── Route Handlers ───────────────────────────────────────────────────

export async function handleVideoSubmit(req, res) {
  try {
    const { provider, model, apiKey, secretKey, prompt, duration, input,
            aspectRatio, resolution, audioIds, characterIds, imageUrls, seed,
            videoUrl, trimStart, trimEnd, descriptions, characterName } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields: provider, apiKey' });
    }

    let result;

    switch (provider) {
      case 'fal-ai':
        result = await falSubmit({ model, apiKey, prompt, duration, input });
        break;
      case 'replicate':
        result = await replicateSubmit({ model, apiKey, prompt, duration });
        break;
      case 'kling-direct':
        result = await klingSubmit({ apiKey, secretKey, prompt, duration });
        break;
      case 'gemini-omni':
        result = await geminiOmniSubmit({ apiKey, prompt, duration, aspectRatio, resolution, audioIds, characterIds, imageUrls, seed });
        break;
      case 'gemini-omni-edit':
        result = await geminiOmniEditSubmit({ apiKey, prompt, videoUrl, duration, aspectRatio, resolution, trimStart, trimEnd, audioIds, characterIds, imageUrls, seed });
        break;
      case 'gemini-omni-character':
        result = await geminiOmniCreateCharacter({ apiKey, imageUrl: imageUrls?.[0], descriptions, characterName, audioIds });
        return res.json(result);
      default:
        return res.status(400).json({ error: `Unknown video provider: ${provider}` });
    }

    res.json(result);
  } catch (err) {
    console.error('Video submit error:', err.message);
    res.status(502).json({ error: err.message });
  }
}

export async function handleVideoStatus(req, res) {
  try {
    const { provider, requestId, model, apiKey, secretKey, statusUrl } = req.body;

    if (!provider || !requestId) {
      return res.status(400).json({ error: 'Missing required fields: provider, requestId' });
    }

    let result;

    switch (provider) {
      case 'fal-ai':
        result = await falStatus({ model, requestId, apiKey, statusUrl });
        break;
      case 'replicate':
        result = await replicateStatus({ requestId, apiKey, statusUrl });
        break;
      case 'kling-direct':
        result = await klingStatus({ requestId, apiKey, secretKey });
        break;
      case 'gemini-omni':
      case 'gemini-omni-edit':
        result = await geminiOmniStatus({ requestId, apiKey });
        break;
      default:
        return res.status(400).json({ error: `Unknown video provider: ${provider}` });
    }

    res.json(result);
  } catch (err) {
    console.error('Video status error:', err.message);
    res.status(502).json({ error: err.message });
  }
}
