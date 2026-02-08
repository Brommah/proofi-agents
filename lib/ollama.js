/**
 * Proofi Ollama Client
 * Local LLM inference — data never leaves your machine
 */

const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

export async function chat(messages, { model = DEFAULT_MODEL, temperature = 0.3, stream = false, json = false } = {}) {
  const body = { model, messages, stream, options: { temperature, num_predict: 2048 } };
  if (json) body.format = 'json';
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.message.content;
}

export async function generate(prompt, { model = DEFAULT_MODEL, temperature = 0.3, system = '' } = {}) {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, system, stream: false, options: { temperature } })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.response;
}

export async function isAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data.models?.length > 0;
  } catch {
    return false;
  }
}

export async function listModels() {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`);
  const data = await res.json();
  return data.models?.map(m => m.name) || [];
}
