// Run with: node examples/llm.example.js [path/to/fhir-bundle.json]
// Requires: npm run build (to produce dist/esm), Node 20.19+
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// Lazy import built ESM entry
const { renderHtmlLlm } = await import(resolve(root, 'dist/esm/index.js'));

const [inputPathArg] = process.argv.slice(2);
const inputPath = inputPathArg || resolve(root, 'tests/fixtures/fhir-bundle.json');

const raw = await readFile(inputPath, 'utf8');
const input = JSON.parse(raw);

const html = await renderHtmlLlm(input, {
  llm: {
    enabled: true,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.LLM_MODEL || 'gpt-4o',
    temperature: Number(process.env.LLM_TEMP ?? '0.6'),
    maxTokens: Number(process.env.LLM_MAX_TOKENS ?? '4000'),
    chunk: { maxChunkChars: Number(process.env.LLM_MAX_CHARS ?? '250000') },
  },
});

const outFile = resolve(here, 'llm-report.html');
await (await import('node:fs/promises')).writeFile(outFile, html, 'utf8');
console.log('✅ LLM HTML written to', outFile);

