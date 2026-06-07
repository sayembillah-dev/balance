/* Balance — Settings.
   Internal tabs; Preferences & Logic is the showcase.
   Draft/Save/Cancel persisted via the API (profile → /me, prefs → /me/settings). */
import React, { useState, useRef, useEffect } from 'react';
import { apiUpload, apiObjectUrl, apiPost, apiPatch, apiDelete, apiGet } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Select from '../components/Select.jsx';
import { Check, Key, ShieldCheck, DownloadSimple, User, SlidersHorizontal, Plug, Brain, Eye, EyeSlash, X as XIcon } from '@phosphor-icons/react';

// Full IANA timezone list (every zone the runtime knows), each labelled with its
// current UTC offset. Falls back to a short list on older engines.
const TZ_FALLBACK = ['UTC', 'Asia/Kolkata', 'Asia/Dhaka', 'America/New_York', 'Europe/London'];
const tzOffset = (zone) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || '';
  } catch { return ''; }
};
const ALL_TZ = (() => {
  try { return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : TZ_FALLBACK; }
  catch { return TZ_FALLBACK; }
})();
const TIMEZONES = ALL_TZ.map((z) => ({ value: z, label: `${z.replace(/_/g, ' ')} — ${tzOffset(z)}` }));
const BROWSER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
})();

const G = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const GI = {
  check: Check, key: Key, shield: ShieldCheck, download: DownloadSimple,
  user: User, sliders: SlidersHorizontal, plug: Plug, brain: Brain,
};
const STORE = 'balance.settings.v1';

const DEFAULTS = {
  name: 'Ananya Sharma', email: 'ananya@example.com', phone: '+91 98765 43210', timezone: BROWSER_TZ,
  currency: 'INR', monthStart: '1', rollover: true, tagBehavior: 'parallel', privacy: false,
  twoFactor: true, loginAlerts: true, biometric: false,
  sync: true, googleDrive: false, weeklyEmail: true,
  // AI settings
  aiEnabled: false, aiActiveModelId: null,
};
const load = () => ({ ...DEFAULTS, ...window.BAL.loadSettings() });

const CURRENCIES = [
  { v: 'INR', l: 'INR — ₹ (Indian Rupee)' }, { v: 'USD', l: 'USD — $ (US Dollar)' },
  { v: 'EUR', l: 'EUR — € (Euro)' }, { v: 'GBP', l: 'GBP — £ (Pound)' }, { v: 'BDT', l: 'BDT — ৳ (Taka)' },
];
const MONTH_START = [
  { v: '1', l: '1st of the month' }, { v: '25', l: '25th of the month' }, { v: 'last', l: 'Last day of month' }, { v: 'payday', l: 'On payday' },
];
const TABS = [
  { id: 'profile', icon: GI.user, label: 'General Profile' },
  { id: 'prefs', icon: GI.sliders, label: 'Preferences & Logic' },
  { id: 'security', icon: GI.shield, label: 'Security & Privacy' },
  { id: 'data', icon: GI.plug, label: 'Data & Integrations' },
  { id: 'ai', icon: GI.brain, label: 'AI Assistant' },
];

const Switch = ({ on, onClick }) => <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={!!on} onClick={onClick}><i /></button>;
const Row = ({ title, sub, children, block, danger }) => (
  <div className={`set-row${block ? ' block' : ''}${danger ? ' danger' : ''}`}>
    <div className="rl"><b>{title}</b>{sub && <span className="rl-sub">{sub}</span>}</div>
    {block ? children : <div className="rc">{children}</div>}
  </div>
);

function ProfilePanel({ d, set, avatarUrl, fileRef, onPickPhoto }) {
  return (
    <>
      <div className="set-group">
        <div className="set-profile">
          <div className="set-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : undefined}>
            {avatarUrl ? '' : d.name.charAt(0)}
          </div>
          <div className="pmeta"><b>{d.name || 'Your name'}</b><span>{d.email}</span></div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onPickPhoto} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Change photo</button>
        </div>
      </div>
      <div className="set-group">
        <Row title="Full name"><input className="txn-field" style={{ minWidth: 240, height: 42, color: 'var(--ink)' }} value={d.name} onChange={(e) => set('name', e.target.value)} /></Row>
        <Row title="Email address" sub="Your sign-in email can't be changed here."><input className="txn-field" style={{ minWidth: 240, height: 42, color: 'var(--ink-3)' }} value={d.email} readOnly disabled /></Row>
        <Row title="Phone"><input className="txn-field" style={{ minWidth: 240, height: 42, color: 'var(--ink)' }} value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Row>
        <Row title="Time zone">
          <Select value={String(d.timezone || '').split(' (')[0].trim()} onChange={(v) => set('timezone', v)} options={TIMEZONES} ariaLabel="Time zone" />
        </Row>
      </div>
    </>
  );
}

function PrefsPanel({ d, set }) {
  return (
    <>
      <div className="set-group-t">Currency &amp; Localization</div>
      <div className="set-group">
        <Row title="Primary currency" sub="This is the primary currency used across your dashboards and analytics.">
          <Select value={d.currency} onChange={(v) => set('currency', v)} ariaLabel="Primary currency"
            options={CURRENCIES.map((c) => ({ value: c.v, label: c.l }))} />
        </Row>
        <Row title="Financial month start" sub="The day your monthly budgets reset and a new period begins.">
          <Select value={d.monthStart} onChange={(v) => set('monthStart', v)} ariaLabel="Financial month start"
            options={MONTH_START.map((m) => ({ value: m.v, label: m.l }))} />
        </Row>
      </div>

      <div className="set-group-t">Budget &amp; Tag Configuration</div>
      <div className="set-group">
        <Row title="Enable budget rollover" sub="Automatically transfer unspent budget balances into the next month's limits.">
          <Switch on={d.rollover} onClick={() => set('rollover', !d.rollover)} />
        </Row>
        <Row block title="Default tag behaviour" sub="How new tag budgets interact with your standard category budgets by default.">
          <div className="radio-cards">
            <div className={`radio-card${d.tagBehavior === 'parallel' ? ' on' : ''}`} onClick={() => set('tagBehavior', 'parallel')}>
              <span className="radio-dot" />
              <div className="rc-txt"><b>Parallel tracking <span className="rec">Recommended</span></b><p>Tag budgets are tracked alongside standard category limits — a transaction counts toward both.</p></div>
            </div>
            <div className={`radio-card${d.tagBehavior === 'isolated' ? ' on' : ''}`} onClick={() => set('tagBehavior', 'isolated')}>
              <span className="radio-dot" />
              <div className="rc-txt"><b>Isolated tracking</b><p>Tagged transactions bypass normal category budgets completely and only count toward the tag.</p></div>
            </div>
          </div>
        </Row>
      </div>

      <div className="set-group-t">Privacy Display</div>
      <div className="set-group">
        <Row title="Mask dashboard balances" sub="Conceal monetary values on the main dashboard with dots (••••) for secure viewing in public.">
          <Switch on={d.privacy} onClick={() => set('privacy', !d.privacy)} />
        </Row>
      </div>
    </>
  );
}

function SecurityPanel({ a }) {
  return (
    <>
      <div className="set-group-t">Authentication</div>
      <div className="set-group">
        <Row title="Password" sub="Change the password you sign in with."><button className="btn-ghost" onClick={a.changePassword}><G d={GI.key} />Change password</button></Row>
      </div>
      <div className="set-group-t">Sessions</div>
      <div className="set-group">
        <Row title="Sign out everywhere" sub="End every active session, including this one. You'll sign in again."><button className="btn-ghost" onClick={a.signOutAll}>Sign out all devices</button></Row>
      </div>
      <div className="set-group">
        <Row danger title="Delete account" sub="Permanently remove your account and all data. This cannot be undone."><button className="btn-ghost" style={{ color: '#c02626', borderColor: 'color-mix(in oklab,#e23b3b 30%,#fff)' }} onClick={a.deleteAccount}>Delete</button></Row>
      </div>
    </>
  );
}

// ── AI Provider Config ────────────────────────────────────────────────────────
const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI (ChatGPT)' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'gemini-studio', label: 'Google Gemini (AI Studio)' },
  { value: 'gemini-vertex', label: 'Google Gemini (Vertex AI)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'xai', label: 'xAI (Grok)' },
  { value: 'huggingface', label: 'Hugging Face' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'groq', label: 'Groq' },
  { value: 'mistral', label: 'Mistral AI' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'together', label: 'Together AI' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'local', label: 'Local (LM Studio / vLLM)' },
];

const PROVIDER_CONFIG = {
  openai: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'gpt-4o' },
    { key: 'baseUrl', label: 'Base URL', type: 'text', required: false, placeholder: 'https://api.openai.com/v1', hint: 'Optional — override for enterprise proxies.' },
    { key: 'orgId', label: 'Organization ID', type: 'text', required: false, placeholder: 'org-...' },
  ]},
  azure: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'endpoint', label: 'Endpoint', type: 'text', required: true, placeholder: 'https://{name}.openai.azure.com/' },
    { key: 'deploymentName', label: 'Deployment Name', type: 'text', required: true, placeholder: 'my-gpt4-deployment' },
    { key: 'apiVersion', label: 'API Version', type: 'text', required: true, placeholder: '2024-02-15-preview' },
  ]},
  'gemini-studio': { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'gemini-1.5-pro' },
  ]},
  'gemini-vertex': { fields: [
    { key: 'serviceAccountJson', label: 'Service Account JSON', type: 'textarea', required: true, placeholder: 'Paste the contents of your service account JSON file…' },
    { key: 'projectId', label: 'Project ID', type: 'text', required: true },
    { key: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-central1' },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'gemini-1.5-pro' },
  ]},
  anthropic: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'claude-3-5-sonnet-20241022' },
  ]},
  deepseek: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'deepseek-chat' },
    { key: 'baseUrl', label: 'Base URL', type: 'text', required: false, placeholder: 'https://api.deepseek.com' },
  ]},
  xai: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'grok-beta' },
    { key: 'baseUrl', label: 'Base URL', type: 'text', required: false, placeholder: 'https://api.x.ai/v1' },
  ]},
  huggingface: { fields: [
    { key: 'apiKey', label: 'Access Token', type: 'password', required: true },
    { key: 'modelId', label: 'Model', type: 'model', required: true, placeholder: 'meta-llama/Meta-Llama-3-8B-Instruct' },
    { key: 'endpointType', label: 'Endpoint Type', type: 'radio', required: true, options: [
      { value: 'serverless', label: 'Serverless Inference API' },
      { value: 'dedicated', label: 'Dedicated Endpoint' },
    ]},
    { key: 'endpointUrl', label: 'Endpoint URL', type: 'text', required: false, placeholder: 'https://your-endpoint.huggingface.cloud', dependsOn: { key: 'endpointType', value: 'dedicated' } },
  ]},
  openrouter: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelId', label: 'Model', type: 'model', required: true, placeholder: 'anthropic/claude-3-opus' },
    { key: 'siteUrl', label: 'Site URL', type: 'text', required: false, placeholder: 'https://yourapp.com' },
    { key: 'siteName', label: 'Site Name', type: 'text', required: false, placeholder: 'My App' },
  ]},
  groq: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'llama-3.1-70b-versatile' },
  ]},
  mistral: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'mistral-large-latest' },
  ]},
  cohere: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'command-r-plus' },
  ]},
  together: { fields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'mistralai/Mixtral-8x7B-Instruct-v0.1' },
  ]},
  ollama: { fields: [
    { key: 'baseUrl', label: 'Base URL', type: 'text', required: false, placeholder: 'http://localhost:11434', hint: 'Leave blank to use http://localhost:11434' },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'llama3' },
    { key: 'apiKey', label: 'API Key', type: 'password', required: false, hint: 'Optional — only needed for proxied Ollama setups.' },
  ]},
  local: { fields: [
    { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'http://localhost:1234/v1', hint: 'e.g. http://localhost:1234/v1 for LM Studio' },
    { key: 'modelName', label: 'Model', type: 'model', required: true, placeholder: 'llama3' },
    { key: 'apiKey', label: 'API Key', type: 'password', required: false, hint: 'Optional — leave blank for local-only servers.' },
  ]},
};

// Detect the model field key for a given provider config
function modelFieldKey(providerKey) {
  const fields = PROVIDER_CONFIG[providerKey]?.fields || [];
  return fields.find((f) => f.type === 'model')?.key || null;
}

// ── AI Model Add/Edit Modal ───────────────────────────────────────────────────

function AiModelModal({ model, onClose, onSave }) {
  const isNew = !model;
  const [form, setForm] = useState({
    name: model?.name ?? '',
    provider: model?.provider ?? '',
    credentials: {},
  });
  const [loadedCreds] = useState(model?.credentials ?? {});
  const [fetchedModels, setFetchedModels] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [manualModel, setManualModel] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const prevProvider = useRef(form.provider);
  useEffect(() => {
    if (prevProvider.current !== form.provider) {
      setFetchedModels(null); setFetchError(null); setManualModel(false); setTestResult(null);
      prevProvider.current = form.provider;
    }
  }, [form.provider]);

  const setCredential = (key, val) => {
    setForm((p) => ({ ...p, credentials: { ...p.credentials, [key]: val } }));
    setTestResult(null);
    if (key !== modelFieldKey(form.provider)) {
      setFetchedModels(null); setFetchError(null); setManualModel(false);
    }
  };

  const doFetchModels = async () => {
    if (!form.provider) return;
    setFetchLoading(true); setFetchError(null);
    try {
      const data = await apiPost('/me/ai-settings/models', { provider: form.provider, credentials: form.credentials });
      if (data.error) { setFetchError(data.error); setFetchedModels(null); }
      else { setFetchedModels(data.models || []); }
    } catch (e) { setFetchError(e?.message || 'Failed to fetch models'); }
    finally { setFetchLoading(false); }
  };

  const doTest = async () => {
    if (!form.provider) return;
    setTestLoading(true); setTestResult(null);
    try {
      const result = await apiPost('/me/ai-settings/test', { provider: form.provider, credentials: form.credentials });
      setTestResult(result);
    } catch (e) { setTestResult({ ok: false, message: e?.message || 'Connection test failed' }); }
    finally { setTestLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setSaveError('Please enter a model name.'); return; }
    if (!form.provider) { setSaveError('Please select a provider.'); return; }
    setSaving(true); setSaveError('');
    try {
      if (isNew) {
        const saved = await apiPost('/me/ai-models', {
          name: form.name.trim(), provider: form.provider, credentials: form.credentials,
        });
        onSave({ id: saved.id, name: saved.name, provider: saved.provider, credentials: {} }, true);
      } else {
        await apiPatch(`/me/ai-models/${model.id}`, {
          name: form.name.trim(), provider: form.provider, credentials: form.credentials,
        });
        onSave({ id: model.id, name: form.name.trim(), provider: form.provider, credentials: loadedCreds }, false);
      }
    } catch (e) { setSaveError(e?.message || 'Failed to save model.'); setSaving(false); }
  };

  const config = form.provider ? PROVIDER_CONFIG[form.provider] : null;

  const renderField = (field) => {
    if (field.dependsOn) {
      const dep = field.dependsOn;
      const val = form.credentials[dep.key] ?? loadedCreds[dep.key] ?? '';
      if (val !== dep.value) return null;
    }
    const val = form.credentials[field.key] ?? '';
    const ph = loadedCreds[field.key] || field.placeholder || '';

    if (field.type === 'radio') {
      const current = val || loadedCreds[field.key] || (field.options?.[0]?.value ?? '');
      return (
        <div key={field.key} className="mf">
          <label className="mf-label">{field.label}{field.required && <span className="req">*</span>}</label>
          <div className="radio-cards">
            {field.options.map((opt) => (
              <div key={opt.value} className={`radio-card${current === opt.value ? ' on' : ''}`} onClick={() => setCredential(field.key, opt.value)}>
                <span className="radio-dot" /><div className="rc-txt"><b>{opt.label}</b></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key} className="mf">
          <label className="mf-label">{field.label}{field.required && <span className="req">*</span>}</label>
          {field.hint && <p className="mf-hint">{field.hint}</p>}
          <textarea
            className="txn-field"
            style={{ width: '100%', minHeight: 110, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', height: 'auto', padding: '10px 12px' }}
            value={val} placeholder={ph}
            onChange={(e) => setCredential(field.key, e.target.value)}
          />
        </div>
      );
    }

    if (field.type === 'model') {
      const hasModels = fetchedModels && fetchedModels.length > 0;
      const showDropdown = hasModels && !manualModel;
      return (
        <div key={field.key} className="mf">
          <label className="mf-label">{field.label}{field.required && <span className="req">*</span>}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {showDropdown ? (
              <Select
                value={val || loadedCreds[field.key] || ''}
                onChange={(v) => setCredential(field.key, v)}
                options={fetchedModels.map((m) => ({ value: m.id, label: m.name }))}
                ariaLabel="Model"
              />
            ) : (
              <input
                className="txn-field"
                style={{ flex: 1, height: 42, color: 'var(--ink)' }}
                type="text" value={val} placeholder={ph}
                onChange={(e) => setCredential(field.key, e.target.value)}
              />
            )}
            <button className="btn-ghost" style={{ whiteSpace: 'nowrap', height: 42 }} onClick={doFetchModels} disabled={fetchLoading}>
              {fetchLoading ? 'Loading…' : hasModels ? 'Refresh' : 'Fetch models ↓'}
            </button>
          </div>
          {hasModels && (
            <button style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer' }} onClick={() => setManualModel(!manualModel)}>
              {manualModel ? '← Back to list' : 'Enter ID manually'}
            </button>
          )}
          {fetchError && <p style={{ color: '#c02626', margin: '4px 0 0', fontSize: 13 }}>{fetchError}</p>}
        </div>
      );
    }

    const isPassword = field.type === 'password';
    return (
      <div key={field.key} className="mf">
        <label className="mf-label">{field.label}{field.required && <span className="req">*</span>}</label>
        {field.hint && <p className="mf-hint">{field.hint}</p>}
        <div className={isPassword ? 'pass-wrap' : undefined}>
          <input
            className="txn-field"
            style={{ width: '100%', height: 42, color: 'var(--ink)' }}
            type={isPassword && !showPasswords[field.key] ? 'password' : 'text'}
            value={val} placeholder={ph}
            autoComplete={isPassword ? 'new-password' : 'off'}
            onChange={(e) => setCredential(field.key, e.target.value)}
          />
          {isPassword && (
            <button className="pass-eye" type="button" tabIndex={-1} onClick={() => setShowPasswords((p) => ({ ...p, [field.key]: !p[field.key] }))}>
              {showPasswords[field.key] ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="lib ai-modal" onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="lib-head">
          <div>
            <h3>{isNew ? 'Add AI Model' : 'Edit AI Model'}</h3>
            <p>Name this connection and enter your provider credentials.</p>
          </div>
          <button className="lib-x" onClick={onClose}><XIcon size={16} /></button>
        </div>

        {/* Scrollable body */}
        <div className="ai-modal-body">
          <div className="mf">
            <label className="mf-label">Display name <span className="req">*</span></label>
            <input
              className="txn-field"
              style={{ width: '100%', height: 42, color: 'var(--ink)' }}
              type="text" value={form.name} placeholder="e.g. My GPT-4, Work Claude…"
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="mf">
            <label className="mf-label">Provider <span className="req">*</span></label>
            <Select
              value={form.provider}
              onChange={(v) => {
                setForm((p) => ({ ...p, provider: v || '', credentials: {} }));
                setFetchedModels(null); setFetchError(null); setManualModel(false); setTestResult(null);
              }}
              options={[{ value: '', label: 'Select a provider…' }, ...AI_PROVIDERS]}
              ariaLabel="AI Provider"
            />
          </div>

          {/* Credentials card — only visible once a provider is chosen */}
          {config && (
            <div className="ai-cred-card">
              <div className="ai-cred-card-head">Credentials</div>
              <div className="ai-cred-card-body">
                {config.fields.map(renderField)}
              </div>
              <div className="ai-cred-card-foot">
                <button className="btn-ghost" onClick={doTest} disabled={testLoading}>
                  {testLoading ? 'Testing…' : 'Test connection'}
                </button>
                {testResult && (
                  <span className={testResult.ok ? 'ai-test-ok' : 'ai-test-err'}>
                    {testResult.ok ? '✓ Connected' : `✗ ${testResult.message}`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer — always visible outside the scroll area */}
        <div className="ai-modal-foot">
          {saveError && <p className="ai-modal-err">{saveError}</p>}
          <div className="ai-modal-foot-btns">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Add model' : 'Save changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── AI Panel (settings tab) ───────────────────────────────────────────────────

function AiPanel({ d, set, onAiLoad, aiLoaded }) {
  const [savedModels, setSavedModels] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);

  useEffect(() => {
    if (!aiLoaded) {
      apiGet('/me/ai-settings').then((data) => {
        onAiLoad({ enabled: data.enabled ?? false, activeModelId: data.activeModelId ?? null });
      }).catch(() => {});
    }
    apiGet('/me/ai-models').then((data) => setSavedModels(data.models || [])).catch(() => {});
  }, []);

  const deleteModel = async (id) => {
    if (!window.confirm('Delete this AI model? This cannot be undone.')) return;
    await apiDelete(`/me/ai-models/${id}`);
    setSavedModels((prev) => prev.filter((m) => m.id !== id));
    if (d.aiActiveModelId === id) set('aiActiveModelId', null);
  };

  const openAdd = () => { setEditingModel(null); setModalOpen(true); };
  const openEdit = (model) => { setEditingModel(model); setModalOpen(true); };

  const onModalSave = (model, isNew) => {
    setSavedModels((prev) => isNew ? [...prev, model] : prev.map((m) => m.id === model.id ? model : m));
    if (isNew && savedModels.length === 0) set('aiActiveModelId', model.id);
    setModalOpen(false);
  };

  return (
    <>
      <div className="set-group-t">AI Provider</div>
      <div className="set-group">
        <Row title="Enable AI" sub="Allow this app to make AI-powered requests on your behalf.">
          <Switch on={d.aiEnabled} onClick={() => set('aiEnabled', !d.aiEnabled)} />
        </Row>
      </div>

      {d.aiEnabled && (
        <>
          <div className="ai-models-header">
            <span className="set-group-t" style={{ margin: 0 }}>Saved Models</span>
            <button className="btn-ghost ai-add-btn" onClick={openAdd}>+ Add model</button>
          </div>

          {savedModels.length === 0 ? (
            <div className="set-group">
              <div className="ai-empty">
                <p>No AI models configured yet.</p>
              </div>
            </div>
          ) : (
            <div className="set-group" style={{ gap: 0 }}>
              {savedModels.map((model) => (
                <div
                  key={model.id}
                  className={`ai-model-card${d.aiActiveModelId === model.id ? ' active' : ''}`}
                  onClick={() => set('aiActiveModelId', model.id)}
                >
                  <div className="ai-model-left">
                    <div className={`ai-model-radio${d.aiActiveModelId === model.id ? ' on' : ''}`} />
                    <div className="ai-model-info">
                      <b>{model.name}</b>
                      <span>{AI_PROVIDERS.find((p) => p.value === model.provider)?.label || model.provider}</span>
                    </div>
                  </div>
                  <div className="ai-model-actions">
                    <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 14px', height: 34 }}
                      onClick={(e) => { e.stopPropagation(); openEdit(model); }}>Edit</button>
                    <button className="btn-ghost ai-del-btn" style={{ fontSize: 13, padding: '5px 14px', height: 34 }}
                      onClick={(e) => { e.stopPropagation(); deleteModel(model.id); }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {modalOpen && <AiModelModal model={editingModel} onClose={() => setModalOpen(false)} onSave={onModalSave} />}
    </>
  );
}

function DataPanel({ a }) {
  return (
    <>
      <div className="set-group-t">Your data</div>
      <div className="set-group">
        <Row title="Export transactions" sub="Download all your transactions as a CSV file."><button className="btn-ghost" onClick={a.exportCsv}><G d={GI.download} />Export CSV</button></Row>
      </div>
    </>
  );
}

function ChangePasswordModal({ onClose, onDone }) {
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (nw.length < 8) { setErr('New password must be at least 8 characters.'); return; }
    setBusy(true);
    try { await apiPost('/me/password', { currentPassword: cur, newPassword: nw }); onDone(); }
    catch (ex) { setErr(ex?.message || 'Could not change password.'); setBusy(false); }
  };
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="lib" style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="lib-head"><div><h3>Change password</h3><p>You'll be signed out after changing it.</p></div><button className="lib-x" onClick={onClose}>×</button></div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 2px 2px' }}>
          <input className="txn-field" type="password" placeholder="Current password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus />
          <input className="txn-field" type="password" placeholder="New password (min 8 characters)" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} />
          {err && <p style={{ color: '#dc2626', margin: 0, fontSize: 14 }}>{err}</p>}
          <button className="btn-primary" disabled={busy || !cur || !nw}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      </div>
    </div>
  );
}

export default function Settings() {
  const { logout } = useAuth();
  const [saved, setSaved] = useState(load());
  const [d, setD] = useState(saved);
  const [tab, setTab] = useState('prefs');
  const [justSaved, setJustSaved] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);

  const actions = {
    changePassword: () => setPwOpen(true),
    signOutAll: async () => {
      if (!window.confirm('Sign out of all devices? You will need to sign in again.')) return;
      try { await apiPost('/me/logout-all', {}); } catch { /* ignore */ }
      await logout();
    },
    deleteAccount: async () => {
      if (!window.confirm('Permanently delete your account and ALL your data? This cannot be undone.')) return;
      if (window.prompt('Type DELETE to confirm:') !== 'DELETE') return;
      try { await apiDelete('/me'); await logout(); }
      catch (e) { window.alert(e?.message || 'Could not delete account.'); }
    },
    exportCsv: () => {
      const txns = window.BAL.loadTxns();
      const accts = window.BAL.loadAccounts();
      const nameOf = (id) => (accts.find((x) => x.id === id) || {}).name || '';
      const head = ['Date', 'Type', 'Merchant', 'Category', 'Subcategory', 'Amount', 'Account', 'From', 'To'];
      const rows = [head, ...txns.map((t) => [t.date, t.type, t.merchant || '', t.category || '', t.subcategory || '', t.amount, nameOf(t.account), nameOf(t.fromAccount), nameOf(t.toAccount)])];
      const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `balance-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    },
  };

  const set = (k, v) => { setD((p) => ({ ...p, [k]: v })); setJustSaved(false); };
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const save = () => {
    window.BAL.saveSettings(d);
    window.BAL.saveAiSettings({ enabled: d.aiEnabled ?? false, activeModelId: d.aiActiveModelId ?? null });
    setSaved(d);
    setJustSaved(true);
  };
  const cancel = () => { setD(saved); setJustSaved(false); };

  // Called by AiPanel once the server's AI settings are loaded.
  // Merges into both d and saved so dirty stays false after load.
  const onAiLoad = ({ enabled, activeModelId }) => {
    setD((p) => ({ ...p, aiEnabled: enabled, aiActiveModelId: activeModelId }));
    setSaved((p) => ({ ...p, aiEnabled: enabled, aiActiveModelId: activeModelId }));
    setAiLoaded(true);
  };

  // Avatar: fetch the saved image (private → blob URL), and upload on change.
  const fileRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  useEffect(() => {
    if (!d.avatarUploadId) { setAvatarUrl(''); return; }
    let url; let alive = true;
    apiObjectUrl(`/uploads/${d.avatarUploadId}`).then((u) => { if (alive) { url = u; setAvatarUrl(u); } }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [d.avatarUploadId]);
  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const { id } = await apiUpload('/uploads', file); set('avatarUploadId', id); }
    catch (err) { window.alert(err?.message || 'Upload failed'); }
    e.target.value = '';
  };

  const cur = TABS.find((t) => t.id === tab);
  const Panel = { profile: ProfilePanel, prefs: PrefsPanel, security: SecurityPanel, data: DataPanel }[tab];

  return (
    <div>
      <div className="txn-head" style={{ marginBottom: 18 }}>
        <div><h2>Settings</h2><p>Manage your profile, preferences and app behaviour</p></div>
      </div>
      <div className="settings">
        <div className="set-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`set-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
              <span className="ti"><G d={t.icon} /></span>{t.label}
            </button>
          ))}
        </div>
        <div className="set-panel">
          <div><div className="set-h2">{cur.label}</div><div className="set-h2-d">{
            { profile: 'Your personal details and how we reach you.', prefs: 'Currency, budgeting logic and privacy controls.', security: 'Keep your account safe and private.', data: 'Connections, backups and exports.', ai: 'Connect an AI provider to enable AI-powered features.' }[tab]
          }</div></div>
          {tab === 'ai'
            ? <AiPanel d={d} set={set} onAiLoad={onAiLoad} aiLoaded={aiLoaded} />
            : <Panel d={d} set={set} a={actions} avatarUrl={avatarUrl} fileRef={fileRef} onPickPhoto={onPickPhoto} />}
          <div className="set-foot">
            {justSaved && <span className="saved-note"><G d={GI.check} />All changes saved</span>}
            <button className="btn-ghost" onClick={cancel} disabled={!dirty} style={dirty ? null : { opacity: 0.5, cursor: 'default' }}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!dirty} style={dirty ? null : { opacity: 0.5, cursor: 'default' }}>Save changes</button>
          </div>
        </div>
      </div>
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} onDone={async () => { setPwOpen(false); window.alert('Password changed. Please sign in again.'); await logout(); }} />}
    </div>
  );
}
