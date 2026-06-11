import fetch from 'node-fetch';

/**
 * LLM Completion Proxy
 * Handles: OpenRouter, Groq, OpenAI, Anthropic, Gemini, DeepSeek, xAI, Mistral
 * 
 * Request:  { provider, model, apiKey, system, prompt }
 * Response: { content }
 */

const PROVIDER_CONFIGS = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    format: 'openai'
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    format: 'openai'
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    format: 'openai'
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    format: 'openai'
  },
  xai: {
    url: 'https://api.x.ai/v1/chat/completions',
    format: 'openai'
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    format: 'openai'
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    format: 'anthropic'
  },
  gemini: {
    url: (model, apiKey) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    format: 'gemini'
  }
};

async function callOpenAIFormat(config, { model, apiKey, system, prompt }) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  // OpenRouter wants extra headers
  if (config.url.includes('openrouter')) {
    headers['HTTP-Referer'] = 'https://director-x.app';
    headers['X-Title'] = 'Director-X';
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ],
    max_tokens: 4000,
    temperature: 0.7
  };

  const res = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }

  return data.choices?.[0]?.message?.content || null;
}

async function callAnthropic({ model, apiKey, system, prompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }

  return data.content?.[0]?.text || null;
}

async function callGemini({ model, apiKey, system, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: system + '\n\n' + prompt }] }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

export async function handleLLMCompletion(req, res) {
  try {
    const { provider, model, apiKey, system, prompt } = req.body;

    if (!provider || !model || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields: provider, model, apiKey' });
    }

    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      return res.status(400).json({ error: `Unknown LLM provider: ${provider}` });
    }

    let content;

    if (config.format === 'anthropic') {
      content = await callAnthropic({ model, apiKey, system, prompt });
    } else if (config.format === 'gemini') {
      content = await callGemini({ model, apiKey, system, prompt });
    } else {
      content = await callOpenAIFormat(config, { model, apiKey, system, prompt });
    }

    res.json({ content });
  } catch (err) {
    console.error('LLM error:', err.message);
    res.status(502).json({ error: err.message });
  }
}
