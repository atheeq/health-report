import type { IR } from '../core/model';
import { toIR } from '../core/compose';
import type { ChartProvider } from '../charts/types';
import { tableForSeries } from '../charts/svg';
import type { TooltipProvider } from '../llm/types';
import { esc } from '../core/util';

export type Templates = {
  header: (ir: IR) => string;
  toc?: (items: Array<{ id: string; title: string }>) => string;
  alerts?: (ir: IR) => string;
  summary?: (ir: IR) => string;
  medications: (ir: IR, ctx: Ctx) => string;
  medicationEvents: (ir: IR, ctx: Ctx) => string;
  conditions: (ir: IR, ctx: Ctx) => string;
  encounters: (ir: IR, ctx: Ctx) => string;
  appointments: (ir: IR, ctx: Ctx) => string;
  procedures: (ir: IR, ctx: Ctx) => string;
  devices: (ir: IR, ctx: Ctx) => string;
  documents: (ir: IR, ctx: Ctx) => string;
  reports: (ir: IR, ctx: Ctx) => string;
  allergies: (ir: IR, ctx: Ctx) => string;
  immunizations: (ir: IR, ctx: Ctx) => string;
  labs: (ir: IR, ctx: Ctx) => string;
  vitals: (ir: IR, ctx: Ctx) => string;
  carePlans: (ir: IR, ctx: Ctx) => string;
  goals: (ir: IR, ctx: Ctx) => string;
  familyHistory: (ir: IR, ctx: Ctx) => string;
  socialHistory: (ir: IR, ctx: Ctx) => string;
  coverage: (ir: IR, ctx: Ctx) => string;
  serviceRequests: (ir: IR, ctx: Ctx) => string;
  imaging: (ir: IR, ctx: Ctx) => string;
  questionnaires: (ir: IR, ctx: Ctx) => string;
  careTeam: (ir: IR, ctx: Ctx) => string;
  locations: (ir: IR, ctx: Ctx) => string;
  relatedPersons: (ir: IR, ctx: Ctx) => string;
  riskAssessments: (ir: IR, ctx: Ctx) => string;
  clinicalNotes: (ir: IR, ctx: Ctx) => string;
  nutrition: (ir: IR, ctx: Ctx) => string;
  financial: (ir: IR, ctx: Ctx) => string;
  privacy: (ir: IR, ctx: Ctx) => string;
  ccdaSections?: (ir: IR, ctx: Ctx) => string;
  other?: (ir: IR, ctx: Ctx) => string;
  footer: (ir: IR) => string;
};

export type Ctx = { charts?: ChartProvider | null; tooltips?: TooltipProvider | null };

const defaults: Templates = {
  header: (ir) => {
    const details: string[] = [];
    if (ir.patient?.name) details.push(`<div><strong>Name</strong>: ${esc(ir.patient.name)}</div>`);
    if (ir.patient?.birthDate) {
      const dob = new Date(ir.patient.birthDate);
      const dobStr = isNaN(dob.getTime()) ? esc(ir.patient.birthDate) : esc(dob.toLocaleDateString());
      details.push(`<div><strong>Date of Birth</strong>: ${dobStr}</div>`);
    }
    if (ir.patient?.gender) details.push(`<div><strong>Gender</strong>: ${esc(ir.patient.gender)}</div>`);
    if (ir.patient?.phones?.length) {
      const arr = ir.patient.phones.slice(0,2).map((val, idx) => {
        const label = ir.patient?.phoneLabels?.[idx];
        return label ? `${esc(val)} (${esc(label)})` : esc(val);
      }).filter(Boolean);
      const phones = arr.join(', ');
      if (phones) details.push(`<div><strong>Phone</strong>: ${phones}</div>`);
    } else if (ir.patient?.phone) {
      const label = ir.patient?.phoneLabels?.[0];
      details.push(`<div><strong>Phone</strong>: ${esc(ir.patient.phone)}${label?` (${esc(label)})`:''}</div>`);
    }
    if (ir.patient?.email) details.push(`<div><strong>Email</strong>: ${esc(ir.patient.email)}</div>`);
    if (ir.patient?.address) details.push(`<div><strong>Address</strong>: ${esc(ir.patient.address)}</div>`);
    if (ir.patient?.id) details.push(`<div><strong>Patient ID</strong>: ${esc(ir.patient.id)}</div>`);
    if (ir.patient?.identifiers?.length) {
      const ids = ir.patient.identifiers.slice(0,5).map(id => {
        const label = id.type || id.system;
        return label ? `${esc(id.value || '')} (${esc(label)})` : esc(id.value || '');
      }).filter(Boolean).join(', ');
      if (ids) details.push(`<div><strong>Identifiers</strong>: ${ids}</div>`);
    }
    const info = details.length ? `<div class="hx-patient">${details.join('')}</div>` : '';
    // Age and generated date
    let ageStr = '';
    if (ir.patient?.birthDate) {
      const dob = new Date(ir.patient.birthDate);
      if (!isNaN(dob.getTime())) {
        const diff = Date.now() - dob.getTime();
        const ageDate = new Date(diff);
        const yrs = Math.abs(ageDate.getUTCFullYear() - 1970);
        ageStr = yrs ? ` • ${yrs} yrs` : '';
      }
    }
    const generated = new Date().toLocaleDateString();
    return `<header class="hx-header"><h1>Health Report${ir.patient.name ? ` — ${esc(ir.patient.name)}`:''}${ageStr}</h1><div class="hx-subtle">Generated ${esc(generated)}</div>${info}</header>`;
  },
  toc: (items) => items.length ? `<nav class="hx-toc">${items.map(it=>`<a href="#${esc(it.id)}">${esc(it.title)}</a>`).join('<span class="hx-sep">•</span>')}</nav>` : '',
  alerts: (ir) => {
    const critAllergies = ir.allergies.filter(a=> !!a.criticality);
    const activeFlags = ir.flags.filter(f=> (f.status||'').toLowerCase()==='active');
    if (!critAllergies.length && !activeFlags.length) return '';
    const a = critAllergies.map(a=> `<li><strong>${esc(a.name)}</strong>${a.reaction?` — ${esc(a.reaction)}`:''}${a.criticality?` <span class=\"hx-badge\">${esc(a.criticality)}</span>`:''}</li>`).join('');
    const f = activeFlags.map(fl=> `<li><strong>${esc(fl.code?.display || 'Flag')}</strong>${fl.category?` — ${esc(fl.category)}`:''}${fl.periodEnd?` <span class=\"hx-badge\">until ${esc(new Date(fl.periodEnd).toLocaleDateString())}</span>`:''}</li>`).join('');
    const body = [a?`<h3>Allergy Alerts</h3><ul>${a}</ul>`:'', f?`<h3>Flags</h3><ul>${f}</ul>`:''].filter(Boolean).join('');
    return `<section id=\"alerts\" class=\"hx-section hx-alerts\"><h2>Alerts</h2>${body}</section>`;
  },
  summary: (ir) => {
    function latest<T extends { t: string; v: number }>(points: T[]): T | undefined {
      return points?.slice().sort((a,b)=> (a.t > b.t ? -1 : 1))[0];
    }
    const vit = ir.vitals;
    const labs = ir.labs;
    const lastHR = latest(vit.find(v=> /heart\s*rate|pulse/i.test(v.name))?.points || []);
    const lastBMI = latest(vit.find(v=> /bmi|body\s*mass\s*index/i.test(v.name))?.points || []);
    const lastSBP = latest(vit.find(v=> /systolic|sbp|blood\s*pressure\s*systolic/i.test(v.name))?.points || []);
    const lastDBP = latest(vit.find(v=> /diastolic|dbp|blood\s*pressure\s*diastolic/i.test(v.name))?.points || []);
    const lastA1c = latest(labs.find(l=> /a1c|hemoglobin\s*a1c/i.test(l.name))?.points || []);
    const lastEncounter = ir.encounters.slice().sort((a,b)=> ((a.start||'') > (b.start||'') ? -1 : 1))[0];
    const cards: string[] = [];
    if (lastSBP || lastDBP) cards.push(`<div class="hx-card"><div class="hx-kpi">${esc(lastSBP?.v?.toString() || '?')}/${esc(lastDBP?.v?.toString() || '?')}</div><div class="hx-kpi-label">Blood Pressure</div></div>`);
    if (lastHR) cards.push(`<div class="hx-card"><div class="hx-kpi">${esc(lastHR.v.toString())}</div><div class="hx-kpi-label">Heart Rate</div></div>`);
    if (lastBMI) cards.push(`<div class="hx-card"><div class="hx-kpi">${esc(lastBMI.v.toString())}</div><div class="hx-kpi-label">BMI</div></div>`);
    if (lastA1c) cards.push(`<div class="hx-card"><div class="hx-kpi">${esc(lastA1c.v.toFixed(1))}%</div><div class="hx-kpi-label">A1c</div></div>`);
    if (lastEncounter) cards.push(`<div class="hx-card"><div class="hx-kpi">${esc(new Date(lastEncounter.start||'').toLocaleDateString())}</div><div class="hx-kpi-label">Last Encounter</div></div>`);
    if (!cards.length) return '';
    return `<section id="summary" class="hx-section hx-summary"><h2>Summary</h2><div class="hx-cards">${cards.join('')}</div></section>`;
  },
  medications: (ir) => {
    if (!ir.medications.length) return '';
    const act = ir.medications.filter(m=> /active|current|inprogress/i.test(m.status || ''));
    const inact = ir.medications.filter(m=> !/active|current|inprogress/i.test(m.status || ''));
    const list = (arr:any[]) => `<ul>${arr.map((m:any)=>`<li>${esc(m.name)}${m.dosage?` — ${esc(m.dosage)}`:''}${m.status?` <span class=\"hx-badge\">${esc(m.status)}</span>`:''}</li>`).join('')}</ul>`;
    const body = `<details open><summary>Active</summary>${act.length?list(act):'<div class="hx-empty">None</div>'}</details><details><summary>Inactive</summary>${inact.length?list(inact):'<div class="hx-empty">None</div>'}</details>`;
    return `<section id="medications" class="hx-section hx-meds"><h2>Medications <span class="hx-count">${ir.medications.length}</span></h2>${body}</section>`;
  },
  medicationEvents: (ir) => {
    const admins = ir.medAdministrations.map(e=>`<li>${esc(e.medication || 'Medication')}${e.dose?` — ${esc(e.dose)}`:''}${e.route?` (${esc(e.route)})`:''}${e.date?` — ${esc(new Date(e.date).toLocaleString())}`:''}${e.performer?` — ${esc(e.performer)}`:''}</li>`).join('');
    const disp = ir.medDispenses.map(e=>`<li>${esc(e.medication || 'Medication')}${e.quantity?` — ${esc(e.quantity)}`:''}${e.daysSupply?` — ${esc(e.daysSupply)}`:''}${e.date?` — ${esc(new Date(e.date).toLocaleDateString())}`:''}${e.performer?` — ${esc(e.performer)}`:''}</li>`).join('');
    const body = [admins?`<h3>Administrations</h3><ul>${admins}</ul>`:'', disp?`<h3>Dispenses</h3><ul>${disp}</ul>`:''].filter(Boolean).join('');
    return body ? `<section class="hx-section hx-med-events"><h2>Medication Events</h2>${body}</section>` : '';
  },
  conditions: (ir) => {
    if (!ir.conditions.length) return '';
    const isActive = (s?: string) => /active|relapse|recurrence/i.test(s || '');
    const act = ir.conditions.filter(c=> isActive(c.clinicalStatus));
    const inact = ir.conditions.filter(c=> !isActive(c.clinicalStatus));
    const list = (arr:any[]) => `<ul>${arr.map((c:any)=>`<li>${esc(c.name)}${c.clinicalStatus?` <span class=\"hx-badge\">${esc(c.clinicalStatus)}</span>`:''}</li>`).join('')}</ul>`;
    const body = `<details open><summary>Active</summary>${act.length?list(act):'<div class="hx-empty">None</div>'}</details><details><summary>Inactive</summary>${inact.length?list(inact):'<div class="hx-empty">None</div>'}</details>`;
    return `<section id="conditions" class="hx-section hx-conds"><h2>Conditions <span class="hx-count">${ir.conditions.length}</span></h2>${body}</section>`;
  },
  encounters: (ir) => ir.encounters.length ? `<section id="encounters" class="hx-section hx-encounters"><h2>Encounters <span class="hx-count">${ir.encounters.length}</span></h2><ul>${ir.encounters.map(e=>`<li>${esc(e.type || 'Encounter')}${e.start?` — ${esc(new Date(e.start).toLocaleDateString())}`:''}${e.location?` @ ${esc(e.location)}`:''}</li>`).join('')}</ul></section>` : '',
  appointments: (ir) => ir.appointments.length ? `<section id="appointments" class="hx-section hx-appointments"><h2>Appointments <span class="hx-count">${ir.appointments.length}</span></h2><ul>${ir.appointments.map(a=>`<li>${esc(a.type || 'Appointment')}${a.start?` — ${esc(new Date(a.start).toLocaleString())}`:''}${a.location?` @ ${esc(a.location)}`:''}${a.status?` (${esc(a.status)})`:''}</li>`).join('')}</ul></section>` : '',
  procedures: (ir) => ir.procedures.length ? `<section id="procedures" class="hx-section hx-procedures"><h2>Procedures <span class="hx-count">${ir.procedures.length}</span></h2><ul>${ir.procedures.map(p=>`<li>${esc(p.name)}${p.date?` — ${esc(new Date(p.date).toLocaleDateString())}`:''}${p.performer?` (${esc(p.performer)})`:''}</li>`).join('')}</ul></section>` : '',
  devices: (ir) => ir.devices.length ? `<section id="devices" class="hx-section hx-devices"><h2>Devices <span class="hx-count">${ir.devices.length}</span></h2><ul>${ir.devices.map(d=>`<li>${esc(d.name)}${d.status?` — ${esc(d.status)}`:''}${d.udi?` [${esc(d.udi)}]`:''}</li>`).join('')}</ul></section>` : '',
  documents: (ir) => ir.documents.length ? `<section id="documents" class="hx-section hx-docs"><h2>Documents <span class="hx-count">${ir.documents.length}</span></h2><ul>${ir.documents.map(d=>`<li>${d.url?`<a href="${esc(d.url)}">${esc(d.title)}</a>`:esc(d.title)}${d.date?` — ${esc(new Date(d.date).toLocaleDateString())}`:''}</li>`).join('')}</ul></section>` : '',
  reports: (ir) => ir.reports.length ? `<section id="reports" class="hx-section hx-reports"><h2>Reports <span class="hx-count">${ir.reports.length}</span></h2><ul>${ir.reports.map(r=>`<li>${esc(r.name)}${r.date?` — ${esc(new Date(r.date).toLocaleDateString())}`:''}</li>`).join('')}</ul></section>` : '',
  allergies: (ir) => ir.allergies.length ? `<section id="allergies" class="hx-section hx-allergies"><h2>Allergies <span class="hx-count">${ir.allergies.length}</span></h2><ul>${ir.allergies.map(a=>`<li>${esc(a.name)}${a.reaction?` — ${esc(a.reaction)}`:''}</li>`).join('')}</ul></section>` : '',
  immunizations: (ir) => ir.immunizations.length ? `<section id="immunizations" class="hx-section hx-immunizations"><h2>Immunizations <span class="hx-count">${ir.immunizations.length}</span></h2><ul>${ir.immunizations.map(i=>`<li>${esc(i.name)}${i.date?` — ${esc(new Date(i.date).toLocaleDateString())}`:''}</li>`).join('')}</ul></section>` : '',
  labs: (ir, ctx) => ir.labs.length ? `<section id="labs" class="hx-section hx-labs"><h2>Labs <span class="hx-count">${ir.labs.length}</span></h2>${
    ir.labs.map(p=>{
      const svg = ctx.charts?.line([{ label: p.name, points: p.points.map(pt=> [Date.parse(pt.t)||0, pt.v]) }]);
      return `<div class="hx-lab"><div class="hx-lab-head"><strong>${esc(p.name)}</strong></div>${svg?`<div class="hx-chart">${svg}</div>`:tableForSeries(p)}</div>`;
    }).join('')}</section>` : '',
  vitals: (ir, ctx) => ir.vitals.length ? `<section id="vitals" class="hx-section hx-vitals"><h2>Vitals <span class="hx-count">${ir.vitals.length}</span></h2>${
    ir.vitals.map(p=>{
      const svg = ctx.charts?.line([{ label: p.name, points: p.points.map(pt=> [Date.parse(pt.t)||0, pt.v]) }]);
      return `<div class="hx-vital"><div class="hx-vital-head"><strong>${esc(p.name)}</strong></div>${svg?`<div class="hx-chart">${svg}</div>`:tableForSeries(p as any)}</div>`;
    }).join('')}</section>` : '',
  carePlans: (ir) => ir.carePlans.length ? `<section id="care-plans" class="hx-section hx-careplans"><h2>Care Plans <span class="hx-count">${ir.carePlans.length}</span></h2><ul>${ir.carePlans.map(cp=>`<li>${esc(cp.title)}${cp.start?` — ${esc(new Date(cp.start).toLocaleDateString())}`:''}</li>`).join('')}</ul></section>` : '',
  goals: (ir) => ir.goals.length ? `<section id="goals" class="hx-section hx-goals"><h2>Goals <span class="hx-count">${ir.goals.length}</span></h2><ul>${ir.goals.map(g=>`<li>${esc(g.description)}${g.target?` — ${esc(g.target)}`:''}</li>`).join('')}</ul></section>` : '',
  familyHistory: (ir) => ir.familyHistory.length ? `<section id="family-history" class="hx-section hx-family"><h2>Family History <span class="hx-count">${ir.familyHistory.length}</span></h2><ul>${ir.familyHistory.map(f=>`<li>${esc(f.relation || 'Relative')}${f.condition?`: ${esc(f.condition)}`:''}</li>`).join('')}</ul></section>` : '',
  socialHistory: (ir) => {
    const items = ir.socialHistory.map(s=>`<li>${esc(s.name)}${s.value?` — ${esc(s.value)}`:''}${s.date?` (${esc(new Date(s.date).toLocaleDateString())})`:''}</li>`).join('');
    return items ? `<section id="social-history" class="hx-section hx-social"><h2>Social History</h2><ul>${items}</ul></section>` : '';
  },
  coverage: (ir) => ir.coverage.length ? `<section id="coverage" class="hx-section hx-coverage"><h2>Coverage <span class="hx-count">${ir.coverage.length}</span></h2><ul>${ir.coverage.map(c=>`<li>${esc(c.payor || 'Coverage')}${c.type?` — ${esc(c.type)}`:''}${c.status?` (${esc(c.status)})`:''}</li>`).join('')}</ul></section>` : '',
  serviceRequests: (ir) => ir.serviceRequests.length ? `<section id="service-requests" class="hx-section hx-orders"><h2>Service Requests <span class="hx-count">${ir.serviceRequests.length}</span></h2><ul>${ir.serviceRequests.map(s=>`<li>${esc(s.name)}${s.date?` — ${esc(new Date(s.date).toLocaleDateString())}`:''}${s.status?` (${esc(s.status)})`:''}</li>`).join('')}</ul></section>` : '',
  imaging: (ir) => ir.imaging.length ? `<section id="imaging" class="hx-section hx-imaging"><h2>Imaging <span class="hx-count">${ir.imaging.length}</span></h2><ul>${ir.imaging.map(im=>`<li>${esc(im.modality || 'Imaging')} — ${esc(im.description || im.bodySite || '')}${im.started?` (${esc(new Date(im.started).toLocaleDateString())})`:''}</li>`).join('')}</ul></section>` : '',
  questionnaires: (ir) => ir.questionnaires.length ? `<section id="questionnaires" class="hx-section hx-questionnaires"><h2>Questionnaires <span class="hx-count">${ir.questionnaires.length}</span></h2><ul>${ir.questionnaires.map(q=>`<li><strong>${esc(q.title)}</strong>${q.date?` — ${esc(new Date(q.date).toLocaleDateString())}`:''}${q.summary?` — ${esc(q.summary)}`:''}</li>`).join('')}</ul></section>` : '',
  careTeam: (ir) => (ir.practitioners.length || ir.organizations.length) ? `<section id="care-team" class="hx-section hx-careteam"><h2>Care Team</h2><div class="hx-careteam-grid"><div><h3>Practitioners</h3><ul>${ir.practitioners.map(p=>`<li>${esc(p.name || 'Practitioner')}${p.specialty?` — ${esc(p.specialty)}`:''}${p.telecom?` (${esc(p.telecom)})`:''}</li>`).join('')}</ul></div><div><h3>Organizations</h3><ul>${ir.organizations.map(o=>`<li>${esc(o.name || 'Organization')}${o.type?` — ${esc(o.type)}`:''}${o.telecom?` (${esc(o.telecom)})`:''}</li>`).join('')}</ul></div></div></section>` : '',
  locations: (ir) => ir.locations.length ? `<section id="locations" class="hx-section hx-locations"><h2>Locations <span class="hx-count">${ir.locations.length}</span></h2><ul>${ir.locations.map(l=>`<li>${esc(l.name || 'Location')}${l.address?` — ${esc(l.address)}`:''}${l.telecom?` (${esc(l.telecom)})`:''}</li>`).join('')}</ul></section>` : '',
  relatedPersons: (ir) => ir.relatedPersons.length ? `<section id="related-persons" class="hx-section hx-related"><h2>Related Persons <span class="hx-count">${ir.relatedPersons.length}</span></h2><ul>${ir.relatedPersons.map(rp=>`<li>${esc(rp.name || 'Contact')}${rp.relationship?` — ${esc(rp.relationship)}`:''}${rp.telecom?` (${esc(rp.telecom)})`:''}</li>`).join('')}</ul></section>` : '',
  riskAssessments: (ir) => ir.riskAssessments.length ? `<section id="risk-assessments" class="hx-section hx-risk"><h2>Risk Assessments <span class="hx-count">${ir.riskAssessments.length}</span></h2><ul>${ir.riskAssessments.map(ra=>`<li>${esc(ra.name)}${ra.probability?` — ${esc(ra.probability)}`:''}${ra.date?` (${esc(new Date(ra.date).toLocaleDateString())})`:''}${ra.summary?` — ${esc(ra.summary)}`:''}</li>`).join('')}</ul></section>` : '',
  clinicalNotes: (ir) => {
    const imps = ir.clinicalImpressions.map(ci=>`<li>${ci.date?`${esc(new Date(ci.date).toLocaleDateString())}: `:''}${esc(ci.summary || 'Clinical impression')}${ci.status?` (${esc(ci.status)})`:''}</li>`).join('');
    const flgs = ir.flags.map(f=>`<li>${f.periodStart?`${esc(new Date(f.periodStart).toLocaleDateString())}: `:''}${f.code?.display?esc(f.code.display):'Flag'}${f.category?` — ${esc(f.category)}`:''}${f.status?` (${esc(f.status)})`:''}${f.periodEnd?` — until ${esc(new Date(f.periodEnd).toLocaleDateString())}`:''}</li>`).join('');
    const body = [imps?`<h3>Clinical Impressions</h3><ul>${imps}</ul>`:'', flgs?`<h3>Flags</h3><ul>${flgs}</ul>`:''].filter(Boolean).join('');
    return body ? `<section id="clinical-notes" class="hx-section hx-clinical"><h2>Clinical Notes & Flags</h2>${body}</section>` : '';
  },
  nutrition: (ir) => {
    const items = ir.nutritionOrders.map(n=>`<li>${esc(n.diet || 'Nutrition order')}${n.instruction?` — ${esc(n.instruction)}`:''}${n.date?` (${esc(new Date(n.date).toLocaleDateString())})`:''}${n.status?` (${esc(n.status)})`:''}</li>`).join('');
    return items ? `<section id="nutrition" class="hx-section hx-nutrition"><h2>Nutrition</h2><ul>${items}</ul></section>` : '';
  },
  financial: (ir) => {
    const eobs = ir.eobs.map(e=>`<li><strong>EOB</strong>: ${esc(e.type || 'Explanation of Benefit')}${e.periodStart?` — Period ${esc(new Date(e.periodStart).toLocaleDateString())}${e.periodEnd?`–${esc(new Date(e.periodEnd).toLocaleDateString())}`:''}`:''}${e.insurerPaid?` — Insurer ${esc(e.insurerPaid)}`:''}${e.patientPaid?` — Patient ${esc(e.patientPaid)}`:''}</li>`).join('');
    const claims = ir.claims.map(c=>`<li><strong>Claim</strong>: ${esc(c.type || 'Claim')}${c.created?` — ${esc(new Date(c.created).toLocaleDateString())}`:''}${c.status?` (${esc(c.status)})`:''}</li>`).join('');
    const crs = ir.claimResponses.map(c=>`<li><strong>Claim Response</strong>: ${c.created?esc(new Date(c.created).toLocaleDateString()):''}${c.outcome?` — ${esc(c.outcome)}`:''}</li>`).join('');
    const pns = ir.paymentNotices.map(p=>`<li><strong>Payment Notice</strong>: ${p.date?esc(new Date(p.date).toLocaleDateString()):''}${p.amount?` — ${esc(p.amount)}`:''}</li>`).join('');
    const prs = ir.paymentReconciliations.map(p=>`<li><strong>Reconciliation</strong>: ${p.date?esc(new Date(p.date).toLocaleDateString()):''}${p.total?` — ${esc(p.total)}`:''}</li>`).join('');
    const elig = ir.eligibilities.map(e=>`<li><strong>Eligibility</strong>: ${e.created?esc(new Date(e.created).toLocaleDateString()):''}${e.outcome?` — ${esc(e.outcome)}`:''}${e.service?` — ${esc(e.service)}`:''}</li>`).join('');
    const all = [eobs, claims, crs, pns, prs, elig].filter(Boolean).join('');
    return all ? `<section id="financial" class="hx-section hx-financial"><h2>Financial</h2><ul>${all}</ul></section>` : '';
  },
  privacy: (ir) => {
    const cons = ir.consents.map(c=>`<li><strong>Consent</strong>: ${esc(c.scope || 'Consent')}${c.category?` — ${esc(c.category)}`:''}${c.date?` (${esc(new Date(c.date).toLocaleDateString())})`:''}</li>`).join('');
    const aud = ir.auditEvents.map(a=>`<li><strong>Audit</strong>: ${esc(a.type || 'Event')}${a.action?` — ${esc(a.action)}`:''}${a.date?` (${esc(new Date(a.date).toLocaleString())})`:''}${a.outcome?` — ${esc(a.outcome)}`:''}</li>`).join('');
    const comms = ir.communications.map(c=>`<li><strong>Message</strong>: ${c.sent?esc(new Date(c.sent).toLocaleString()):''}${c.summary?` — ${esc(c.summary)}`:''}</li>`).join('');
    const commReqs = ir.communicationRequests.map(c=>`<li><strong>Message Request</strong>: ${c.authoredOn?esc(new Date(c.authoredOn).toLocaleDateString()):''}${c.status?` (${esc(c.status)})`:''}${c.summary?` — ${esc(c.summary)}`:''}</li>`).join('');
    const all = [cons, aud, comms, commReqs].filter(Boolean).join('');
    return all ? `<section id="privacy" class="hx-section hx-privacy"><h2>Privacy & Activity</h2><ul>${all}</ul></section>` : '';
  },
  ccdaSections: (ir) => {
    const counts = ir.other?.ccdaCounts || {};
    const entries = Object.entries(counts);
    if (!entries.length) return '';
    const lis = entries.sort((a,b)=> a[0].localeCompare(b[0])).map(([k,v])=> `<li><code>${esc(k)}</code>: ${v}</li>`).join('');
    return `<section id="ccda-sections" class="hx-section hx-ccda"><h2>CCDA Sections Present</h2><ul>${lis}</ul></section>`;
  },
  other: (ir) => {
    const entries = Object.entries(ir.other?.fhirCounts || {});
    if (!entries.length) return '';
    const lis = entries.sort((a,b)=> a[0].localeCompare(b[0])).map(([k,v])=> `<li><code>${esc(k)}</code>: ${v}</li>`).join('');
    return `<section id="resources-present" class="hx-section hx-other"><h2>Resources Present</h2><ul>${lis}</ul></section>`;
  },
  footer: () => `<footer class="hx-footer"><small>Generated by @healthex/health-report</small></footer>`
};

export interface RenderOptions {
  templates?: Partial<Templates>;
  charts?: ChartProvider | null;
  tooltips?: TooltipProvider | null;
  themeCss?: string;
  hiddenSections?: string[];
}

const minimalCss = `
:root{--hx-font:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;--hx-accent:#2563eb;--hx-muted:#6b7280}
html,body{height:100%}
body{font-family:var(--hx-font);color:#111;line-height:1.5;margin:16px;max-width:900px}
.hx-header h1{font-size:1.7rem;color:var(--hx-accent);margin:0 0 8px}
.hx-subtle{color:var(--hx-muted);font-size:.9rem;margin-bottom:8px}
.hx-header .hx-patient{margin-top:6px;color:#333;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:4px 16px}
.hx-header .hx-patient div{margin:2px 0}
.hx-toc{display:flex;flex-wrap:wrap;gap:8px 12px;margin:10px 0 18px}
.hx-toc a{color:#111;text-decoration:none;border:1px solid #e5e7eb;padding:4px 8px;border-radius:16px;font-size:.9rem}
.hx-toc a:hover{background:#f8fafc}
.hx-sep{color:#e5e7eb}
.hx-section{margin:18px 0;padding:12px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
.hx-section h2{font-size:1.1rem;border-bottom:1px solid #eee;padding-bottom:6px;margin:0 0 10px;display:flex;align-items:center;gap:8px}
.hx-count{font-size:.85rem;color:#374151;background:#eef2ff;border:1px solid #dbeafe;border-radius:999px;padding:2px 8px}
.hx-badge{font-size:.75rem;color:#374151;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:1px 6px;margin-left:6px}
.hx-badge.hx-danger{color:#7f1d1d;background:#fee2e2;border-color:#fecaca}
.hx-card{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;min-width:140px;flex:1}
.hx-cards{display:flex;gap:10px;flex-wrap:wrap}
.hx-kpi{font-size:1.4rem;font-weight:600;color:#111}
.hx-kpi-label{font-size:.9rem;color:var(--hx-muted)}
details{margin:8px 0}
details summary{cursor:pointer;font-weight:600;margin-bottom:6px}
.hx-empty{color:var(--hx-muted);font-size:.9rem}
.hx-note{color:var(--hx-muted);font-size:.9rem;margin:-4px 0 8px}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #e5e7eb;padding:6px;text-align:left}
@media print{body{margin:10mm;max-width:none}.hx-section{break-inside:avoid;page-break-inside:avoid}}
`;

export async function renderHtml(input: object|string, opts: RenderOptions = {}): Promise<string> {
  const ir = await toIR(input);
  const t = { ...defaults, ...opts.templates };
  const css = opts.themeCss ?? minimalCss;
  const ctx: Ctx = { charts: opts.charts ?? null, tooltips: opts.tooltips ?? null };
  const hidden = new Set(opts.hiddenSections ?? []);
  const parts: Array<[string, string]> = [
    ['header', t.header(ir)],
    ['alerts', (t as any).alerts ? (t as any).alerts(ir) : ''],
    ['summary', (t as any).summary ? (t as any).summary(ir) : ''],
    ['encounters', t.encounters(ir, ctx)],
    ['appointments', t.appointments(ir, ctx)],
    ['conditions', t.conditions(ir, ctx)],
    ['medications', t.medications(ir, ctx)],
    ['medicationEvents', t.medicationEvents(ir, ctx)],
    ['allergies', t.allergies(ir, ctx)],
    ['immunizations', t.immunizations(ir, ctx)],
    ['procedures', t.procedures(ir, ctx)],
    ['devices', t.devices(ir, ctx)],
    ['serviceRequests', t.serviceRequests(ir, ctx)],
    ['imaging', t.imaging(ir, ctx)],
    ['vitals', t.vitals(ir, ctx)],
    ['labs', t.labs(ir, ctx)],
    ['carePlans', t.carePlans(ir, ctx)],
    ['goals', t.goals(ir, ctx)],
    ['familyHistory', t.familyHistory(ir, ctx)],
    ['socialHistory', t.socialHistory(ir, ctx)],
    ['coverage', t.coverage(ir, ctx)],
    ['financial', t.financial(ir, ctx)],
    ['documents', t.documents(ir, ctx)],
    ['reports', t.reports(ir, ctx)],
    ['questionnaires', t.questionnaires(ir, ctx)],
    ['nutrition', t.nutrition(ir, ctx)],
    ['clinicalNotes', t.clinicalNotes(ir, ctx)],
    ['privacy', t.privacy(ir, ctx)],
    ['careTeam', t.careTeam(ir, ctx)],
    ['locations', t.locations(ir, ctx)],
    ['relatedPersons', t.relatedPersons(ir, ctx)],
    ['riskAssessments', t.riskAssessments(ir, ctx)],
    ['ccdaSections', (t as any).ccdaSections ? (t as any).ccdaSections(ir, ctx) : ''],
    ['other', (t as any).other ? (t as any).other(ir, ctx) : ''],
    ['footer', t.footer(ir)]
  ];
  // Build TOC from visible sections
  const titleMap: Record<string,string> = {
    alerts:'Alerts', summary:'Summary', encounters: 'Encounters', appointments: 'Appointments', conditions: 'Conditions', medications: 'Medications', medicationEvents: 'Medication Events', allergies: 'Allergies', immunizations: 'Immunizations', procedures: 'Procedures', devices: 'Devices', serviceRequests: 'Service Requests', imaging: 'Imaging', vitals: 'Vitals', labs: 'Labs', carePlans: 'Care Plans', goals: 'Goals', familyHistory: 'Family History', socialHistory: 'Social History', coverage: 'Coverage', financial: 'Financial', documents: 'Documents', reports: 'Reports', questionnaires: 'Questionnaires', nutrition: 'Nutrition', clinicalNotes: 'Clinical Notes & Flags', privacy: 'Privacy & Activity', careTeam: 'Care Team', locations: 'Locations', relatedPersons: 'Related Persons', riskAssessments: 'Risk Assessments', ccdaSections: 'CCDA Sections Present', other: 'Resources Present'
  };
  const idMap: Record<string,string> = {
    alerts:'alerts', summary:'summary', encounters:'encounters', appointments:'appointments', conditions:'conditions', medications:'medications', medicationEvents:'med-events', allergies:'allergies', immunizations:'immunizations', procedures:'procedures', devices:'devices', serviceRequests:'service-requests', imaging:'imaging', vitals:'vitals', labs:'labs', carePlans:'care-plans', goals:'goals', familyHistory:'family-history', socialHistory:'social-history', coverage:'coverage', financial:'financial', documents:'documents', reports:'reports', questionnaires:'questionnaires', nutrition:'nutrition', clinicalNotes:'clinical-notes', privacy:'privacy', careTeam:'care-team', locations:'locations', relatedPersons:'related-persons', riskAssessments:'risk-assessments', ccdaSections:'ccda-sections', other:'resources-present'
  };
  const visible = parts.filter(([name, html]) => !hidden.has(name) && html && html.length > 0 && name !== 'header' && name !== 'footer');
  const tocItems = visible.map(([name]) => ({ id: idMap[name] || name, title: titleMap[name] || name })).filter(it => Boolean(it.id));
  if (t.toc && tocItems.length) parts.splice(1, 0, ['toc', t.toc(tocItems)]);
  const body = parts.filter(([name, html]) => !hidden.has(name) && html && html.length > 0).map(([, html]) => html).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Health Report${ir.patient.name?` — ${esc(ir.patient.name)}`:''}</title>
<style>${css}</style></head><body>
${body}
</body></html>`;
}
