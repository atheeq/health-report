import { AIClient, type AIClientConfig } from '../ai/client';
import { buildSystemPrompt, buildUserPromptFromFhir } from '../ai/prompt';

export interface RenderHtmlLlmOptions {
  llm?: AIClientConfig & {
    enabled?: boolean;
    chunk?: {
      // Approximate target maximum characters per chunk of input JSON
      maxChunkChars?: number;
      // Ask the model to include extra raw fields from each resource in findings
      includeRaw?: 'none' | 'minimal' | 'full';
      // When provided (Node only), write partial findings/merged results here for debugging
      debugDir?: string;
    };
  };
}

function wrapHtml(title: string, body: string): string {
  const css = `:root{--hx-font:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;--hx-accent:#2563eb;--hx-muted:#6b7280}body{font-family:var(--hx-font);color:#111;line-height:1.6;margin:16px;max-width:900px}h1{font-size:1.7rem;color:var(--hx-accent);margin:0 0 8px}.subtle{color:var(--hx-muted);font-size:.9rem;margin-bottom:10px}section{margin:18px 0;padding:12px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}section h2{font-size:1.1rem;border-bottom:1px solid #eee;padding-bottom:6px;margin:0 0 10px}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body><header><h1>${escapeHtml(title)}</h1><div class="subtle">AI-generated from provided clinical data</div></header>${body}</body></html>`;
}

function escapeHtml(s: string){ return s.replace(/[&<>]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[c]); }

export async function renderHtmlLlm(input: object | string, opts: RenderHtmlLlmOptions = {}): Promise<string> {
  if (!opts.llm?.enabled) throw new Error('LLM rendering is disabled. Provide opts.llm.enabled = true and API key.');
  const fhir = await ensureFhirInput(input);
  const title = findPatientName(fhir) ? `${findPatientName(fhir)} — Health Summary` : 'Patient Health Summary';

  const client = new AIClient(opts.llm);
  const fhirStr = JSON.stringify(fhir);
  const maxChunkChars = opts.llm?.chunk?.maxChunkChars ?? 250_000; // conservative char-based threshold

  if (fhirStr.length <= maxChunkChars) {
    // Single-shot prompt
    const system = buildSystemPrompt();
    const user = buildUserPromptFromFhir(fhir);
    const content = await client.chat([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], opts.llm);
    return wrapHtml(title, content);
  }

  // Map-reduce chunking: summarize chunks to JSON findings, then synthesize final HTML
  const chunks = chunkFhir(fhir, maxChunkChars);
  const partialFindings: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const system = findingsSystemPrompt();
    const user = findingsUserPrompt(chunk, opts.llm?.chunk?.includeRaw ?? 'none');
    const resp = await client.chat([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], { ...opts.llm, temperature: 0.2, maxTokens: 2000 });
    // Attempt to parse JSON; if parsing fails, fall back to empty object for that chunk
    try {
      const jsonStart = resp.indexOf('{');
      const jsonEnd = resp.lastIndexOf('}');
      const parsed = JSON.parse(resp.slice(jsonStart, jsonEnd + 1));
      partialFindings.push(parsed);
      await writeDebugFile(opts.llm?.chunk?.debugDir, `chunk-${i + 1}.json`, parsed);
    } catch {
      partialFindings.push({});
    }
  }

  const merged = mergeFindings(partialFindings);
  await writeDebugFile(opts.llm?.chunk?.debugDir, `merged.json`, merged);
  const finalSystem = buildSystemPrompt();
  const finalUser = finalSynthesisPrompt(merged);
  const finalHtmlSections = await client.chat([
    { role: 'system', content: finalSystem },
    { role: 'user', content: finalUser },
  ], opts.llm);
  return wrapHtml(title, finalHtmlSections);
}

async function ensureFhirInput(input: object | string): Promise<any> {
  if (typeof input === 'string') {
    // Expect JSON string for FHIR; do not convert CCDA here.
    try {
      const obj = JSON.parse(input);
      return obj;
    } catch {
      throw new Error('LLM route expects FHIR JSON input. Pass a FHIR Bundle or FHIR resources.');
    }
  }
  // Object/Array accepted as-is to avoid transformation.
  return input;
}

function findPatientName(fhir: any): string | undefined {
  try {
    if (!fhir) return undefined;
    if (fhir.resourceType === 'Bundle') {
      const entries = Array.isArray(fhir.entry) ? fhir.entry : [];
      const p = entries.map((e:any)=> e?.resource).find((r:any)=> r?.resourceType==='Patient');
      return humanName(p);
    }
    if (Array.isArray(fhir)) {
      const p = fhir.find((r:any)=> r?.resourceType==='Patient');
      return humanName(p);
    }
    // Per-type object: { Patient:[...], Observation:[...], ... }
    if (fhir.Patient && Array.isArray(fhir.Patient)) {
      return humanName(fhir.Patient[0]);
    }
  } catch {}
  return undefined;
}

function humanName(patient: any): string | undefined {
  if (!patient) return undefined;
  const n = patient.name?.[0];
  const text = n?.text ?? [Array.isArray(n?.given) ? n.given.join(' ') : n?.given, n?.family].filter(Boolean).join(' ');
  return text || patient.id;
}

function flattenResources(fhir: any): any[] {
  if (!fhir) return [];
  if (Array.isArray(fhir)) return fhir;
  if (fhir.resourceType === 'Bundle') return (Array.isArray(fhir.entry) ? fhir.entry : []).map((e:any)=> e?.resource).filter(Boolean);
  // Per-type object
  const out: any[] = [];
  for (const v of Object.values(fhir)) if (Array.isArray(v)) out.push(...v);
  return out;
}

function chunkFhir(fhir: any, maxChars: number): any[] {
  const resources = flattenResources(fhir);
  if (resources.length === 0) return [fhir];
  const chunks: any[][] = [];
  let current: any[] = [];
  let size = 2; // for brackets
  for (const r of resources) {
    const s = JSON.stringify(r);
    const add = s.length + (current.length ? 1 : 0); // comma
    if (size + add > maxChars && current.length > 0) {
      chunks.push(current);
      current = [];
      size = 2;
    }
    current.push(r);
    size += add;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function findingsSystemPrompt(): string {
  return [
    'You are a clinical data summarizer.',
    'Input: a JSON array of FHIR resources (raw).',
    'Output: a JSON object covering EVERY resource in the input, grouped by resourceType.',
    'No prose, no explanations. Output VALID JSON only.',
  ].join(' ');
}

function findingsUserPrompt(chunkResources: any[], includeRaw: 'none' | 'minimal' | 'full'): string {
  const json = JSON.stringify(chunkResources);
  return `
FHIR chunk (JSON array):\n${json}\n\n
Task: Emit a JSON object that includes EVERY resource from the input, grouped by resourceType. The top-level must be:
{
  "patient": { "id?": string, "name?": string, "birthDate?": string, "gender?": string },
  "byType": {
    "<ResourceType>": Array<EssentialResource>,
    ... // include ALL resource types present in input
  }
}

EssentialResource guidelines (preserve facts only, no interpretation):
- Always include: "id", "resourceType".
- Include status fields if present (status, clinicalStatus, verificationStatus).
- Include key codes/text: "code", "type", "category", with first coding (system, code, display) and any text.
- Include timing: "effectiveDateTime", "issued", "authoredOn", "performedDateTime", "occurrenceDateTime", "period" (start/end) where applicable.
- Include subject/patient/encounter references as IDs or displays if present.
- For Observation, include value (valueQuantity/valueString/valueCodeableConcept), unit, referenceRange if present.
- For DocumentReference/DiagnosticReport, include title/code/date and references.
- For resources not listed above, include their key identifiers and text fields.
- Do not omit any resource type. If unfamiliar, include a compact subset of its fields that convey meaning.

 Raw inclusion mode: ${includeRaw}
 - none: Do not include any raw.
 - minimal: Include important identifiers under an "identifiers" array and top-level "text" if present.
 - full: Add a compact "raw" object with the most important top-level fields from the resource to aid final synthesis (avoid extremely large blobs).

Constraints:
- Use ONLY facts present in the input.
- DO NOT output prose; return JSON object ONLY.`;
}

function mergeFindings(arr: any[]): any {
  const out: any = { patient: {}, byType: {} };
  for (const f of arr) {
    if (!f || typeof f !== 'object') continue;
    out.patient.id ||= f.patient?.id;
    out.patient.name ||= f.patient?.name;
    out.patient.birthDate ||= f.patient?.birthDate;
    out.patient.gender ||= f.patient?.gender;
    const byType = f.byType && typeof f.byType === 'object' ? f.byType : {};
    for (const [rt, list] of Object.entries(byType)) {
      if (!Array.isArray(list)) continue;
      (out.byType[rt] ??= []).push(...list);
    }
  }
  // De-dup per resourceType via smarter keys when possible
  for (const [rt, list] of Object.entries(out.byType)) {
    const seen = new Set<string>();
    out.byType[rt] = (list as any[]).filter((x:any)=> {
      const key = resourceKey(rt as string, x);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  return out;
}

function resourceKey(rt: string, x: any): string {
  if (x?.id) return `${rt}:id:${x.id}`;
  const idf = x?.identifier;
  if (idf) {
    const pick = Array.isArray(idf) ? idf[0] : idf;
    const sys = pick?.system || pick?.assigner || '';
    const val = pick?.value || pick?.identifier || pick?.id || '';
    if (val) return `${rt}:ident:${sys}|${val}`;
  }
  const coding = x?.code?.coding?.[0] || x?.type?.coding?.[0] || x?.category?.[0]?.coding?.[0];
  const sys = coding?.system || '';
  const code = coding?.code || '';
  const date = x?.effectiveDateTime || x?.issued || x?.authoredOn || x?.performedDateTime || x?.occurrenceDateTime || x?.date;
  if (code) return `${rt}:code:${sys}|${code}@${date||''}`;
  const json = JSON.stringify(x);
  return `${rt}:json:${json.slice(0, 200)}`;
}

async function writeDebugFile(dir: string | undefined, filename: string, data: any): Promise<void> {
  if (!dir) return;
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    await fs.mkdir(dir, { recursive: true });
    const full = (path as any).resolve(dir, filename);
    await fs.writeFile(full, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

function finalSynthesisPrompt(merged: any): string {
  const json = JSON.stringify(merged);
  return `
Combined Findings (JSON):\n${json}\n\n
Task: Using ONLY these findings (which include ALL resource types grouped under "byType"), write a patient-friendly, strictly factual health report.
Use any relevant resource types present (e.g., Condition, Observation, MedicationRequest/MedicationStatement, Immunization, Procedure, Encounter, DocumentReference, DiagnosticReport, CarePlan, Goal, Device, ImagingStudy, ServiceRequest, Appointment, Coverage, Organization/Practitioner/Role, Location, RelatedPerson, RiskAssessment, ClinicalImpression, Flag, Consent, Communication/Request, CareTeam, Task, etc.).
Follow the same HTML section structure and constraints as before.
Return valid HTML sections only (no <html>, <head>, <body>).`;
}
