export type Code = { system?: string; code?: string; display?: string };
export type Medication = { name: string; code?: Code; status?: string; dosage?: string; start?: string; end?: string };
export type Condition = { name: string; code?: Code; onset?: string; abatement?: string; clinicalStatus?: string; verificationStatus?: string; stage?: string; abatementReason?: string };
export type Allergy = { name: string; code?: Code; reaction?: string; status?: string; criticality?: string };
export type Immunization = { name: string; code?: Code; date?: string; status?: string };
export type Encounter = { type?: string; code?: Code; start?: string; end?: string; location?: string; reason?: string };
export type Procedure = { name: string; code?: Code; date?: string; performer?: string };
export type Device = { name: string; code?: Code; status?: string; udi?: string };
export type Document = { title: string; type?: Code; date?: string; url?: string };
export type DiagnosticReport = { name: string; code?: Code; date?: string; resultRefs?: string[] };
export type LabPoint = { t: string; v: number; unit?: string };
export type LabPanel = { name: string; code?: Code; points: LabPoint[] };
export type VitalPanel = { name: string; code?: Code; points: LabPoint[] };
export type Identifier = { system?: string; value?: string; type?: string };
export type Patient = {
  id?: string;
  name?: string;
  birthDate?: string;
  gender?: string;
  phones?: string[];
  phone?: string;
  phoneLabels?: string[];
  email?: string;
  address?: string;
  identifiers?: Identifier[];
};
export type CarePlan = { title: string; status?: string; start?: string; end?: string; activities?: string[] };
export type Goal = { description: string; status?: string; target?: string; due?: string };
export type FamilyHistory = { relation?: string; condition?: string; onset?: string };
export type Questionnaire = { title: string; date?: string; summary?: string };
export type Coverage = { payor?: string; type?: string; status?: string; start?: string; end?: string; memberId?: string };
export type Imaging = { modality?: string; bodySite?: string; started?: string; description?: string; series?: number; instances?: number };
export type ServiceRequest = { name: string; code?: Code; date?: string; status?: string; requester?: string };
export type Appointment = { start?: string; end?: string; status?: string; type?: string; reason?: string; location?: string };
export type Organization = { name: string; type?: string; telecom?: string };
export type Practitioner = { name: string; specialty?: string; telecom?: string };
export type PractitionerRole = { practitioner?: string; organization?: string; specialty?: string; location?: string };
export type Location = { name?: string; type?: string; address?: string; telecom?: string };
export type RelatedPerson = { name?: string; relationship?: string; telecom?: string };
export type RiskAssessment = { name: string; date?: string; summary?: string; probability?: string };
export type OtherSummary = { fhirCounts: Record<string, number>; ccdaCounts?: Record<string, number> };
export type MedicationAdministrationEvent = { date?: string; medication?: string; dose?: string; route?: string; performer?: string };
export type MedicationDispenseEvent = { date?: string; medication?: string; quantity?: string; daysSupply?: string; performer?: string };
export type ClinicalImpression = { date?: string; summary?: string; status?: string };
export type Flag = { status?: string; code?: Code; category?: string; periodStart?: string; periodEnd?: string };
// Financial
export type ExplanationOfBenefit = { type?: string; status?: string; periodStart?: string; periodEnd?: string; insurerPaid?: string; patientPaid?: string; claimId?: string };
export type Claim = { type?: string; status?: string; created?: string; provider?: string };
export type ClaimResponse = { status?: string; outcome?: string; created?: string };
export type PaymentNotice = { amount?: string; date?: string; provider?: string };
export type PaymentReconciliation = { total?: string; date?: string; disposition?: string };
export type Eligibility = { status?: string; outcome?: string; created?: string; service?: string; periodStart?: string; periodEnd?: string };
// Privacy/Security
export type Consent = { scope?: string; category?: string; date?: string; performer?: string };
export type AuditEvent = { type?: string; action?: string; date?: string; outcome?: string };
// Communication/Workflow
export type Communication = { sent?: string; received?: string; subject?: string; summary?: string };
export type CommunicationRequest = { authoredOn?: string; status?: string; requester?: string; summary?: string };
export type CareTeamRes = { name?: string; status?: string; periodStart?: string; periodEnd?: string; members?: string[] };
export type Task = { status?: string; intent?: string; authoredOn?: string; for?: string; description?: string };
export type AppointmentResponse = { actor?: string; start?: string; end?: string; participantStatus?: string };
// Lifestyle / Orders
export type SocialHistory = { name: string; value?: string; date?: string };
export type NutritionOrder = { date?: string; status?: string; diet?: string; instruction?: string };

export type IR = {
  patient: Patient;
  medications: Medication[];
  conditions: Condition[];
  allergies: Allergy[];
  immunizations: Immunization[];
  encounters: Encounter[];
  procedures: Procedure[];
  devices: Device[];
  documents: Document[];
  reports: DiagnosticReport[];
  labs: LabPanel[];
  vitals: VitalPanel[];
  carePlans: CarePlan[];
  goals: Goal[];
  familyHistory: FamilyHistory[];
  questionnaires: Questionnaire[];
  coverage: Coverage[];
  imaging: Imaging[];
  serviceRequests: ServiceRequest[];
  appointments: Appointment[];
  organizations: Organization[];
  practitioners: Practitioner[];
  practitionerRoles: PractitionerRole[];
  locations: Location[];
  relatedPersons: RelatedPerson[];
  riskAssessments: RiskAssessment[];
  other: OtherSummary;
  // Financial and related
  eobs: ExplanationOfBenefit[];
  claims: Claim[];
  claimResponses: ClaimResponse[];
  paymentNotices: PaymentNotice[];
  paymentReconciliations: PaymentReconciliation[];
  eligibilities: Eligibility[];
  // Privacy/Security
  consents: Consent[];
  auditEvents: AuditEvent[];
  // Communication/Workflow
  communications: Communication[];
  communicationRequests: CommunicationRequest[];
  careTeamsRes: CareTeamRes[];
  tasks: Task[];
  appointmentResponses: AppointmentResponse[];
  // Medication events and problem summaries
  medAdministrations: MedicationAdministrationEvent[];
  medDispenses: MedicationDispenseEvent[];
  clinicalImpressions: ClinicalImpression[];
  flags: Flag[];
  // Lifestyle / Orders
  socialHistory: SocialHistory[];
  nutritionOrders: NutritionOrder[];
  _raw?: { fhir?: any[]; ccda?: any };
};
