import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

// Import built ESM entries (run `npm run build` first)
const { renderPdf } = await import(resolve(root, 'dist/esm/index.js'));
const { loadFhirFromPath } = await import(resolve(root, 'dist/esm/node/io.js'));

import { access } from 'node:fs/promises';
const [dirPathArg, outPathArg] = process.argv.slice(2);
const testsDir = resolve(root, 'tests/fixtures/fhir_resources');
let srcPath = dirPathArg || resolve(root, 'examples/resources-dir');
try { await access(testsDir); srcPath = dirPathArg || testsDir; } catch {}
const outDir = resolve(here);
await mkdir(outDir, { recursive: true });
const outPath = outPathArg || resolve(outDir, 'from-dir.pdf');

try { await import('puppeteer'); }
catch { console.error('Missing peer dependency: puppeteer'); console.error('Install with: npm i puppeteer'); process.exit(1); }

const resources = await loadFhirFromPath(srcPath);
const pdf = await renderPdf(resources, { pdf: { format: 'A4', margin: '12mm' } });
await writeFile(outPath, pdf);
console.log('✅ Directory PDF written to', outPath);
