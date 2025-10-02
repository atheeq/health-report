@healthex/health-report
=======================

Patient‑friendly reports from FHIR/C‑CDA — HTML & PDF.

Generate patient‑friendly HTML and PDF reports from HL7 FHIR Bundles and C‑CDA XML. Also provides helpers to normalize FHIR to BlueButton‑like JSON and convert it into the report’s intermediate model (IR).

Why this library
----------------
- Focused: optimized for clinical summaries and visit reports.
- Flexible: render from FHIR or CCDA, and customize sections easily.
- Portable: works in Node (HTML/PDF) and the browser (HTML/print).
- Practical: preserves unknown resources and surfaces counts so nothing is lost.

Use Cases
---------
- Discharge summaries and after‑visit summaries for patients.
- Patient portal exports (download as HTML/PDF).
- Payer member health summaries and care management packets.
- Care coordination packets across organizations.
- Research or clinical trial participant summaries.

Install
-------
- Library: `npm i @healthex/health-report`
- Optional peers (install only if needed):
  - CCDA parsing: `npm i bluebutton`
  - PDF (Node): `npm i puppeteer`

Usage (Library)
---------------
```
import { renderHtml, renderPdf, toIR, bundleFromResources } from '@healthex/health-report';
// Optional (Node): load resources from a directory or file
// import { loadFhirFromPath, collectFhirResourcesFromDir } from '@healthex/health-report/node-io';

// HTML from FHIR Bundle
const html = await renderHtml(bundle, {
  themeCss: '/* custom CSS */',
  hiddenSections: ['privacy'],
});

// HTML from CCDA XML (when `bluebutton` is installed)
const html2 = await renderHtml(ccdaXml);

// PDF in Node (when `puppeteer` is installed)
const pdf = await renderPdf(bundle, {
  pdf: { format: 'A4', margin: '12mm' },
});

// IR from any input
// Also supports: an array of FHIR resources, or an object of per‑type arrays
// e.g. [{resourceType:'Patient',...}, {resourceType:'Observation',...}] or { Patient:[...], Observation:[...] }
const ir = await toIR(bundleOrCcdaOrArray);

// Helper: explicitly wrap resources into a Bundle
const bundle = bundleFromResources([
  { resourceType: 'Patient', id: 'p1', name: [{ text: 'Jane' }] },
  { resourceType: 'Observation', code: { text: 'Heart rate' }, valueQuantity: { value: 72, unit: 'bpm' } },
]);
const htmlFromBundle = await renderHtml(bundle);

// Node helper: load from a directory of FHIR JSON/NDJSON
// const resources = await loadFhirFromPath('./path/to/dir');
// const htmlFromDir = await renderHtml(resources);
```

CLI
---
- HTML: `npx health-report html ./input.(json|xml) ./out.html`
- PDF: `npx health-report pdf ./input.(json|xml) ./out.pdf`
  - Input may be: a FHIR Bundle JSON, CCDA XML, a directory of `*.json`/`*.ndjson` files, an NDJSON file, or a JSON array of FHIR resources.
- Presets: `--preset=core` or `--preset=ips`
- Overrides: `--include=appointments,financial`, `--exclude=privacy`
- Normalize FHIR → BlueButton JSON: `npx health-report normalize ./bundle.json > normalized.json`
- IR from input: `npx health-report to-ir ./input.(json|xml|dir) > ir.json`

Examples
--------
- Note: Examples default to sample data under `tests/fixtures` (e.g., `fhir-bundle.json`, `CCD.xml`, and the `fhir_resources/` directory). You can pass your own paths to override.
- FHIR → HTML: `npm run example:fhir` → `examples/node/fhir-report.html`
- CCDA → HTML: `npm i bluebutton && npm run example:ccda` → `examples/node/ccda-report.html`
- PDF (Node): `npm i puppeteer && npm run example:pdf` → `examples/node/report.pdf`
- Browser demo: `npm run build`, then serve and open `examples/browser/index.html`

Directory Example (per-resource JSON)
-------------------------------------
- Example directory: `examples/resources-dir/` contains `patient.json`, `observation.json`, `condition.json`.
- The scripts will prefer `tests/fixtures/fhir_resources` if present; pass a directory path to override.
- CLI:
  - `npx health-report html ./examples/resources-dir ./examples/node/from-dir-cli.html`
- Node script:
  - `npm run build`
  - `node examples/node/dir-example.mjs`
  - Writes `examples/node/from-dir.html`
 - PDF (Node):
   - `npm i puppeteer`
   - `npm run build`
   - `node examples/node/pdf-from-dir.mjs` (or pass another dir/output)
   - Writes `examples/node/from-dir.pdf`

API
---
- `renderHtml(input, options)`
  - input: FHIR Bundle object or CCDA XML string
  - options:
    - `themeCss`: string (override default styles)
    - `hiddenSections`: string[] (hide specific sections)
    - `charts`: `{ line(series) => string }` (inline SVG provider)
    - `tooltips`: `(ctx) => string | Promise<string>`
- `renderPdf(input, options)` (Node)
  - same as `renderHtml`, plus `pdf?: { format?: 'A4'|'Letter'; margin?: string; headerTemplate?: string; footerTemplate?: string }`
- `renderPdfBrowser(input, options)` (Browser)
  - Opens a print helper and calls `print()`
- `toIR(input)`
  - Parses FHIR/CCDA into the report’s intermediate model
- `fhirToBlueButtonData(bundle)` → `blueButtonDataToIR(data)`
  - Normalize FHIR to BlueButton‑like JSON and convert to IR

Sections
--------
Patient header, Encounters, Appointments, Conditions, Medications, Medication Events, Allergies, Immunizations, Procedures, Devices, Service Requests, Imaging, Vitals, Labs, Care Plans, Goals, Family History, Social History, Coverage, Financial, Documents, Reports, Questionnaires, Clinical Notes & Flags, Privacy & Activity, Care Team, Locations, Related Persons, Risk Assessments, CCDA Sections Present, Resources Present, Footer.

Development
-----------
- Build: `npm run build` (emits `dist/esm` and `dist/types`)
- Test: `npm test`
- Lint/Format: `npm run lint`, `npm run format`

License
-------
MIT
