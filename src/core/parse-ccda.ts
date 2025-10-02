import type { IR, Patient, Medication, Condition, LabPanel, Allergy, Immunization, Encounter, Procedure, Device, Document, DiagnosticReport, VitalPanel, CarePlan, Goal, FamilyHistory, Questionnaire, Coverage, Imaging, ServiceRequest, Appointment, Organization, Practitioner, PractitionerRole, Location, RelatedPerson, RiskAssessment } from './model';
import { parseFhir } from './parse-fhir';
import { convertXmlToCcda, convertCcdaToFhir } from '@medplum/ccda';

export function blueButtonDataToIR(d: any, opts: { includeCcdaCounts?: boolean } = {}): IR {
  const identifiers = (d.demographics?.identifiers ?? []).map((it:any)=> ({
    system: it.system || it.assigner || it.authority,
    value: it.identifier,
    type: it.type?.name || it.type
  })).filter((x:any)=> x.value);
  if (d.demographics?.mrn) identifiers.unshift({ value: d.demographics.mrn, type: 'MRN' });
  const patient: Patient = {
    id: d.demographics?.mrn || d.demographics?.identifiers?.[0]?.identifier,
    name: [d.demographics?.name?.first, d.demographics?.name?.last].filter(Boolean).join(' ') || d.demographics?.name?.full,
    birthDate: d.demographics?.dob,
    gender: d.demographics?.gender,
    phones: [d.demographics?.phone || d.demographics?.telecom].filter(Boolean),
    phoneLabels: undefined,
    phone: d.demographics?.phone || d.demographics?.telecom,
    email: d.demographics?.email,
    address: d.demographics?.address?.street || d.demographics?.address?.full || d.demographics?.address,
    identifiers
  };

  const medications: Medication[] = (d.medications ?? []).map((m: any) => ({
    name: m.product?.name || m.product?.code?.name || 'Medication',
    code: m.product?.code ? { system: m.product.code.system, code: m.product.code.code, display: m.product.code.name } : undefined,
    dosage: m.dose?.text ?? (m.dose?.value && m.dose?.unit ? `${m.dose.value} ${m.dose.unit}` : undefined),
    status: m.status, start: m.date_range?.start, end: m.date_range?.end
  }));

  const conditions: Condition[] = (d.problems ?? []).map((p: any) => ({
    name: p.problem?.name || p.problem?.code?.name || 'Condition',
    code: p.problem?.code ? { system: p.problem.code.system, code: p.problem.code.code, display: p.problem.code.name } : undefined,
    onset: p.date_range?.start, abatement: p.date_range?.end, clinicalStatus: p.status
  }));

  const labs: LabPanel[] = (d.results ?? []).map((r: any) => ({
    name: r.panel?.name || r.name || 'Lab',
    code: r.panel?.code ? { system: r.panel.code.system, code: r.panel.code.code, display: r.panel.code.name } : undefined,
    points: (r.results ?? []).map((res: any) => ({
      t: res.date || res.date_time,
      v: typeof res.value === 'number' ? res.value : Number(res.value?.value ?? res.value),
      unit: res.unit || res.value?.unit
    })).filter((pt:any)=> Number.isFinite(pt.v))
  }));

  const vitals: VitalPanel[] = (d.vitals ?? []).map((v: any) => ({
    name: v.name || 'Vital',
    code: v.code ? { system: v.code.system, code: v.code.code, display: v.code.name } : undefined,
    points: (v.results ?? []).map((res: any) => ({
      t: res.date || res.date_time,
      v: typeof res.value === 'number' ? res.value : Number(res.value?.value ?? res.value),
      unit: res.unit || res.value?.unit
    })).filter((pt:any)=> Number.isFinite(pt.v))
  }));

  const allergies: Allergy[] = (d.allergies ?? []).map((a: any) => ({
    name: a.substance?.name || a.substance?.code?.name || 'Allergy',
    code: a.substance?.code ? { system: a.substance.code.system, code: a.substance.code.code, display: a.substance.code.name } : undefined,
    reaction: a.reactions?.[0]?.reaction?.name || a.reactions?.[0]?.reaction || a.reaction?.name,
    status: a.status,
    criticality: a.severity?.code?.name || a.severity || a.criticality
  }));

  const immunizations: Immunization[] = (d.immunizations ?? []).map((i: any) => ({
    name: i.product?.name || i.product?.code?.name || 'Immunization',
    code: i.product?.code ? { system: i.product.code.system, code: i.product.code.code, display: i.product.code.name } : undefined,
    date: i.date || i.date_time,
    status: i.status
  }));

  const encounters: Encounter[] = (d.encounters ?? []).map((e: any) => ({
    type: e.name || e.code?.name,
    code: e.code ? { system: e.code.system, code: e.code.code, display: e.code.name } : undefined,
    start: e.date_time || e.date || e.date_range?.start,
    end: e.date_range?.end,
    location: e.locations?.[0]?.name,
    reason: e.reason || e.finding?.name
  }));

  const procedures: Procedure[] = (d.procedures ?? []).map((p: any) => ({
    name: p.name || p.code?.name || 'Procedure',
    code: p.code ? { system: p.code.system, code: p.code.code, display: p.code.name } : undefined,
    date: p.date_time || p.date,
    performer: p.performers?.[0]?.name
  }));

  const devices: Device[] = (d.devices ?? []).map((dv: any) => ({
    name: dv.name || dv.code?.name || 'Device',
    code: dv.code ? { system: dv.code.system, code: dv.code.code, display: dv.code.name } : undefined,
    status: dv.status,
    udi: dv.identifiers?.[0]?.identifier
  }));

  const documentsSrc: any[] = Array.isArray(d.documents) ? d.documents : (d.document ? [d.document] : []);
  const documents: Document[] = (documentsSrc).map((doc: any) => ({
    title: doc.title || doc.name || 'Document',
    type: doc.code ? { system: doc.code.system, code: doc.code.code, display: doc.code.name } : undefined,
    date: doc.date || doc.date_time,
    url: doc.url || doc.href
  }));

  const reports: DiagnosticReport[] = (d.results_interpreted ?? []).map((rep: any) => ({
    name: rep.name || 'Report',
    code: rep.code ? { system: rep.code.system, code: rep.code.code, display: rep.code.name } : undefined,
    date: rep.date || rep.date_time,
    resultRefs: (rep.results ?? []).map((r:any)=> r.name || r.code?.name).filter(Boolean)
  }));

  const imaging: Imaging[] = (d.imaging ?? []).map((img:any)=> ({
    modality: img.modality || img.type,
    bodySite: img.body_site || img.site,
    started: img.date || img.date_time,
    description: img.name || img.text
  }));

  const serviceRequests: ServiceRequest[] = (d.orders ?? []).map((o:any)=> ({
    name: o.name || o.text || 'Service request',
    status: o.status,
    date: o.date || o.date_time
  }));

  const appointments: Appointment[] = (d.appointments ?? []).map((a:any)=> ({
    start: a.start || a.date || a.date_time,
    end: a.end,
    status: a.status,
    type: a.type,
    reason: a.reason,
    location: a.location
  }));

  const organizations: Organization[] = (d.organizations ?? []).map((o:any)=> ({ name: o.name, type: o.type, telecom: o.phone || o.telecom }));
  const practitioners: Practitioner[] = (d.providers ?? d.practitioners ?? []).map((p:any)=> ({ name: [p.name?.first, p.name?.last].filter(Boolean).join(' ') || p.name?.full || p.name, specialty: p.specialty, telecom: p.phone || p.telecom }));
  const practitionerRoles: PractitionerRole[] = (d.provider_roles ?? []).map((pr:any)=> ({ practitioner: pr.practitioner?.name || pr.practitioner, organization: pr.organization?.name || pr.organization, specialty: pr.specialty, location: pr.location }));
  const locations: Location[] = (d.facilities ?? d.locations ?? []).map((l:any)=> ({ name: l.name, type: l.type, address: l.address?.street || l.address?.full || l.address, telecom: l.phone }));
  const relatedPersons: RelatedPerson[] = (d.contacts ?? d.related_persons ?? []).map((rp:any)=> ({ name: [rp.name?.first, rp.name?.last].filter(Boolean).join(' ') || rp.name?.full || rp.name, relationship: rp.relationship, telecom: rp.phone || rp.telecom }));
  const riskAssessments: RiskAssessment[] = (d.risk_assessments ?? []).map((ra:any)=> ({ name: ra.name || 'Risk Assessment', date: ra.date || ra.date_time, summary: ra.text, probability: ra.risk || ra.probability }));

  const carePlans: CarePlan[] = (d.plan_of_care ?? []).map((cp:any)=> ({
    title: cp.name || 'Care Plan',
    status: cp.status,
    start: cp.date_time || cp.date_range?.start,
    end: cp.date_range?.end,
    activities: (cp.activities ?? []).map((a:any)=> a.name || a.text).filter(Boolean)
  }));

  const goals: Goal[] = (d.goals ?? []).map((g:any)=> ({
    description: g.name || g.text || 'Goal',
    status: g.status,
    target: g.target || g.target_value,
    due: g.due || g.due_date
  }));

  const familyHistory: FamilyHistory[] = (d.family_history ?? []).map((fh:any)=> ({
    relation: fh.name || fh.relationship,
    condition: fh.problem?.name || fh.condition?.name,
    onset: fh.age || fh.onset
  }));

  const questionnaires: Questionnaire[] = (d.questionnaires ?? []).map((qr:any)=> ({
    title: qr.title || qr.name || 'Questionnaire',
    date: qr.date || qr.date_time,
    summary: (qr.items ?? []).map((i:any)=> [i.question, i.answer].filter(Boolean).join(': ')).join(' | ')
  }));

  const coverage: Coverage[] = (d.insurance ?? []).map((c:any)=> ({
    payor: c.plan_name || c.payer || c.company,
    type: c.type,
    status: c.status,
    start: c.date_range?.start,
    end: c.date_range?.end,
    memberId: c.member_id || c.policy_number
  }));

  // Optional lifestyle/orders and events when present in normalized data
  const socialHistory = (d.social_history ?? []).map((s:any)=> ({ name: s.name || 'Social history', value: s.value, date: s.date || s.date_time })) as any;
  const nutritionOrders = (d.nutrition ?? []).map((n:any)=> ({ date: n.date || n.date_time, status: n.status, diet: n.diet, instruction: n.instruction })) as any;
  const medAdministrations = (d.medication_administrations ?? []).map((m:any)=> ({ date: m.date || m.date_time, medication: m.medication, dose: m.dose, route: m.route, performer: m.performer })) as any;
  const medDispenses = (d.medication_dispenses ?? []).map((m:any)=> ({ date: m.date || m.date_time, medication: m.medication, quantity: m.quantity, daysSupply: m.days_supply, performer: m.performer })) as any;
  const clinicalImpressions = (d.clinical_impressions ?? []).map((c:any)=> ({ date: c.date || c.date_time, summary: c.summary, status: c.status })) as any;
  const flags = (d.flags ?? []).map((f:any)=> ({ status: f.status, code: f.code, category: f.category, periodStart: f.period?.start, periodEnd: f.period?.end })) as any;

  const other: any = { fhirCounts: {} };
  if (opts.includeCcdaCounts) {
    const ccdaCounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(d || {})) {
      if (Array.isArray(v)) ccdaCounts[k] = v.length;
    }
    other.ccdaCounts = ccdaCounts;
  }
  return {
    patient,
    medications,
    conditions,
    allergies,
    immunizations,
    encounters,
    procedures,
    devices,
    documents,
    reports,
    labs,
    vitals,
    carePlans,
    goals,
    familyHistory,
    questionnaires,
    coverage,
    imaging,
    serviceRequests,
    appointments,
    organizations,
    practitioners,
    practitionerRoles,
    locations,
    relatedPersons,
    riskAssessments,
    other,
    _raw: { ccda: d },
    socialHistory,
    nutritionOrders,
    medAdministrations,
    medDispenses,
    clinicalImpressions,
    flags,
    // Financial and related (not present in CCDA; initialize as empty arrays)
    eobs: [],
    claims: [],
    claimResponses: [],
    paymentNotices: [],
    paymentReconciliations: [],
    eligibilities: [],
    // Privacy/Security
    consents: [],
    auditEvents: [],
    // Communication/Workflow
    communications: [],
    communicationRequests: [],
    careTeamsRes: [],
    tasks: [],
    appointmentResponses: []
  } as IR;
}

export async function parseCcda(xml: string): Promise<IR> | never {
  // Parse C-CDA XML -> CCDA object, then convert to FHIR Bundle, then to IR
  const ccda = convertXmlToCcda(xml);
  const bundle = convertCcdaToFhir(ccda, { ignoreUnsupportedSections: true });
  return parseFhir(bundle);
}
