import type { IR } from './model';
import { handlers, defaultHandler } from './registry';
import { ensureArray } from './util';

export function parseFhir(bundle: any): IR {
  if (!bundle || bundle.resourceType !== 'Bundle') throw new Error('Expected FHIR Bundle');
  const ir: IR = {
    patient: {},
    medications: [],
    medAdministrations: [],
    medDispenses: [],
    conditions: [],
    allergies: [],
    immunizations: [],
    encounters: [],
    procedures: [],
    devices: [],
    documents: [],
    reports: [],
    labs: [],
    vitals: [],
    carePlans: [],
    goals: [],
    familyHistory: [],
    questionnaires: [],
    coverage: [],
    imaging: [],
    serviceRequests: [],
    appointments: [],
    organizations: [],
    practitioners: [],
    practitionerRoles: [],
    locations: [],
    relatedPersons: [],
    riskAssessments: [],
    clinicalImpressions: [],
    flags: [],
    socialHistory: [],
    nutritionOrders: [],
    other: { fhirCounts: {} },
    eobs: [],
    claims: [],
    claimResponses: [],
    paymentNotices: [],
    paymentReconciliations: [],
    eligibilities: [],
    consents: [],
    auditEvents: [],
    communications: [],
    communicationRequests: [],
    careTeamsRes: [],
    tasks: [],
    appointmentResponses: []
  };
  for (const e of ensureArray(bundle.entry)) {
    const r = e?.resource; if (!r?.resourceType) continue;
    ir.other.fhirCounts[r.resourceType] = (ir.other.fhirCounts[r.resourceType] ?? 0) + 1;
    (handlers[r.resourceType] ?? defaultHandler)(r, ir);
  }
  // sort lab points
  for (const p of ir.labs) p.points.sort((a,b)=> (a.t > b.t ? 1 : -1));
  for (const p of ir.vitals) p.points.sort((a,b)=> (a.t > b.t ? 1 : -1));
  return ir;
}
