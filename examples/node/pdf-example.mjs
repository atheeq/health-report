import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

// Import built ESM entry (run `npm run build` first)
const { renderPdf } = await import(resolve(root, 'dist/esm/index.js'));

const [inputPathArg, outPathArg] = process.argv.slice(2);
const inputPath = inputPathArg || resolve(root, 'tests/fixtures/fhir-bundle.json');
const outDir = resolve(here);
await mkdir(outDir, { recursive: true });
const outPath = outPathArg || resolve(outDir, 'report.pdf');

try {
  // Ensure puppeteer is available (peer dep)
  await import('puppeteer');
} catch (e) {
  console.error('Missing peer dependency: puppeteer');
  console.error('Install it with: npm i puppeteer');
  process.exit(1);
}

let input;
if (inputPath.endsWith('.json')) {
  input = JSON.parse(await readFile(inputPath, 'utf8'));
} else {
  // Treat as CCDA XML string
  input = await readFile(inputPath, 'utf8');
}

const pdf = await renderPdf(input, {
  themeCss: undefined,
  pdf: { format: 'A4', margin: '12mm' }
});

await writeFile(outPath, pdf);
await access(outPath, fsConstants.F_OK);
console.log('✅ PDF written to', outPath);

