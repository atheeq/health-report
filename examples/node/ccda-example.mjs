import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

// Lazy import built ESM entry
const { renderHtml } = await import(resolve(root, 'dist/esm/index.js'));

const [xmlPathArg] = process.argv.slice(2);
const xmlPath = xmlPathArg || resolve(root, 'tests/fixtures/CCD.xml');

const xml = await readFile(xmlPath, 'utf8');
const html = await renderHtml(xml, { hiddenSections: ['other', 'financial', 'privacy'] });

const outDir = resolve(here);
await mkdir(outDir, { recursive: true });
const outFile = resolve(outDir, 'ccda-report.html');
await writeFile(outFile, html, 'utf8');
console.log('✅ CCDA HTML written to', outFile);
