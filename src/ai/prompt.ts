import type { IR } from '../core/model';

function truncate(str: string | undefined, max = 400): string | undefined {
  if (!str) return str;
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

function safeDate(d?: string) { try { return d ? new Date(d).toISOString() : undefined; } catch { return d; } }

export function buildReportContext(ir: IR) {
  const patient = {
    id: ir.patient?.id,
    name: truncate(ir.patient?.name, 120),
    birthDate: ir.patient?.birthDate,
    gender: ir.patient?.gender,
    email: ir.patient?.email,
    phone: ir.patient?.phone,
    address: truncate(ir.patient?.address, 140),
    identifiers: ir.patient?.identifiers?.slice(0, 5),
  };

  const conditions = (ir.conditions || []).slice(0, 25).map(c => ({
    name: truncate(c.name, 140),
    code: c.code,
    clinicalStatus: c.clinicalStatus,
    onset: safeDate(c.onset), abatement: safeDate(c.abatement)
  }));

  const medications = (ir.medications || []).slice(0, 25).map(m => ({
    name: truncate(m.name, 120), code: m.code, dosage: truncate(m.dosage, 100),
    status: m.status, start: safeDate(m.start), end: safeDate(m.end)
  }));

  const vitals = (ir.vitals || []).slice(0, 8).map(v => ({
    name: truncate(v.name, 80), code: v.code,
    last: v.points?.slice(-1)?.[0], recent: v.points?.slice(-3)
  }));

  const labs = (ir.labs || []).slice(0, 12).map(l => ({
    name: truncate(l.name, 100), code: l.code, last: l.points?.slice(-1)?.[0], recent: l.points?.slice(-3)
  }));

  const immunizations = (ir.immunizations || []).slice(0, 15).map(i => ({ name: truncate(i.name, 100), code: i.code, date: safeDate(i.date) }));
  const procedures = (ir.procedures || []).slice(0, 15).map(p => ({ name: truncate(p.name, 120), code: p.code, date: safeDate(p.date), performer: truncate(p.performer, 80) }));
  const encounters = (ir.encounters || []).slice(0, 15).map(e => ({ type: truncate(e.type, 100), start: safeDate(e.start), end: safeDate(e.end), location: truncate(e.location, 80), reason: truncate(e.reason, 100) }));

  return {
    patient,
    summaryCounts: {
      conditions: conditions.length,
      medications: medications.length,
      labs: labs.length,
      vitals: vitals.length,
      immunizations: immunizations.length,
      procedures: procedures.length,
      encounters: encounters.length,
    },
    conditions, medications, labs, vitals, immunizations, procedures, encounters,
  };
}

export function buildSystemPrompt(): string {
  return [
    'You are a clinician-grade health report writer.',
    'Produce a patient-friendly, empathetic, and precise HTML health report.',
    'Ground every statement strictly in the provided structured context. Do not invent facts.',
    'If a detail is missing, state that it is not available.',
    'Write at an 8th–10th grade reading level, avoid jargon, explain any medical terms briefly.',
    'Be concise, use headings, bullets, and short paragraphs. No external links.',
    'Output valid semantic HTML only, no CSS, no script, no DOCTYPE.',
    'Include a small disclaimer at the end that this is informational and not medical advice.',
  ].join(' ');
}

export function buildUserPrompt(contextObj: any): string {
  const contextJson = JSON.stringify(contextObj);
  return `
Context (JSON):\n${contextJson}\n\n
Task: Use the context to write a creative yet factual patient health report.\n
Structure: \n- <section id="overview"> concise patient overview (name, age if possible, key conditions).\n- <section id="conditions"> prioritized conditions with plain-language summaries and status.\n- <section id="medications"> current medications with purpose and simple instructions if present.\n- <section id="trends"> key vitals and labs trends (3 most relevant), interpret ranges briefly.\n- <section id="immunizations"> list with most recent dates.\n- <section id="care-timeline"> notable encounters/procedures highlights in chronological bullets.\n- <section id="next-steps"> personalized, actionable recommendations and follow-up questions to ask clinicians.\n- <section id="disclaimer"> short disclaimer.\n
Constraints: \n- Use only facts in Context.\n- If uncertain, say "Not available".\n- Keep within ~900-1400 words.\n- Return HTML sections only (no <html>, <head>, <body>, no inline CSS).`;
}

export function buildUserPromptFromFhir(fhir: any): string {
  const contextJson = JSON.stringify(fhir);
  return `
Context FHIR JSON:\n${contextJson}\n\n
Task: Use ONLY the FHIR content above to write a creative yet strictly factual patient health report. Parse the resources directly (no assumptions).\n
Guidance:\n- Identify Patient (Patient resource).\n- Summarize Conditions (Condition), Medications (MedicationRequest/MedicationStatement), Vitals & Labs (Observation), Immunizations (Immunization), Procedures (Procedure), Encounters (Encounter), Documents/Reports (DocumentReference/DiagnosticReport).\n- Consider effective times, statuses, and codes when summarizing.\n- If a field or resource is absent, state "Not available".\n
Structure:\n- <section id="overview"> concise patient overview (name if present, age if derivable, brief highlights).\n- <section id="conditions"> prioritized conditions with plain-language explanation and current status.\n- <section id="medications"> current meds with purpose if inferable from codes/text; include status.\n- <section id="trends"> key vitals and labs trends based on Observation dates (3 most relevant).\n- <section id="immunizations"> list with most recent dates.\n- <section id="care-timeline"> important encounters/procedures in chronological bullets.\n- <section id="next-steps"> actionable, patient-friendly follow-ups.\n- <section id="disclaimer"> short disclaimer.\n
Constraints:\n- Use valid semantic HTML only for sections (no <html>, <head>, <body>, no script).\n- Do not fabricate data; cite only from FHIR.\n- Keep within ~900–1400 words.`;
}
