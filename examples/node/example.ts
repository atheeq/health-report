import { renderPdf } from '@healthex/health-report';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

const bundle = JSON.parse(readFileSync(resolve(root, 'tests/fixtures/fhir-bundle.json'), 'utf8'));
const pdf = await renderPdf(bundle, { /* themeCss, charts: svgChartProvider */ });
writeFileSync('patient.pdf', pdf);
