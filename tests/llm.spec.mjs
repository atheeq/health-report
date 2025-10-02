// LLM smoke test without network: mock fetch for OpenAI chat API
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dist = await import('../dist/esm/index.js');
const { renderHtmlLlm } = dist;

// Mock global fetch to emulate OpenAI Chat Completions
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init?.body ?? '{}');
  const msgs = body?.messages ?? [];
  const user = msgs.find((m) => m.role === 'user')?.content ?? '';
  // Extract FHIR JSON from the user content
  let patientName = 'Patient';
  try {
    const start = user.indexOf('{');
    const end = user.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const fhir = JSON.parse(user.slice(start, end + 1));
      if (fhir?.resourceType === 'Bundle') {
        const p = (fhir.entry||[]).map(e=>e?.resource).find(r=>r?.resourceType==='Patient');
        const n = p?.name?.[0];
        patientName = n?.text || [Array.isArray(n?.given)?n.given.join(' '):n?.given, n?.family].filter(Boolean).join(' ') || patientName;
      }
    }
  } catch {}
  const html = `<section id="overview"><h2>Overview</h2><p>${patientName}</p></section>`;
  return {
    ok: true,
    status: 200,
    async json() {
      return { choices: [{ message: { content: html } }] };
    },
  };
};

// Use sample FHIR bundle fixture
const bundle = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/fhir-bundle.json'), 'utf8'));
const html = await renderHtmlLlm(bundle, { llm: { enabled: true, apiKey: 'test-key', model: 'gpt-mock' } });
assert.ok(html.includes('AI-generated'));
assert.ok(html.includes('Jane Doe'));
assert.ok(html.includes('<section id="overview">'));
console.log('✅ LLM mock smoke test passed');
