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

// ── Route Handlers ───────────────────────────────────────────────────

export async function handleVideoSubmit(req, res) {
  try {
    const { provider, model, apiKey, secretKey, prompt, duration, input } = req.body;

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
      default:
        return res.status(400).json({ error: `Unknown video provider: ${provider}` });
    }

    res.json(result);
  } catch (err) {
    console.error('Video status error:', err.message);
    res.status(502).json({ error: err.message });
  }
}
