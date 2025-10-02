import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

// Import built ESM entries (run `npm run build` first)
const { renderHtml } = await import(resolve(root, 'dist/esm/index.js'));
const { loadFhirFromPath } = await import(resolve(root, 'dist/esm/node/io.js'));

import { access } from 'node:fs/promises';
const testsDir = resolve(root, 'tests/fixtures/fhir_resources');
let srcDir = resolve(root, 'examples/resources-dir');
try { await access(testsDir); srcDir = testsDir; } catch {}
const resources = await loadFhirFromPath(srcDir);
const html = await renderHtml(resources);

const outFile = resolve(here, 'from-dir.html');
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, html, 'utf8');
console.log('✅ Directory HTML written to', outFile);
