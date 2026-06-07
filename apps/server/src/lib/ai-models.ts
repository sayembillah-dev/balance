import type { AiProviderType } from '@balance/shared';

type Creds = Record<string, string>;

export interface AiModel {
  id: string;
  name: string;
}

// Static fallback list for providers where live model fetching isn't practical
const VERTEX_MODELS: AiModel[] = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
];

function bearer(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches the list of available models for the given provider using the
 * supplied credentials. Normalises all responses to `{ id, name }[]`.
 * Throws on network or auth failure — callers should catch and return an error response.
 */
export async function fetchModels(provider: AiProviderType, creds: Creds): Promise<AiModel[]> {
  switch (provider) {
    case 'openai': {
      const base = (creds.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
      const isDefault = !creds.baseUrl || creds.baseUrl.includes('api.openai.com');
      const data = (await fetchJson(`${base}/models`, bearer(creds.apiKey ?? ''))) as {
        data: { id: string; owned_by: string }[];
      };
      return (data.data ?? [])
        .filter((m) => !isDefault || m.owned_by?.startsWith('system'))
        .map((m) => ({ id: m.id, name: m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    case 'azure': {
      const endpoint = (creds.endpoint ?? '').replace(/\/$/, '');
      const version = creds.apiVersion ?? '2024-02-15-preview';
      const data = (await fetchJson(
        `${endpoint}/openai/deployments?api-version=${version}`,
        { 'api-key': creds.apiKey ?? '' },
      )) as { value: { id: string; model: string }[] };
      return (data.value ?? []).map((d) => ({ id: d.id, name: `${d.id} (${d.model})` }));
    }

    case 'gemini-studio': {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(creds.apiKey ?? '')}`;
      const data = (await fetchJson(url, {})) as {
        models: { name: string; displayName: string }[];
      };
      return (data.models ?? []).map((m) => ({
        id: m.name.replace(/^models\//, ''),
        name: m.displayName ?? m.name,
      }));
    }

    case 'gemini-vertex': {
      // OAuth token exchange is too complex for a simple fetch; return curated list
      return VERTEX_MODELS;
    }

    case 'anthropic': {
      const data = (await fetchJson('https://api.anthropic.com/v1/models', {
        'x-api-key': creds.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      })) as { data: { id: string; display_name: string; created_at: string }[] };
      return (data.data ?? [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((m) => ({ id: m.id, name: m.display_name ?? m.id }));
    }

    case 'deepseek': {
      const base = (creds.baseUrl ?? 'https://api.deepseek.com').replace(/\/$/, '');
      const data = (await fetchJson(`${base}/models`, bearer(creds.apiKey ?? ''))) as {
        data: { id: string }[];
      };
      return (data.data ?? []).map((m) => ({ id: m.id, name: m.id }));
    }

    case 'xai': {
      const base = (creds.baseUrl ?? 'https://api.x.ai/v1').replace(/\/$/, '');
      const data = (await fetchJson(`${base}/models`, bearer(creds.apiKey ?? ''))) as {
        data: { id: string }[];
      };
      return (data.data ?? []).map((m) => ({ id: m.id, name: m.id }));
    }

    case 'huggingface': {
      // List warm, popular text-generation models — user can also type a custom model ID
      const url =
        'https://huggingface.co/api/models?filter=text-generation&inference=warm&sort=likes&direction=-1&limit=40';
      const data = (await fetchJson(url, bearer(creds.apiKey ?? ''))) as {
        id?: string;
        modelId?: string;
      }[];
      return (data ?? []).map((m) => {
        const id = m.modelId ?? m.id ?? '';
        return { id, name: id };
      });
    }

    case 'openrouter': {
      const data = (await fetchJson('https://openrouter.ai/api/v1/models', bearer(creds.apiKey ?? ''))) as {
        data: { id: string; name: string }[];
      };
      return (data.data ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id }));
    }

    case 'groq': {
      const data = (await fetchJson('https://api.groq.com/openai/v1/models', bearer(creds.apiKey ?? ''))) as {
        data: { id: string }[];
      };
      return (data.data ?? []).map((m) => ({ id: m.id, name: m.id }));
    }

    case 'mistral': {
      const data = (await fetchJson('https://api.mistral.ai/v1/models', bearer(creds.apiKey ?? ''))) as {
        data: { id: string; name?: string }[];
      };
      return (data.data ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id }));
    }

    case 'cohere': {
      const data = (await fetchJson(
        'https://api.cohere.com/v1/models',
        bearer(creds.apiKey ?? ''),
      )) as { models: { name: string; endpoints?: string[] }[] };
      return (data.models ?? [])
        .filter((m) => !m.endpoints || m.endpoints.includes('chat'))
        .map((m) => ({ id: m.name, name: m.name }));
    }

    case 'together': {
      const data = (await fetchJson('https://api.together.xyz/v1/models', bearer(creds.apiKey ?? ''))) as {
        id: string;
        display_name?: string;
      }[];
      return (Array.isArray(data) ? data : []).map((m) => ({
        id: m.id,
        name: m.display_name ?? m.id,
      }));
    }

    case 'ollama': {
      const base = (creds.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
      const headers: Record<string, string> = {};
      if (creds.apiKey) headers['Authorization'] = `Bearer ${creds.apiKey}`;
      const data = (await fetchJson(`${base}/api/tags`, headers)) as {
        models: { name: string }[];
      };
      return (data.models ?? []).map((m) => ({ id: m.name, name: m.name }));
    }

    case 'local': {
      const base = (creds.baseUrl ?? '').replace(/\/$/, '');
      const headers: Record<string, string> = {};
      if (creds.apiKey) headers['Authorization'] = `Bearer ${creds.apiKey}`;
      const data = (await fetchJson(`${base}/models`, headers)) as {
        data: { id: string }[];
      };
      return (data.data ?? []).map((m) => ({ id: m.id, name: m.id }));
    }

    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}
