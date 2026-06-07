import type { AiProviderType } from '@balance/shared';

type Creds = Record<string, string>;
type ProbeResult = { ok: boolean; message: string };

async function get(url: string, headers: Record<string, string>): Promise<ProbeResult> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (res.ok) return { ok: true, message: 'Connected successfully' };
    const body = await res.text().catch(() => '');
    return { ok: false, message: body || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function post(url: string, headers: Record<string, string>): Promise<ProbeResult> {
  try {
    const res = await fetch(url, { method: 'POST', headers, signal: AbortSignal.timeout(10_000) });
    if (res.ok) return { ok: true, message: 'Connected successfully' };
    const body = await res.text().catch(() => '');
    return { ok: false, message: body || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

function bearer(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Lightweight credential check — lists models or pings a health endpoint
 * for each provider. Does not save anything.
 */
export async function testAiConnection(
  provider: AiProviderType,
  creds: Creds,
): Promise<ProbeResult> {
  switch (provider) {
    case 'openai': {
      const base = (creds.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
      return get(`${base}/models`, bearer(creds.apiKey ?? ''));
    }

    case 'azure': {
      const endpoint = (creds.endpoint ?? '').replace(/\/$/, '');
      const version = creds.apiVersion ?? '2024-02-15-preview';
      const url = `${endpoint}/openai/deployments?api-version=${version}`;
      return get(url, { 'api-key': creds.apiKey ?? '' });
    }

    case 'gemini-studio': {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(creds.apiKey ?? '')}`;
      return get(url, {});
    }

    case 'gemini-vertex': {
      // Full OAuth flow is complex; validate the JSON structure instead
      try {
        const json = JSON.parse(creds.serviceAccountJson ?? '{}');
        const required = ['type', 'project_id', 'private_key', 'client_email'];
        const missing = required.filter((k) => !json[k]);
        if (missing.length) {
          return { ok: false, message: `Service account JSON missing fields: ${missing.join(', ')}` };
        }
        return { ok: true, message: 'Service account JSON looks valid' };
      } catch {
        return { ok: false, message: 'Service account JSON is not valid JSON' };
      }
    }

    case 'anthropic': {
      return get('https://api.anthropic.com/v1/models', {
        'x-api-key': creds.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      });
    }

    case 'deepseek': {
      const base = (creds.baseUrl ?? 'https://api.deepseek.com').replace(/\/$/, '');
      return get(`${base}/models`, bearer(creds.apiKey ?? ''));
    }

    case 'xai': {
      const base = (creds.baseUrl ?? 'https://api.x.ai/v1').replace(/\/$/, '');
      return get(`${base}/models`, bearer(creds.apiKey ?? ''));
    }

    case 'huggingface': {
      return get('https://huggingface.co/api/whoami', bearer(creds.apiKey ?? ''));
    }

    case 'openrouter': {
      return get('https://openrouter.ai/api/v1/models', bearer(creds.apiKey ?? ''));
    }

    case 'groq': {
      return get('https://api.groq.com/openai/v1/models', bearer(creds.apiKey ?? ''));
    }

    case 'mistral': {
      return get('https://api.mistral.ai/v1/models', bearer(creds.apiKey ?? ''));
    }

    case 'cohere': {
      return post('https://api.cohere.com/v1/check-api-key', {
        ...bearer(creds.apiKey ?? ''),
        'Content-Type': 'application/json',
      });
    }

    case 'together': {
      return get('https://api.together.xyz/v1/models', bearer(creds.apiKey ?? ''));
    }

    case 'ollama': {
      const base = (creds.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
      const headers: Record<string, string> = {};
      if (creds.apiKey) headers['Authorization'] = `Bearer ${creds.apiKey}`;
      return get(`${base}/api/tags`, headers);
    }

    case 'local': {
      const base = (creds.baseUrl ?? '').replace(/\/$/, '');
      const headers: Record<string, string> = {};
      if (creds.apiKey) headers['Authorization'] = `Bearer ${creds.apiKey}`;
      return get(`${base}/models`, headers);
    }

    default: {
      const _exhaustive: never = provider;
      return { ok: false, message: `Unknown provider: ${_exhaustive}` };
    }
  }
}
