'use strict';

const REQUEST_TIMEOUT_MS = 45_000;

class AiProviderError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.name = 'AiProviderError';
    this.code = code;
    this.status = status;
  }
}

function getAdapter(provider) {
  if (provider === 'openai') return openAiAdapter;
  if (provider === 'gemini') return geminiAdapter;
  throw new AiProviderError('INVALID_AI_PROVIDER', 400);
}

const geminiAdapter = Object.freeze({
  id: 'gemini',
  async sendRequest(config, request, runtime = {}) {
    const contents = request.messages.map((message, index) => {
      const parts = [];
      if (message.content) parts.push({ text: message.content });
      if (index === request.messages.length - 1) {
        for (const attachment of request.attachments || []) {
          parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
        }
      }
      return { role: message.role === 'assistant' ? 'model' : 'user', parts };
    });
    const payload = {
      contents,
      generationConfig: { temperature: request.temperature, maxOutputTokens: request.maxOutputTokens }
    };
    if (request.system) payload.systemInstruction = { role: 'user', parts: [{ text: request.system }] };
    const response = await providerFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: JSON.stringify(payload)
      }, runtime
    );
    const data = await readProviderJson(response);
    if (!response.ok) throw errorFromResponse(response);
    const text = (data?.candidates?.[0]?.content?.parts || []).map((part) => typeof part.text === 'string' ? part.text : '').join('');
    if (!text) throw new AiProviderError('EMPTY_MODEL_RESPONSE', 502);
    return { text, usage: normalizeGeminiUsage(data?.usageMetadata) };
  },
  async testConnection(config, runtime = {}) {
    const response = await providerFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}`,
      { headers: { Accept: 'application/json', 'x-goog-api-key': config.apiKey } }, runtime
    );
    await consumeProviderResponse(response);
    return { status: 'ok' };
  },
  async listModels(config, runtime = {}) {
    const response = await providerFetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
      headers: { Accept: 'application/json', 'x-goog-api-key': config.apiKey }
    }, runtime);
    const data = await readProviderJson(response);
    if (!response.ok) throw errorFromResponse(response);
    return (Array.isArray(data?.models) ? data.models : [])
      .filter((item) => !Array.isArray(item.supportedGenerationMethods) || item.supportedGenerationMethods.includes('generateContent'))
      .map((item) => ({ id: String(item.name || '').replace(/^models\//, ''), name: String(item.displayName || item.name || '') }))
      .filter((item) => item.id);
  },
  normalizeUsage: normalizeGeminiUsage,
  normalizeError
});

const openAiAdapter = Object.freeze({
  id: 'openai',
  async sendRequest(config, request, runtime = {}) {
    const messages = [];
    if (request.system) messages.push({ role: 'system', content: request.system });
    request.messages.forEach((message, index) => {
      if (index === request.messages.length - 1 && (request.attachments || []).length) {
        const content = [];
        if (message.content) content.push({ type: 'text', text: message.content });
        (request.attachments || []).forEach((attachment) => content.push({
          type: 'image_url', image_url: { url: `data:${attachment.mimeType};base64,${attachment.data}` }
        }));
        messages.push({ role: message.role, content });
      } else {
        messages.push({ role: message.role, content: message.content });
      }
    });
    const response = await providerFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages, temperature: request.temperature, max_tokens: request.maxOutputTokens })
    }, runtime);
    const data = await readProviderJson(response);
    if (!response.ok) throw errorFromResponse(response);
    const raw = data?.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map((part) => part && part.text || '').join('') : '';
    if (!text) throw new AiProviderError('EMPTY_MODEL_RESPONSE', 502);
    return { text, usage: normalizeOpenAiUsage(data?.usage) };
  },
  async testConnection(config, runtime = {}) {
    const response = await providerFetch(`https://api.openai.com/v1/models/${encodeURIComponent(config.model)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${config.apiKey}` }
    }, runtime);
    await consumeProviderResponse(response);
    return { status: 'ok' };
  },
  async listModels(config, runtime = {}) {
    const response = await providerFetch('https://api.openai.com/v1/models', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${config.apiKey}` }
    }, runtime);
    const data = await readProviderJson(response);
    if (!response.ok) throw errorFromResponse(response);
    return (Array.isArray(data?.data) ? data.data : [])
      .map((item) => ({ id: String(item.id || ''), name: String(item.id || '') }))
      .filter((item) => item.id)
      .sort((left, right) => left.id.localeCompare(right.id));
  },
  normalizeUsage: normalizeOpenAiUsage,
  normalizeError
});

async function providerFetch(url, options, runtime) {
  const fetchImpl = runtime.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') throw new AiProviderError('AI_PROVIDER_ERROR', 502);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtime.timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch {
    throw new AiProviderError('AI_PROVIDER_ERROR', 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function consumeProviderResponse(response) {
  if (!response.ok) {
    try { await response.text(); } catch {}
    throw errorFromResponse(response);
  }
  try { await response.text(); } catch {}
}

async function readProviderJson(response) {
  try { return await response.json(); } catch { return null; }
}

function errorFromResponse(response) {
  if (response.status === 401 || response.status === 403) return new AiProviderError('AI_INVALID_KEY', 400);
  if (response.status === 404) return new AiProviderError('AI_MODEL_UNAVAILABLE', 400);
  if (response.status === 429) return new AiProviderError('AI_RATE_LIMITED', 429);
  return new AiProviderError('AI_PROVIDER_ERROR', 502);
}

function normalizeError(error) {
  const code = error && error.code;
  if (code === 'AI_INVALID_KEY') return { status: 'invalid_key', code };
  if (code === 'AI_MODEL_UNAVAILABLE') return { status: 'model_unavailable', code };
  if (code === 'AI_RATE_LIMITED') return { status: 'rate_limited', code };
  return { status: 'provider_error', code: 'AI_PROVIDER_ERROR' };
}

function normalizeGeminiUsage(value) {
  return {
    inputTokens: finiteInteger(value?.promptTokenCount),
    outputTokens: finiteInteger(value?.candidatesTokenCount),
    totalTokens: finiteInteger(value?.totalTokenCount)
  };
}

function normalizeOpenAiUsage(value) {
  return {
    inputTokens: finiteInteger(value?.prompt_tokens),
    outputTokens: finiteInteger(value?.completion_tokens),
    totalTokens: finiteInteger(value?.total_tokens)
  };
}

function finiteInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

module.exports = { AiProviderError, getAdapter, geminiAdapter, normalizeError, openAiAdapter };
