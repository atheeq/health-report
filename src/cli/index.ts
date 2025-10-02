#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { renderPdf, renderHtml, renderHtmlLlm, toIR, fhirToBlueButtonData, blueButtonDataToIR } from '../index';

const ALL_SECTIONS = [
  'encounters','appointments','conditions','medications','medicationEvents','allergies','immunizations','procedures','devices','serviceRequests','imaging','vitals','labs','carePlans','goals','familyHistory','socialHistory','coverage','financial','documents','reports','questionnaires','nutrition','clinicalNotes','privacy','careTeam','locations','relatedPersons','riskAssessments','ccdaSections','other'
];

function hiddenForPreset(preset?: string): string[] | undefined {
  if (!preset) return undefined;
  const keepCore = new Set(['encounters','appointments','conditions','medications','allergies','immunizations','procedures','vitals','labs','carePlans','goals','familyHistory','documents','reports']);
  const keepIps = new Set([...keepCore, 'imaging']);
  const keep = preset === 'ips' ? keepIps : keepCore;
  return ALL_SECTIONS.filter(s => !keep.has(s));
}

function help() {
  console.error(`Usage:
  health-report pdf <input.(json|xml)> [output.pdf]
  health-report html <input.(json|xml)> [output.html]
  health-report normalize <fhir-bundle.json> [output.json|-]
  health-report to-ir <input.(json|xml)> [output.json|-]
  health-report html-llm <input.json> [output.html] [--llm-model=MODEL] [--llm-api-key=KEY] [--llm-base-url=URL] [--llm-temp=N] [--llm-max-tokens=N]
`);
}

const args = process.argv.slice(2);
if (!args.length) { help(); process.exit(1); }

const cmd = ['pdf','html','normalize','to-ir','html-llm'].includes(args[0]) ? args.shift()! : 'pdf';
let preset: string | undefined = undefined;
let include: string[] = [];
let exclude: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (typeof a === 'string' && a.startsWith('--preset=')) {
    preset = a.split('=')[1] || undefined;
    args.splice(i,1); i--; // remove flag from args
    continue;
  }
  if (typeof a === 'string' && a.startsWith('--include=')) {
    include = a.split('=')[1]?.split(',').map(s=>s.trim()).filter(Boolean) || [];
    args.splice(i,1); i--;
    continue;
  }
  if (typeof a === 'string' && a.startsWith('--exclude=')) {
    exclude = a.split('=')[1]?.split(',').map(s=>s.trim()).filter(Boolean) || [];
    args.splice(i,1); i--;
    continue;
  }
}
// LLM flags
let llmModel: string | undefined;
let llmApiKey: string | undefined;
let llmBaseUrl: string | undefined;
let llmTemp: number | undefined;
let llmMaxTokens: number | undefined;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (typeof a === 'string' && a.startsWith('--llm-model=')) { llmModel = a.split('=')[1]; args.splice(i,1); i--; continue; }
  if (typeof a === 'string' && a.startsWith('--llm-api-key=')) { llmApiKey = a.split('=')[1]; args.splice(i,1); i--; continue; }
  if (typeof a === 'string' && a.startsWith('--llm-base-url=')) { llmBaseUrl = a.split('=')[1]; args.splice(i,1); i--; continue; }
  if (typeof a === 'string' && a.startsWith('--llm-temp=')) { const n = Number(a.split('=')[1]); if (!Number.isNaN(n)) llmTemp = n; args.splice(i,1); i--; continue; }
  if (typeof a === 'string' && a.startsWith('--llm-max-tokens=')) { const n = Number(a.split('=')[1]); if (!Number.isNaN(n)) llmMaxTokens = n; args.splice(i,1); i--; continue; }
}
const inputPath = args[0];
const outPath = args[1];
if (!inputPath) { help(); process.exit(1); }

function readNdjson(file: string): any[] {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const out: any[] = [];
  for (const ln of lines) {
    try { const obj = JSON.parse(ln); if (obj && obj.resourceType) out.push(obj); } catch {}
  }
  return out;
}

function collectResourcesFromDir(dir: string): any[] {
  const files = readdirSync(dir, { withFileTypes: true });
  const resources: any[] = [];
  for (const e of files) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      resources.push(...collectResourcesFromDir(full));
      continue;
    }
    const ext = extname(e.name).toLowerCase();
    if (ext === '.json' || ext === '.ndjson') {
      const raw = readFileSync(full, 'utf8');
      try {
        if (ext === '.ndjson') {
          resources.push(...readNdjson(full));
        } else {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const r of parsed) if (r && r.resourceType) resources.push(r);
          } else if (parsed?.resourceType === 'Bundle') {
            for (const e of parsed.entry || []) if (e?.resource?.resourceType) resources.push(e.resource);
          } else if (parsed?.resourceType) {
            resources.push(parsed);
          }
        }
      } catch {}
    }
  }
  return resources;
}

let input: any = null;
let isJson = inputPath.endsWith('.json');
try {
  const st = statSync(inputPath);
  if (st.isDirectory()) {
    const resources = collectResourcesFromDir(inputPath);
    input = resources; // toIR supports arrays of resources
    isJson = true;
  } else {
    // File
    if (inputPath.endsWith('.ndjson')) {
      input = readNdjson(inputPath);
      isJson = true;
    } else if (isJson) {
      const raw = readFileSync(inputPath, 'utf8');
      input = JSON.parse(raw);
    } else {
      input = readFileSync(inputPath, 'utf8');
    }
  }
} catch (e) {
  console.error('Failed to read input:', (e as any)?.message || e);
  process.exit(2);
}

function computeHidden(): string[] | undefined {
  let hidden = new Set<string>(hiddenForPreset(preset) ?? []);
  // Ensure only valid names are processed
  const valid = new Set(ALL_SECTIONS);
  for (const name of include) if (valid.has(name)) hidden.delete(name);
  for (const name of exclude) if (valid.has(name)) hidden.add(name);
  return Array.from(hidden);
}

if (cmd === 'pdf') {
  const pdf = await renderPdf(input, { hiddenSections: computeHidden() });
  const out = outPath || 'report.pdf';
  writeFileSync(out, pdf);
  console.log('✅ PDF written to', out);
  process.exit(0);
}

if (cmd === 'html') {
  const html = await renderHtml(input, { hiddenSections: computeHidden() });
  const out = outPath || 'report.html';
  writeFileSync(out, html, 'utf8');
  console.log('✅ HTML written to', out);
  process.exit(0);
}

if (cmd === 'html-llm') {
  try {
    const html = await renderHtmlLlm(input, { llm: {
      enabled: true,
      apiKey: llmApiKey,
      baseUrl: llmBaseUrl,
      model: llmModel,
      temperature: llmTemp,
      maxTokens: llmMaxTokens,
    } });
    const out = outPath || 'report-llm.html';
    writeFileSync(out, html, 'utf8');
    console.log('✅ LLM HTML written to', out);
  } catch (e) {
    console.error('LLM rendering failed:', (e as any)?.message || e);
    process.exit(2);
  }
  process.exit(0);
}

if (cmd === 'normalize') {
  if (!isJson) {
    console.error('normalize expects a FHIR JSON input');
    process.exit(2);
  }
  let bundle = input;
  if (Array.isArray(input)) {
    // Wrap resources into a collection Bundle
    bundle = { resourceType: 'Bundle', type: 'collection', entry: input.map((r:any)=>({ resource: r })) };
  }
  if (bundle?.resourceType !== 'Bundle') {
    console.error('normalize expects a FHIR Bundle JSON input or an array of FHIR resources');
    process.exit(2);
  }
  const bb = fhirToBlueButtonData(bundle);
  const json = JSON.stringify(bb, null, 2);
  if (!outPath || outPath === '-') process.stdout.write(json + '\n');
  else writeFileSync(outPath, json, 'utf8');
  process.exit(0);
}

if (cmd === 'to-ir') {
  let ir;
  if (isJson && input?.resourceType === 'Bundle') {
    const bb = fhirToBlueButtonData(input);
    ir = blueButtonDataToIR(bb);
  } else {
    ir = await toIR(input);
  }
  const json = JSON.stringify(ir, null, 2);
  if (!outPath || outPath === '-') process.stdout.write(json + '\n');
  else writeFileSync(outPath, json, 'utf8');
  process.exit(0);
}

help();
process.exit(1);
