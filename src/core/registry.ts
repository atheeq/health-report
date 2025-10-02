import type { IR } from './model';
import { ensureArray } from './util';

type Handler = (resource: any, ir: IR) => void;
export const handlers: Record<string, Handler> = {
  Patient(r, ir) {
    const n = r.name?.[0];
    const tel = ensureArray(r.telecom);
    const phones = tel.filter((t:any)=> (t.system||'').toLowerCase()==='phone');
    phones.sort((a:any,b:any)=> (a.rank ?? 99) - (b.rank ?? 99));
    const phonePref = phones.find((t:any)=> Number(t.rank)===1) || phones.find((t:any)=> (t.use||'').toLowerCase()==='mobile') || phones.find((t:any)=> (t.use||'').toLowerCase()==='home') || phones[0];
    const ordered = phones.map((p:any)=> ({ value: p?.value, use: (p?.use||'').toLowerCase(), rank: Number(p?.rank) || undefined }))
      .filter(p=> Boolean(p.value));
    // Deduplicate by value, keep first occurrence (highest priority after sort)
    const seen = new Set<string>();
    const uniqueOrdered = ordered.filter(p=> { if (seen.has(p.value!)) return false; seen.add(p.value!); return true; });
    const orderedPhoneValues = uniqueOrdered.map(p=> p.value!);
    const orderedPhoneLabels = uniqueOrdered.map(p=> p.use || (p.rank===1 ? 'primary' : ''));
    const phone = phonePref?.value || orderedPhoneValues[0];
    const emails = tel.filter((t:any)=> (t.system||'').toLowerCase()==='email');
    emails.sort((a:any,b:any)=> (a.rank ?? 99) - (b.rank ?? 99));
    const emailPref = emails.find((t:any)=> Number(t.rank)===1) || emails[0];
    const email = emailPref?.value;
    const addrs = ensureArray(r.address);
    const addrObj = addrs.find((a:any)=> (a.use||'').toLowerCase()==='home') || addrs[0];
    const address = addrObj ? [ensureArray(addrObj.line).join(' '), addrObj.city, addrObj.state, addrObj.postalCode].filter(Boolean).join(', ') : undefined;
    ir.patient = {
      id: r.id,
      name: n?.text ?? [ensureArray(n?.given).join(' '), n?.family].filter(Boolean).join(' '),
      birthDate: r.birthDate,
      gender: r.gender,
      phones: orderedPhoneValues.slice(0, 3),
      phoneLabels: orderedPhoneLabels.slice(0, 3),
      phone,
      email,
      address,
      identifiers: ensureArray(r.identifier).map((id:any)=> ({
        system: id.system,
        value: id.value,
        type: id.type?.text ?? id.type?.coding?.[0]?.display
      })).filter((x:any)=> x.value)
    };
  },
  MedicationAdministration(r, ir) {
    const med = r.medicationCodeableConcept ?? r.medication?.codeableConcept;
    const dose = r.dosage?.dose ? `${r.dosage.dose.value ?? ''} ${r.dosage.dose.unit ?? ''}`.trim() : r.dosage?.text;
    ir.medAdministrations.push({
      date: r.effectiveDateTime ?? r.effectivePeriod?.start ?? r.occurrenceDateTime ?? r.occurrencePeriod?.start,
      medication: med?.text ?? med?.coding?.[0]?.display ?? r.medicationReference?.display,
      dose,
      route: r.dosage?.route?.text ?? r.dosage?.route?.coding?.[0]?.display,
      performer: ensureArray(r.performer)?.[0]?.actor?.display
    });
  },
  MedicationDispense(r, ir) {
    const med = r.medicationCodeableConcept ?? r.medication?.codeableConcept;
    const quantity = r.quantity ? `${r.quantity.value ?? ''} ${r.quantity.unit ?? ''}`.trim() : undefined;
    const daysSupply = r.daysSupply ? `${r.daysSupply.value ?? ''} ${r.daysSupply.unit ?? ''}`.trim() : undefined;
    ir.medDispenses.push({
      date: r.whenHandedOver ?? r.whenPrepared ?? r.authorizingPrescription?.[0]?.display,
      medication: med?.text ?? med?.coding?.[0]?.display ?? r.medicationReference?.display,
      quantity,
      daysSupply,
      performer: ensureArray(r.performer)?.[0]?.actor?.display
    });
  },
  ClinicalImpression(r, ir) {
    ir.clinicalImpressions.push({
      date: r.date ?? r.effectiveDateTime ?? r.effectivePeriod?.start,
      summary: r.summary ?? r.description ?? (r.text?.div?.replace(/<[^>]+>/g,'') ?? undefined),
      status: r.status
    });
  },
  Flag(r, ir) {
    ir.flags.push({
      status: r.status,
      code: r.code?.coding?.[0],
      category: ensureArray(r.category)?.[0]?.text ?? ensureArray(r.category)?.[0]?.coding?.[0]?.display,
      periodStart: r.period?.start,
      periodEnd: r.period?.end
    });
  },
  Encounter(r, ir) {
    ir.encounters.push({
      type: r.type?.[0]?.text ?? r.type?.[0]?.coding?.[0]?.display,
      code: r.type?.[0]?.coding?.[0],
      start: r.period?.start,
      end: r.period?.end,
      location: ensureArray(r.location)?.[0]?.location?.display,
      reason: ensureArray(r.reasonCode)?.[0]?.text ?? ensureArray(r.reasonCode)?.[0]?.coding?.[0]?.display
    });
  },
  Procedure(r, ir) {
    ir.procedures.push({
      name: r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Procedure',
      code: r.code?.coding?.[0],
      date: r.performedDateTime ?? r.performedPeriod?.start ?? r.performedString,
      performer: ensureArray(r.performer)?.[0]?.actor?.display
    });
  },
  Device(r, ir) {
    const name = r.deviceName?.[0]?.name || r.type?.text || r.type?.coding?.[0]?.display || 'Device';
    ir.devices.push({
      name,
      code: r.type?.coding?.[0],
      status: r.status,
      udi: r.udiCarrier?.[0]?.deviceIdentifier || r.udiCarrier?.[0]?.carrierHRF
    });
  },
  DocumentReference(r, ir) {
    const att = ensureArray(r.content)?.[0]?.attachment;
    ir.documents.push({
      title: r.description || att?.title || 'Document',
      type: r.type?.coding?.[0],
      date: r.date,
      url: att?.url
    });
  },
  DiagnosticReport(r, ir) {
    ir.reports.push({
      name: r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Report',
      code: r.code?.coding?.[0],
      date: r.effectiveDateTime ?? r.issued,
      resultRefs: ensureArray(r.result)?.map((x:any)=> x?.reference || x?.display).filter(Boolean)
    });
  },
  Condition(r, ir) {
    ir.conditions.push({
      name: r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Condition',
      code: r.code?.coding?.[0],
      onset: r.onsetDateTime ?? r.onsetPeriod?.start,
      abatement: r.abatementDateTime ?? r.abatementPeriod?.end,
      clinicalStatus: r.clinicalStatus?.coding?.[0]?.code,
      verificationStatus: r.verificationStatus?.coding?.[0]?.code
    });
  },
  AllergyIntolerance(r, ir) {
    const cc = r.code ?? r.substance; // FHIR R4 uses code; DSTU had substance
    const reaction = ensureArray(r.reaction)[0];
    ir.allergies.push({
      name: cc?.text ?? cc?.coding?.[0]?.display ?? 'Allergy',
      code: cc?.coding?.[0],
      reaction: reaction?.manifestation?.[0]?.text ?? reaction?.manifestation?.[0]?.coding?.[0]?.display,
      status: r.clinicalStatus?.coding?.[0]?.code ?? r.verificationStatus?.coding?.[0]?.code ?? r.status,
      criticality: r.criticality
    });
  },
  ImagingStudy(r, ir) {
    const modality = (r.modalities?.[0]?.coding?.[0]?.display) || (r.series?.[0]?.modality?.display) || (r.series?.[0]?.modality?.code);
    const bodySite = r.series?.[0]?.bodySite?.display || r.series?.[0]?.bodySite?.code;
    const seriesCount = Array.isArray(r.series) ? r.series.length : (r.numberOfSeries ?? undefined);
    const instanceCount = Array.isArray(r.series) ? r.series.reduce((n:number,s:any)=> n + (Array.isArray(s.instance)? s.instance.length : 0), 0) : (r.numberOfInstances ?? undefined);
    ir.imaging.push({ modality, bodySite, started: r.started, description: r.description, series: seriesCount, instances: instanceCount });
  },
  ServiceRequest(r, ir) {
    ir.serviceRequests.push({
      name: r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Service request',
      code: r.code?.coding?.[0],
      status: r.status,
      date: r.authoredOn ?? r.occurrenceDateTime ?? r.occurrencePeriod?.start,
      requester: r.requester?.display
    });
  },
  Appointment(r, ir) {
    const type = r.appointmentType?.text ?? r.appointmentType?.coding?.[0]?.display;
    const reason = (r.reasonCode?.[0]?.text) ?? (r.reasonCode?.[0]?.coding?.[0]?.display);
    const loc = ensureArray(r.participant).find((p:any)=> p.actor?.display && /location/i.test(p.actor?.reference || ''))?.actor?.display
      || ensureArray(r.participant).find((p:any)=> p.actor?.display)?.actor?.display;
    ir.appointments.push({ start: r.start, end: r.end, status: r.status, type, reason, location: loc });
  },
  Organization(r, ir) {
    ir.organizations.push({ name: r.name, type: r.type?.[0]?.text ?? r.type?.[0]?.coding?.[0]?.display, telecom: r.telecom?.[0]?.value });
  },
  Practitioner(r, ir) {
    const n = r.name?.[0];
    const name = n?.text ?? [ensureArray(n?.given).join(' '), n?.family].filter(Boolean).join(' ');
    ir.practitioners.push({ name, specialty: r.qualification?.[0]?.code?.text ?? r.qualification?.[0]?.code?.coding?.[0]?.display, telecom: r.telecom?.[0]?.value });
  },
  PractitionerRole(r, ir) {
    ir.practitionerRoles.push({
      practitioner: r.practitioner?.display,
      organization: r.organization?.display,
      specialty: ensureArray(r.specialty)?.[0]?.text ?? ensureArray(r.specialty)?.[0]?.coding?.[0]?.display,
      location: ensureArray(r.location)?.[0]?.display
    });
  },
  Location(r, ir) {
    const addr = r.address ? [ensureArray(r.address.line).join(' '), r.address.city, r.address.state, r.address.postalCode].filter(Boolean).join(', ') : undefined;
    ir.locations.push({ name: r.name, type: r.type?.[0]?.text ?? r.type?.[0]?.coding?.[0]?.display, address: addr, telecom: r.telecom?.[0]?.value });
  },
  RelatedPerson(r, ir) {
    const n = r.name?.[0];
    const name = n?.text ?? [ensureArray(n?.given).join(' '), n?.family].filter(Boolean).join(' ');
    ir.relatedPersons.push({ name, relationship: r.relationship?.[0]?.coding?.[0]?.display ?? r.relationship?.[0]?.text, telecom: r.telecom?.[0]?.value });
  },
  RiskAssessment(r, ir) {
    const pred = ensureArray(r.prediction)?.[0];
    const prob = pred?.probabilityString ?? (typeof pred?.probabilityDecimal === 'number' ? `${Math.round(pred.probabilityDecimal*100)}%` : undefined);
    ir.riskAssessments.push({ name: r.code?.text ?? r.code?.coding?.[0]?.display ?? r.condition?.text ?? r.condition?.coding?.[0]?.display ?? 'Risk Assessment', date: r.occurrenceDateTime ?? r.occurrencePeriod?.start, summary: r.text?.div?.replace(/<[^>]+>/g,'') || undefined, probability: prob });
  },
  MedicationStatement(r, ir) {
    const med = r.medicationCodeableConcept ?? r.medication?.codeableConcept;
    ir.medications.push({ name: med?.text ?? med?.coding?.[0]?.display ?? 'Medication', code: med?.coding?.[0], status: r.status, dosage: r.dosage?.[0]?.text, start: r.effectivePeriod?.start, end: r.effectivePeriod?.end });
  },
  MedicationRequest(r, ir) {
    const med = r.medicationCodeableConcept ?? r.medication?.codeableConcept;
    ir.medications.push({ name: med?.text ?? med?.coding?.[0]?.display ?? 'Medication', code: med?.coding?.[0], status: r.status, dosage: r.dosageInstruction?.[0]?.text, start: r.authoredOn });
  },
  Immunization(r, ir) {
    const vc = r.vaccineCode;
    ir.immunizations.push({
      name: vc?.text ?? vc?.coding?.[0]?.display ?? 'Immunization',
      code: vc?.coding?.[0],
      status: r.status,
      date: r.occurrenceDateTime ?? r.occurrenceString ?? r.date
    });
  },
  Observation(r, ir) {
    const cat = ensureArray(r.category).flatMap((c:any)=> ensureArray(c.coding));
    const isLab = cat.some((cc:any)=> /laboratory/i.test(cc?.code || cc?.display || ''));
    const isVital = cat.some((cc:any)=> /vital/i.test(cc?.code || cc?.display || ''));
    const isSocial = cat.some((cc:any)=> /social\-history/i.test(cc?.code || cc?.display || ''));
    const t = r.effectiveDateTime ?? r.issued ?? r.meta?.lastUpdated;
    if (isSocial) {
      const name = r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Social history';
      let value: any = r.valueString ?? r.valueBoolean ?? r.valueInteger ?? r.valueDecimal ?? undefined;
      if (value === true) value = 'Yes';
      if (value === false) value = 'No';
      if (value === undefined) {
        const cc = r.valueCodeableConcept?.text ?? r.valueCodeableConcept?.coding?.[0]?.display;
        const qty = r.valueQuantity ? `${r.valueQuantity.value ?? ''} ${r.valueQuantity.unit ?? ''}`.trim() : undefined;
        value = cc ?? qty ?? undefined;
      }
      ir.socialHistory.push({ name, value: value?.toString(), date: t });
    }
    if (!isLab && !isVital) return;
    const name = r.code?.text ?? r.code?.coding?.[0]?.display ?? (isVital ? 'Vital' : 'Lab');
    const unit = r.valueQuantity?.unit;
    const rawVal = r.valueQuantity?.value;
    const v = typeof rawVal === 'number' ? rawVal : Number(rawVal);
    if (!Number.isFinite(v)) return;
    if (isLab) {
      let panel = ir.labs.find(p => p.name === name);
      if (!panel) { ir.labs.push(panel = { name, code: r.code?.coding?.[0], points: [] }); }
      panel.points.push({ t, v, unit });
    }
    if (isVital) {
      let panel = ir.vitals.find(p => p.name === name);
      if (!panel) { ir.vitals.push(panel = { name, code: r.code?.coding?.[0], points: [] }); }
      panel.points.push({ t, v, unit });
    }
  },
  NutritionOrder(r, ir) {
    const diet = ensureArray(r.oralDiet?.type).map((t:any)=> t.text ?? t.coding?.[0]?.display).filter(Boolean).join(', ');
    const instruction = r.oralDiet?.instruction?.text ?? r.note?.[0]?.text;
    ir.nutritionOrders.push({ date: r.dateTime, status: r.status, diet: diet || undefined, instruction });
  },
  CarePlan(r, ir) {
    ir.carePlans.push({
      title: r.title ?? r.description ?? 'Care Plan',
      status: r.status,
      start: r.period?.start,
      end: r.period?.end,
      activities: ensureArray(r.activity).map((a:any)=> a.detail?.description || a.detail?.code?.text || a.detail?.code?.coding?.[0]?.display).filter(Boolean)
    });
  },
  Goal(r, ir) {
    ir.goals.push({
      description: r.description?.text ?? r.description ?? 'Goal',
      status: r.lifecycleStatus ?? r.status,
      target: ensureArray(r.target)?.[0]?.detailString ?? ensureArray(r.target)?.[0]?.detailQuantity?.value?.toString(),
      due: ensureArray(r.target)?.[0]?.dueDate
    });
  },
  FamilyMemberHistory(r, ir) {
    ir.familyHistory.push({
      relation: r.relationship?.text ?? r.relationship?.coding?.[0]?.display,
      condition: ensureArray(r.condition)?.[0]?.code?.text ?? ensureArray(r.condition)?.[0]?.code?.coding?.[0]?.display,
      onset: ensureArray(r.condition)?.[0]?.onsetAge?.value?.toString() ?? ensureArray(r.condition)?.[0]?.onsetString
    });
  },
  QuestionnaireResponse(r, ir) {
    const title = r.questionnaire?.display || r.questionnaire?.reference || 'Questionnaire';
    const parts: string[] = [];
    for (const it of ensureArray(r.item)) {
      const text = it.text;
      const ans = ensureArray(it.answer).map((a:any)=> a.valueString ?? a.valueCoding?.display ?? a.valueInteger ?? a.valueDecimal).filter((x:any)=> x!==undefined).join(', ');
      if (text || ans) parts.push([text, ans].filter(Boolean).join(': '));
    }
    ir.questionnaires.push({ title, date: r.authored, summary: parts.join(' | ') });
  },
  Coverage(r, ir) {
    ir.coverage.push({
      payor: ensureArray(r.payor)?.[0]?.display,
      type: r.type?.text ?? r.type?.coding?.[0]?.display,
      status: r.status,
      start: r.period?.start,
      end: r.period?.end,
      memberId: r.subscriberId || r.beneficiary?.identifier?.value
    });
  },
  ExplanationOfBenefit(r, ir) {
    const insurerPaid = r.payment?.amount ? `${r.payment.amount.value ?? ''} ${r.payment.amount.currency ?? ''}`.trim() : undefined;
    const patientPaid = r.benefitBalance?.[0]?.financial?.[0]?.usedMoney ? `${r.benefitBalance[0].financial[0].usedMoney.value} ${r.benefitBalance[0].financial[0].usedMoney.currency}` : undefined;
    ir.eobs.push({
      type: r.type?.text ?? r.type?.coding?.[0]?.display,
      status: r.status,
      periodStart: r.billablePeriod?.start,
      periodEnd: r.billablePeriod?.end,
      insurerPaid,
      patientPaid,
      claimId: r.claim?.reference
    });
  },
  Claim(r, ir) {
    ir.claims.push({ type: r.type?.text ?? r.type?.coding?.[0]?.display, status: r.status, created: r.created, provider: r.provider?.display });
  },
  ClaimResponse(r, ir) {
    ir.claimResponses.push({ status: r.status, outcome: r.outcome?.text ?? r.outcome?.coding?.[0]?.display, created: r.created });
  },
  PaymentNotice(r, ir) {
    const amt = r.amount ? `${r.amount.value ?? ''} ${r.amount.currency ?? ''}`.trim() : undefined;
    ir.paymentNotices.push({ amount: amt, date: r.created, provider: r.provider?.display });
  },
  PaymentReconciliation(r, ir) {
    const total = r.total ? `${r.total.value ?? ''} ${r.total.currency ?? ''}`.trim() : undefined;
    ir.paymentReconciliations.push({ total, date: r.created, disposition: r.disposition });
  },
  CoverageEligibilityRequest(r, ir) {
    ir.eligibilities.push({ status: r.status, created: r.created, service: r.purpose?.[0], periodStart: r.servicedPeriod?.start, periodEnd: r.servicedPeriod?.end });
  },
  CoverageEligibilityResponse(r, ir) {
    ir.eligibilities.push({ status: r.status, outcome: r.outcome?.text ?? r.outcome?.coding?.[0]?.display, created: r.created, service: r.purpose?.[0] });
  },
  Consent(r, ir) {
    ir.consents.push({ scope: r.scope?.text ?? r.scope?.coding?.[0]?.display, category: r.category?.[0]?.text ?? r.category?.[0]?.coding?.[0]?.display, date: r.dateTime, performer: r.performer?.[0]?.display });
  },
  AuditEvent(r, ir) {
    ir.auditEvents.push({ type: r.type?.text ?? r.type?.coding?.[0]?.display, action: r.action, date: r.recorded, outcome: r.outcome?.text ?? r.outcome?.display });
  },
  Communication(r, ir) {
    const subject = r.subject?.display;
    const summary = r.payload?.map((p:any)=> p.contentString || p.contentAttachment?.title).filter(Boolean).join(' | ');
    ir.communications.push({ sent: r.sent, received: r.received, subject, summary });
  },
  CommunicationRequest(r, ir) {
    const summary = r.payload?.map((p:any)=> p.contentString || p.contentAttachment?.title).filter(Boolean).join(' | ');
    ir.communicationRequests.push({ authoredOn: r.authoredOn, status: r.status, requester: r.requester?.display, summary });
  },
  CareTeam(r, ir) {
    const members = ensureArray(r.participant).map((p:any)=> p.member?.display).filter(Boolean);
    ir.careTeamsRes.push({ name: r.name, status: r.status, periodStart: r.period?.start, periodEnd: r.period?.end, members });
  },
  Task(r, ir) {
    ir.tasks.push({ status: r.status, intent: r.intent, authoredOn: r.authoredOn, for: r.for?.display, description: r.description });
  },
  AppointmentResponse(r, ir) {
    ir.appointmentResponses.push({ actor: r.actor?.display, start: r.start, end: r.end, participantStatus: r.participantStatus });
  }
};

export const defaultHandler: Handler = (r, ir) => { (ir._raw ??= {}).fhir ??= []; ir._raw!.fhir!.push(r); };

export function registerHandler(resourceType: string, handler: Handler) { handlers[resourceType] = handler; }
export function listHandlers(): string[] { return Object.keys(handlers); }
