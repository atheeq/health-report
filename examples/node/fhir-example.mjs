import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

// Import built ESM entry (run `npm run build` first)
const { renderHtml } = await import(resolve(root, 'dist/esm/index.js'));

const [bundlePathArg] = process.argv.slice(2);
const bundlePath = bundlePathArg || resolve(root, 'tests/fixtures/fhir-bundle.json');

const json = await readFile(bundlePath, 'utf8');
const bundle = JSON.parse(json);
const html = await renderHtml(bundle, { hiddenSections: [] });

const outDir = resolve(here);
await mkdir(outDir, { recursive: true });
const outFile = resolve(outDir, 'fhir-report.html');
await writeFile(outFile, html, 'utf8');
console.log('✅ FHIR HTML written to', outFile);

