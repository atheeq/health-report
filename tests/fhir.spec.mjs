// Simple smoke tests (run after `npm run build`).
// Usage: node tests/fhir.spec.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { toIR, renderHtml, fhirToBlueButtonData, blueButtonDataToIR } = await import('../dist/esm/index.js');

const bundle = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/fhir-bundle.json'), 'utf8'));

const ir = await toIR(bundle);
assert.equal(ir.patient.name, 'Jane Doe');
assert.equal(ir.conditions[0].name, 'Hypertension');
assert.ok(ir.medications.find(m => m.name.includes('Lisinopril')));
assert.ok(ir.labs[0].points.length >= 1);
assert.ok(ir.allergies.length >= 1);
assert.equal(ir.allergies[0].name, 'Peanut');
assert.ok(ir.immunizations.length >= 1);

const html = await renderHtml(bundle);
assert.ok(html.includes('Health Report'));
assert.ok(html.includes('Jane Doe'));
assert.ok(html.includes('Hypertension'));
assert.ok(html.includes('Lisinopril'));
assert.ok(html.includes('Allergies'));
assert.ok(html.includes('Peanut'));
assert.ok(html.includes('Immunizations'));
assert.ok(html.includes('COVID-19'));
assert.ok(html.includes('Encounters'));
assert.ok(html.includes('Office visit'));
assert.ok(html.includes('Procedures'));
assert.ok(html.includes('EKG'));
assert.ok(html.includes('Devices'));
assert.ok(html.includes('Pacemaker'));
assert.ok(html.includes('Documents'));
assert.ok(html.includes('Discharge summary'));
assert.ok(html.includes('Reports'));
assert.ok(html.includes('Basic metabolic panel'));
assert.ok(html.includes('Vitals'));
assert.ok(html.includes('Heart rate'));
assert.ok(html.includes('Care Plans'));
assert.ok(html.includes('Hypertension management'));
assert.ok(html.includes('Goals'));
assert.ok(html.includes('Reduce blood pressure'));
assert.ok(html.includes('Coverage'));
assert.ok(html.includes('ACME Health'));
assert.ok(html.includes('Family History'));
assert.ok(html.includes('Myocardial infarction'));
assert.ok(html.includes('Questionnaires'));
assert.ok(html.includes('PHQ-9'));
assert.ok(html.includes('Service Requests'));
assert.ok(html.includes('Chest X-ray'));
assert.ok(html.includes('Imaging'));
assert.ok(html.includes('X-ray'));
assert.ok(html.includes('Appointments'));
assert.ok(html.includes('Follow-up'));
assert.ok(html.includes('Care Team'));
assert.ok(html.includes('Medication Events'));
assert.ok(html.includes('Heparin'));
assert.ok(html.includes('Clinical Notes & Flags'));
assert.ok(html.includes('Fall risk'));
assert.ok(html.includes('Social History'));
assert.ok(html.includes('Tobacco smoking status'));
assert.ok(html.includes('Nutrition'));
assert.ok(html.includes('Low sodium'));
assert.ok(html.includes('Dr. John Smith'));
assert.ok(html.includes('Locations'));
assert.ok(html.includes('Clinic A'));
assert.ok(html.includes('Related Persons'));
assert.ok(html.includes('Spouse'));
assert.ok(html.includes('Risk Assessments'));
assert.ok(html.includes('Cardiovascular risk'));
assert.ok(html.includes('Resources Present'));
assert.ok(html.includes('AuditEvent'));
assert.ok(html.includes('Financial'));
assert.ok(html.includes('EOB'));
assert.ok(html.includes('Privacy & Activity'));
assert.ok(html.includes('Consent'));
assert.ok(html.includes('Message'));
assert.ok(html.includes('Care Team'));

console.log('✅ FHIR smoke test passed');

// Normalized BlueButton-like JSON from FHIR
const bb = fhirToBlueButtonData(bundle);
assert.equal(bb.demographics.name.full, 'Jane Doe');
assert.ok(bb.medications.length >= 1);
assert.ok(bb.problems.length >= 1);
assert.ok(bb.results.length >= 1);
assert.ok(bb.vitals.length >= 1);
assert.ok(bb.allergies.length >= 1);
assert.ok(bb.immunizations.length >= 1);
assert.ok(bb.results_interpreted.length >= 1);
assert.ok(bb.insurance.length >= 1);
assert.ok(bb.social_history.length >= 1);
assert.ok(bb.nutrition.length >= 1);
assert.ok(bb.medication_administrations.length >= 1);
assert.ok(bb.medication_dispenses.length >= 1);
assert.ok(bb.clinical_impressions.length >= 1);
assert.ok(bb.flags.length >= 1);

// Round-trip normalized -> IR using same mapping as CCDA
const ir2 = blueButtonDataToIR(bb);
assert.equal(ir2.patient.name, 'Jane Doe');
assert.ok(ir2.medications.length >= 1);
assert.ok(ir2.conditions.length >= 1);
assert.ok(ir2.labs.length >= 1);
assert.ok(ir2.vitals.length >= 1);
assert.ok(ir2.medAdministrations.length >= 1);
assert.ok(ir2.medDispenses.length >= 1);
assert.ok(ir2.clinicalImpressions.length >= 1);
assert.ok(ir2.flags.length >= 1);
console.log('✅ FHIR→BlueButton normalized test passed');
