import type { AiProviderType } from '@balance/shared';

type Creds = Record<string, string>;

const JSON_HDR = { 'Content-Type': 'application/json' };
const TIMEOUT = 30_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...JSON_HDR, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error(text || `HTTP ${res.status}`); }
  if (!res.ok) throw new Error(errMsg(data) || text || `HTTP ${res.status}`);
  return data;
}

function errMsg(d: unknown): string {
  if (!d || typeof d !== 'object') return '';
  const o = d as Record<string, unknown>;
  if (typeof o.error === 'string') return o.error;
  if (o.error && typeof o.error === 'object') {
    const e = o.error as Record<string, unknown>;
    return typeof e.message === 'string' ? e.message : '';
  }
  return typeof o.message === 'string' ? o.message : '';
}

// Extract text from OpenAI-compatible /chat/completions response
function oaiText(d: unknown): string {
  const r = d as { choices?: { message?: { content?: string } }[] };
  return r?.choices?.[0]?.message?.content ?? '';
}

function bearer(key: string) { return { Authorization: `Bearer ${key}` }; }

/**
 * Send a single-turn prompt to the configured AI provider and return the
 * text response. Throws on network or auth errors.
 */
export async function completeAi(provider: AiProviderType, creds: Creds, prompt: string): Promise<string> {
  const msgs = [{ role: 'user', content: prompt }];
  const maxTokens = 1500;

  switch (provider) {
    case 'openai': {
      const base = (creds.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
      const hdrs: Record<string, string> = bearer(creds.apiKey ?? '');
      if (creds.orgId) hdrs['OpenAI-Organization'] = creds.orgId;
      const d = await postJson(`${base}/chat/completions`, hdrs,
        { model: creds.modelName, messages: msgs, max_tokens: maxTokens });
      return oaiText(d);
    }

    case 'azure': {
      const ep = (creds.endpoint ?? '').replace(/\/$/, '');
      const ver = creds.apiVersion ?? '2024-02-15-preview';
      const d = await postJson(
        `${ep}/openai/deployments/${creds.deploymentName}/chat/completions?api-version=${ver}`,
        { 'api-key': creds.apiKey ?? '' },
        { messages: msgs, max_tokens: maxTokens },
      );
      return oaiText(d);
    }

    case 'gemini-studio': {
      const model = creds.modelName ?? 'gemini-1.5-flash';
      const d = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(creds.apiKey ?? '')}`,
        {},
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } },
      ) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return d?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    case 'gemini-vertex': {
      throw new Error('Gemini Vertex AI requires service-account OAuth which is not supported in the chat endpoint. Use Gemini (AI Studio) with an API key instead.');
    }

    case 'anthropic': {
      const d = await postJson('https://api.anthropic.com/v1/messages',
        { 'x-api-key': creds.apiKey ?? '', 'anthropic-version': '2023-06-01' },
        { model: creds.modelName, max_tokens: maxTokens, messages: msgs },
      ) as { content?: { text?: string }[] };
      return d?.content?.[0]?.text ?? '';
    }

    case 'deepseek': {
      const base = (creds.baseUrl ?? 'https://api.deepseek.com').replace(/\/$/, '');
      const d = await postJson(`${base}/chat/completions`, bearer(creds.apiKey ?? ''),
        { model: creds.modelName, messages: msgs, max_tokens: maxTokens });
      return oaiText(d);
    }

    case 'xai': {
      const base = (creds.baseUrl ?? 'https://api.x.ai/v1').replace(/\/$/, '');
      const d = await postJson(`${base}/chat/completions`, bearer(creds.apiKey ?? ''),
        { model: creds.modelName, messages: msgs, max_tokens: maxTokens });
      return oaiText(d);
    }

    case 'huggingface': {
      if (creds.endpointType === 'dedicated' && creds.endpointUrl) {
        const base = creds.endpointUrl.replace(/\/$/, '');
        const d = await postJson(`${base}/v1/chat/completions`, bearer(creds.apiKey ?? ''),
          { model: creds.modelId, messages: msgs, max_tokens: maxTokens });
        return oaiText(d);
      }
      const d = await postJson(
        `https://api-inference.huggingface.co/models/${creds.modelId}/v1/chat/completions`,
        bearer(creds.apiKey ?? ''),
        { model: creds.modelId, messages: msgs, max_tokens: maxTokens },
      );
      return oaiText(d);
    }

    case 'openrouter': {
      const hdrs: Record<string, string> = bearer(creds.apiKey ?? '');
      if (creds.siteUrl) hdrs['HTTP-Referer'] = creds.siteUrl;
      if (creds.siteName) hdrs['X-Title'] = creds.siteName;
      const d = await postJson('https://openrouter.ai/api/v1/chat/completions', hdrs,
        { model: creds.modelId, messages: msgs, max_tokens: maxTokens });
      return oaiText(d);
    }

    case 'groq': {
      const d = await postJson('https://api.groq.com/openai/v1/chat/completions',
        bearer(creds.apiKey ?? ''),
        { model: creds.modelName, messages: msgs, max_tokens: maxTokens });
      return oaiText(d);
    }

    case 'mistral': {
      const d = await postJson('https://api.mistral.ai/v1/chat/completions',
        bearer(creds.apiKey ?? ''),
        { model: creds.modelName, messages: msgs, max_tokens: maxTokens });
      return oaiText(d);
    }

    case 'cohere': {
      const d = await postJson('https://api.cohere.com/v2/chat',
        bearer(creds.apiKey ?? ''),
        { model: creds.modelName, messages: msgs, max_tokens: maxTokens },
      ) as { message?: { content?: { type?: string; text?: string }[] } };
      return d?.message?.content?.find((c) => c.type === 'text')?.text ?? '';
    }

    case 'together': {
      const d = await postJson('https://api.together.xyz/v1/chat/completions',
        bearer(creds.apiKey ?? ''),
        { model: creds.modelName, messages: msgs, max_tokens: maxTokens });
      return oaiText(d);
    }

    case 'ollama': {
      const base = (creds.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
      const hdrs: Record<string, string> = {};
      if (creds.apiKey) hdrs['Authorization'] = `Bearer ${creds.apiKey}`;
      const d = await postJson(`${base}/api/chat`, hdrs,
        { model: creds.modelName, messages: msgs, stream: false },
      ) as { message?: { content?: string } };
      return d?.message?.content ?? '';
    }

    case 'local': {
      const base = (creds.baseUrl ?? '').replace(/\/$/, '');
      const hdrs: Record<string, string> = {};
      if (creds.apiKey) hdrs['Authorization'] = `Bearer ${creds.apiKey}`;
      const d = await postJson(`${base}/chat/completions`, hdrs,
        { model: creds.modelName, messages: msgs, max_tokens: maxTokens });
      return oaiText(d);
    }

    default: {
      const _: never = provider;
      throw new Error(`Unknown provider: ${_}`);
    }
  }
}
