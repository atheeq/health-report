// Convert a FHIR Bundle into a BlueButton-like normalized JSON structure
// compatible with our CCDA mapping (blueButtonDataToIR).
import { ensureArray } from './util';

export type BlueButtonData = Record<string, any>;

export function fhirToBlueButtonData(bundle: any): BlueButtonData {
  if (!bundle || bundle.resourceType !== 'Bundle') throw new Error('Expected FHIR Bundle');
  const d: BlueButtonData = {};

  // Demographics
  const patient = ensureArray(bundle.entry).map((e:any)=> e?.resource).find((r:any)=> r?.resourceType==='Patient');
  if (patient) {
    const n = patient.name?.[0];
    const full = n?.text ?? [ensureArray(n?.given).join(' '), n?.family].filter(Boolean).join(' ');
    d.demographics = {
      mrn: patient.id,
      name: { first: ensureArray(n?.given)[0], last: n?.family, full },
      dob: patient.birthDate,
      identifiers: patient.identifier?.map((id:any)=> ({ identifier: id.value, system: id.system }))
    };
  }

  // Helper to collect resources
  const ofType = (t: string) => ensureArray(bundle.entry).map((e:any)=> e?.resource).filter((r:any)=> r?.resourceType===t);

  // Medications
  const medFrom = (r:any) => r?.medicationCodeableConcept ?? r?.medication?.codeableConcept;
  d.medications = [
    ...ofType('MedicationRequest').map((r:any)=>({
      product: {
        name: medFrom(r)?.text ?? medFrom(r)?.coding?.[0]?.display,
        code: medFrom(r)?.coding?.[0] ? { system: medFrom(r).coding[0].system, code: medFrom(r).coding[0].code, name: medFrom(r).coding[0].display } : undefined,
      },
      dose: r.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity ? {
        value: r.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value,
        unit: r.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit
      } : undefined,
      status: r.status,
      date_range: { start: r.authoredOn }
    })),
    ...ofType('MedicationStatement').map((r:any)=>({
      product: {
        name: medFrom(r)?.text ?? medFrom(r)?.coding?.[0]?.display,
        code: medFrom(r)?.coding?.[0] ? { system: medFrom(r).coding[0].system, code: medFrom(r).coding[0].code, name: medFrom(r).coding[0].display } : undefined,
      },
      dose: r.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity ? {
        value: r.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value,
        unit: r.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit
      } : undefined,
      status: r.status,
      date_range: { start: r.effectivePeriod?.start, end: r.effectivePeriod?.end }
    }))
  ];

  // Problems / Conditions
  d.problems = ofType('Condition').map((r:any)=> ({
    problem: { name: r.code?.text ?? r.code?.coding?.[0]?.display, code: r.code?.coding?.[0] ? { system: r.code.coding[0].system, code: r.code.coding[0].code, name: r.code.coding[0].display } : undefined },
    status: r.clinicalStatus?.coding?.[0]?.code,
    date_range: { start: r.onsetDateTime ?? r.onsetPeriod?.start, end: r.abatementDateTime ?? r.abatementPeriod?.end }
  }));

  // Labs (group by test name)
  const labObs = ofType('Observation').filter((o:any)=> ensureArray(o.category).flatMap((c:any)=> ensureArray(c.coding)).some((cc:any)=> /laboratory/i.test(cc?.code||cc?.display||'')));
  const labMap: Record<string, any> = {};
  for (const o of labObs) {
    const name = o.code?.text ?? o.code?.coding?.[0]?.display ?? 'Lab';
    const unit = o.valueQuantity?.unit;
    const v = typeof o.valueQuantity?.value === 'number' ? o.valueQuantity.value : Number(o.valueQuantity?.value);
    if (!Number.isFinite(v)) continue;
    const date = o.effectiveDateTime ?? o.issued;
    const key = name;
    (labMap[key] ??= { panel: { name, code: o.code?.coding?.[0] && { system: o.code.coding[0].system, code: o.code.coding[0].code, name: o.code.coding[0].display } }, results: [] });
    labMap[key].results.push({ name, date, date_time: date, value: v, unit });
  }
  d.results = Object.values(labMap);

  // Vitals (group by vital name)
  const vitalObs = ofType('Observation').filter((o:any)=> ensureArray(o.category).flatMap((c:any)=> ensureArray(c.coding)).some((cc:any)=> /vital/i.test(cc?.code||cc?.display||'')));
  const vitalMap: Record<string, any> = {};
  for (const o of vitalObs) {
    const name = o.code?.text ?? o.code?.coding?.[0]?.display ?? 'Vital';
    const unit = o.valueQuantity?.unit;
    const v = typeof o.valueQuantity?.value === 'number' ? o.valueQuantity.value : Number(o.valueQuantity?.value);
    if (!Number.isFinite(v)) continue;
    const date = o.effectiveDateTime ?? o.issued;
    const key = name;
    (vitalMap[key] ??= { name, code: o.code?.coding?.[0] && { system: o.code.coding[0].system, code: o.code.coding[0].code, name: o.code.coding[0].display }, results: [] });
    vitalMap[key].results.push({ name, date, date_time: date, value: v, unit });
  }
  d.vitals = Object.values(vitalMap);

  // Social history (Observations category social-history)
  const socObs = ofType('Observation').filter((o:any)=> ensureArray(o.category).flatMap((c:any)=> ensureArray(c.coding)).some((cc:any)=> /social\-history/i.test(cc?.code||cc?.display||'')));
  d.social_history = socObs.map((o:any)=> {
    const name = o.code?.text ?? o.code?.coding?.[0]?.display ?? 'Social history';
    const date = o.effectiveDateTime ?? o.issued;
    let value:any = o.valueString ?? o.valueBoolean ?? o.valueInteger ?? o.valueDecimal;
    if (value === true) value = 'Yes';
    if (value === false) value = 'No';
    if (value === undefined) {
      const cc = o.valueCodeableConcept?.text ?? o.valueCodeableConcept?.coding?.[0]?.display;
      const qty = o.valueQuantity ? `${o.valueQuantity.value ?? ''} ${o.valueQuantity.unit ?? ''}`.trim() : undefined;
      value = cc ?? qty ?? undefined;
    }
    return { name, value, date_time: date };
  });

  // Allergies
  d.allergies = ofType('AllergyIntolerance').map((r:any)=> ({
    substance: { name: r.code?.text ?? r.code?.coding?.[0]?.display, code: r.code?.coding?.[0] && { system: r.code.coding[0].system, code: r.code.coding[0].code, name: r.code.coding[0].display } },
    reactions: ensureArray(r.reaction).map((rx:any)=> ({ reaction: rx?.manifestation?.[0]?.text || rx?.manifestation?.[0]?.coding?.[0]?.display })),
    status: r.clinicalStatus?.coding?.[0]?.code,
    severity: r.criticality
  }));

  // Immunizations
  d.immunizations = ofType('Immunization').map((r:any)=> ({
    product: { name: r.vaccineCode?.text ?? r.vaccineCode?.coding?.[0]?.display, code: r.vaccineCode?.coding?.[0] && { system: r.vaccineCode.coding[0].system, code: r.vaccineCode.coding[0].code, name: r.vaccineCode.coding[0].display } },
    date_time: r.occurrenceDateTime ?? r.date,
    status: r.status
  }));

  // Encounters
  d.encounters = ofType('Encounter').map((r:any)=> ({
    name: r.type?.[0]?.text ?? r.type?.[0]?.coding?.[0]?.display,
    code: r.type?.[0]?.coding?.[0] && { system: r.type[0].coding[0].system, code: r.type[0].coding[0].code, name: r.type[0].coding[0].display },
    date_time: r.period?.start,
    date_range: { start: r.period?.start, end: r.period?.end },
    locations: ensureArray(r.location).map((l:any)=> ({ name: l?.location?.display }))
  }));

  // Procedures
  d.procedures = ofType('Procedure').map((r:any)=> ({
    name: r.code?.text ?? r.code?.coding?.[0]?.display,
    code: r.code?.coding?.[0] && { system: r.code.coding[0].system, code: r.code.coding[0].code, name: r.code.coding[0].display },
    date_time: r.performedDateTime ?? r.performedPeriod?.start,
    performers: ensureArray(r.performer).map((p:any)=> ({ name: p.actor?.display }))
  }));

  // Devices
  d.devices = ofType('Device').map((r:any)=> ({
    name: r.deviceName?.[0]?.name || r.type?.text || r.type?.coding?.[0]?.display,
    code: r.type?.coding?.[0] && { system: r.type.coding[0].system, code: r.type.coding[0].code, name: r.type.coding[0].display },
    status: r.status,
    identifiers: r.udiCarrier?.[0]?.deviceIdentifier ? [{ identifier: r.udiCarrier[0].deviceIdentifier }] : undefined
  }));

  // Documents
  d.documents = ofType('DocumentReference').map((r:any)=> ({
    title: r.description || r.content?.[0]?.attachment?.title,
    code: r.type?.coding?.[0] && { system: r.type.coding[0].system, code: r.type.coding[0].code, name: r.type.coding[0].display },
    date_time: r.date,
    url: r.content?.[0]?.attachment?.url
  }));

  // Interpreted results (DiagnosticReport)
  d.results_interpreted = ofType('DiagnosticReport').map((r:any)=> ({
    name: r.code?.text ?? r.code?.coding?.[0]?.display,
    code: r.code?.coding?.[0] && { system: r.code.coding[0].system, code: r.code.coding[0].code, name: r.code.coding[0].display },
    date_time: r.effectiveDateTime ?? r.issued,
    results: ensureArray(r.result).map((x:any)=> ({ name: x?.display || x?.reference }))
  }));

  // Imaging
  d.imaging = ofType('ImagingStudy').map((r:any)=> ({
    modality: r.series?.[0]?.modality?.display || r.series?.[0]?.modality?.code,
    body_site: r.series?.[0]?.bodySite?.display || r.series?.[0]?.bodySite?.code,
    date_time: r.started,
    name: r.description
  }));

  // Orders (ServiceRequest)
  d.orders = ofType('ServiceRequest').map((r:any)=> ({ name: r.code?.text ?? r.code?.coding?.[0]?.display, status: r.status, date_time: r.authoredOn }));

  // Nutrition (NutritionOrder)
  d.nutrition = ofType('NutritionOrder').map((r:any)=> ({
    date_time: r.dateTime,
    status: r.status,
    diet: ensureArray(r.oralDiet?.type).map((t:any)=> t.text ?? t.coding?.[0]?.display).filter(Boolean).join(', '),
    instruction: r.oralDiet?.instruction?.text ?? r.note?.[0]?.text
  }));

  // Appointments
  d.appointments = ofType('Appointment').map((r:any)=> ({ start: r.start, end: r.end, status: r.status, type: r.appointmentType?.text ?? r.appointmentType?.coding?.[0]?.display, location: ensureArray(r.participant).find((p:any)=> p.actor?.display)?.actor?.display }));

  // Organizations / Providers
  d.organizations = ofType('Organization').map((r:any)=> ({ name: r.name, type: r.type?.[0]?.text ?? r.type?.[0]?.coding?.[0]?.display, phone: r.telecom?.[0]?.value }));
  d.providers = ofType('Practitioner').map((r:any)=> ({ name: r.name?.[0]?.text, phone: r.telecom?.[0]?.value }));
  d.provider_roles = ofType('PractitionerRole').map((r:any)=> ({ practitioner: { name: r.practitioner?.display }, organization: { name: r.organization?.display }, specialty: ensureArray(r.specialty)?.[0]?.text ?? ensureArray(r.specialty)?.[0]?.coding?.[0]?.display, location: ensureArray(r.location)?.[0]?.display }));
  d.facilities = ofType('Location').map((r:any)=> ({ name: r.name, type: r.type?.[0]?.text ?? r.type?.[0]?.coding?.[0]?.display, address: r.address?.text || [ensureArray(r.address?.line).join(' '), r.address?.city, r.address?.state, r.address?.postalCode].filter(Boolean).join(', '), phone: r.telecom?.[0]?.value }));
  d.contacts = ofType('RelatedPerson').map((r:any)=> ({ name: r.name?.[0]?.text, relationship: r.relationship?.[0]?.coding?.[0]?.display ?? r.relationship?.[0]?.text, phone: r.telecom?.[0]?.value }));

  // Risk Assessments
  d.risk_assessments = ofType('RiskAssessment').map((r:any)=> ({ name: r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Risk Assessment', date_time: r.occurrenceDateTime ?? r.occurrencePeriod?.start, text: r.text?.div?.replace(/<[^>]+>/g,'') }));

  // Medication events
  d.medication_administrations = ofType('MedicationAdministration').map((r:any)=> ({
    date_time: r.effectiveDateTime ?? r.effectivePeriod?.start ?? r.occurrenceDateTime ?? r.occurrencePeriod?.start,
    medication: (r.medicationCodeableConcept ?? r.medication?.codeableConcept)?.text ?? (r.medicationCodeableConcept ?? r.medication?.codeableConcept)?.coding?.[0]?.display,
    dose: r.dosage?.dose ? `${r.dosage.dose.value ?? ''} ${r.dosage.dose.unit ?? ''}`.trim() : r.dosage?.text,
    route: r.dosage?.route?.text ?? r.dosage?.route?.coding?.[0]?.display,
    performer: ensureArray(r.performer)?.[0]?.actor?.display
  }));
  d.medication_dispenses = ofType('MedicationDispense').map((r:any)=> ({
    date_time: r.whenHandedOver ?? r.whenPrepared,
    medication: (r.medicationCodeableConcept ?? r.medication?.codeableConcept)?.text ?? (r.medicationCodeableConcept ?? r.medication?.codeableConcept)?.coding?.[0]?.display,
    quantity: r.quantity ? `${r.quantity.value ?? ''} ${r.quantity.unit ?? ''}`.trim() : undefined,
    days_supply: r.daysSupply ? `${r.daysSupply.value ?? ''} ${r.daysSupply.unit ?? ''}`.trim() : undefined,
    performer: ensureArray(r.performer)?.[0]?.actor?.display
  }));

  // Clinical impressions and flags
  d.clinical_impressions = ofType('ClinicalImpression').map((r:any)=> ({ date_time: r.date ?? r.effectiveDateTime ?? r.effectivePeriod?.start, summary: r.summary ?? r.description, status: r.status }));
  d.flags = ofType('Flag').map((r:any)=> ({ status: r.status, code: r.code?.coding?.[0], category: ensureArray(r.category)?.[0]?.text ?? ensureArray(r.category)?.[0]?.coding?.[0]?.display, period: r.period }));

  // Plan of care / Goals
  d.plan_of_care = ofType('CarePlan').map((r:any)=> ({ name: r.title ?? r.description ?? 'Care Plan', status: r.status, date_time: r.period?.start, date_range: { start: r.period?.start, end: r.period?.end }, activities: ensureArray(r.activity).map((a:any)=> a.detail?.description || a.detail?.code?.text || a.detail?.code?.coding?.[0]?.display) }));
  d.goals = ofType('Goal').map((r:any)=> ({ name: r.description?.text ?? r.description ?? 'Goal', status: r.lifecycleStatus ?? r.status, target: ensureArray(r.target)?.[0]?.detailString ?? ensureArray(r.target)?.[0]?.detailQuantity?.value?.toString(), due: ensureArray(r.target)?.[0]?.dueDate }));

  // Family history
  d.family_history = ofType('FamilyMemberHistory').map((r:any)=> ({ name: r.relationship?.text ?? r.relationship?.coding?.[0]?.display, problem: { name: ensureArray(r.condition)?.[0]?.code?.text ?? ensureArray(r.condition)?.[0]?.code?.coding?.[0]?.display }, age: ensureArray(r.condition)?.[0]?.onsetAge?.value, onset: ensureArray(r.condition)?.[0]?.onsetString }));

  // Questionnaires
  d.questionnaires = ofType('QuestionnaireResponse').map((r:any)=> ({ title: r.questionnaire?.display || r.questionnaire?.reference || 'Questionnaire', date_time: r.authored, items: ensureArray(r.item).map((it:any)=> ({ question: it.text, answer: ensureArray(it.answer).map((a:any)=> a.valueString ?? a.valueCoding?.display ?? a.valueInteger ?? a.valueDecimal).filter((x:any)=> x!==undefined).join(', ') })) }));

  // Insurance (Coverage)
  d.insurance = ofType('Coverage').map((r:any)=> ({ plan_name: ensureArray(r.payor)?.[0]?.display, type: r.type?.text ?? r.type?.coding?.[0]?.display, status: r.status, date_range: { start: r.period?.start, end: r.period?.end }, member_id: r.subscriberId || r.beneficiary?.identifier?.value }));

  return d;
}
