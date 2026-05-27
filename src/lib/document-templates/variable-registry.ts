// Registre central des variables disponibles dans les templates de documents
// (LegalDocumentTemplate, ContractTemplate, HrPolicy).
//
// Chaque variable est typee + formattee (date, monnaie, %, etc.) et alimentee
// depuis le contexte construit par employee-context.ts.

export type VariableSource =
  | "employee"
  | "company"
  | "date"
  | "contract"
  | "signature";

export type VariableFormat =
  | "text"
  | "date"
  | "currency"
  | "percent"
  | "number"
  | "phone"
  | "email";

export interface VariableDef {
  key: string; // ex "employee.fullName"
  label: string; // FR "Nom complet de l'employé"
  source: VariableSource;
  format: VariableFormat;
  example: string; // ex "Jean Tremblay"
  description?: string;
}

export const VARIABLE_REGISTRY: VariableDef[] = [
  // ─── Employé ───────────────────────────────────────────────
  {
    key: "employee.fullName",
    label: "Nom complet",
    source: "employee",
    format: "text",
    example: "Jean Tremblay",
  },
  {
    key: "employee.firstName",
    label: "Prénom",
    source: "employee",
    format: "text",
    example: "Jean",
  },
  {
    key: "employee.lastName",
    label: "Nom de famille",
    source: "employee",
    format: "text",
    example: "Tremblay",
  },
  {
    key: "employee.email",
    label: "Courriel",
    source: "employee",
    format: "email",
    example: "jean@vnk.ca",
  },
  {
    key: "employee.phone",
    label: "Téléphone",
    source: "employee",
    format: "phone",
    example: "(514) 555-1234",
  },
  {
    key: "employee.address",
    label: "Adresse",
    source: "employee",
    format: "text",
    example: "123 rue Saint-Denis, Montréal",
  },
  {
    key: "employee.position",
    label: "Poste",
    source: "employee",
    format: "text",
    example: "Technicien automatisation",
  },
  {
    key: "employee.department",
    label: "Département",
    source: "employee",
    format: "text",
    example: "Ingénierie",
  },
  {
    key: "employee.team",
    label: "Équipe",
    source: "employee",
    format: "text",
    example: "Automatisation industrielle",
  },
  {
    key: "employee.startDate",
    label: "Date d'embauche (ISO)",
    source: "employee",
    format: "date",
    example: "2026-05-30",
  },
  {
    key: "employee.startDateFr",
    label: "Date d'embauche (FR)",
    source: "employee",
    format: "date",
    example: "30 mai 2026",
  },
  {
    key: "employee.manager.fullName",
    label: "Nom du gestionnaire",
    source: "employee",
    format: "text",
    example: "Marie Côté",
  },
  {
    key: "employee.manager.email",
    label: "Courriel du gestionnaire",
    source: "employee",
    format: "email",
    example: "marie@vnk.ca",
  },
  {
    key: "employee.salary",
    label: "Salaire annuel (chiffre brut)",
    source: "employee",
    format: "number",
    example: "65000",
  },
  {
    key: "employee.salaryFormatted",
    label: "Salaire annuel formaté",
    source: "employee",
    format: "currency",
    example: "65 000,00 $ CAD",
  },
  {
    key: "employee.hourlyRate",
    label: "Taux horaire",
    source: "employee",
    format: "currency",
    example: "32,50 $ CAD",
  },
  {
    key: "employee.hoursPerWeek",
    label: "Heures/semaine",
    source: "employee",
    format: "number",
    example: "40",
  },
  {
    key: "employee.vacationPct",
    label: "% Vacances",
    source: "employee",
    format: "percent",
    example: "4 %",
  },
  {
    key: "employee.nas",
    label: "NAS (masqué)",
    source: "employee",
    format: "text",
    example: "XXX-XXX-789",
  },
  {
    key: "employee.nasFormatted",
    label: "NAS formaté (XXX XXX XXX)",
    source: "employee",
    format: "text",
    example: "123 456 789",
    description: "À utiliser uniquement dans documents RH internes confidentiels (TD1, T4, etc.).",
  },
  {
    key: "employee.birthdateFr",
    label: "Date de naissance (FR)",
    source: "employee",
    format: "date",
    example: "15 mars 1990",
  },
  {
    key: "employee.tenureMonths",
    label: "Ancienneté (mois)",
    source: "employee",
    format: "number",
    example: "18",
  },
  {
    key: "employee.tenureYears",
    label: "Ancienneté (années)",
    source: "employee",
    format: "number",
    example: "1",
  },
  {
    key: "employee.tenureLabel",
    label: "Ancienneté (libellé FR)",
    source: "employee",
    format: "text",
    example: "1 an et 6 mois",
  },

  // ─── Genre grammatical / accord épicène ───────────────────
  // Ces variables permettent l'accord automatique selon le genre déclaré
  // de l'employé. Si le genre est inconnu, elles retombent sur la forme
  // épicène "(e)" / "il ou elle" / "le ou la" (conforme OQLF).
  {
    key: "employee.gender",
    label: "Code genre normalisé",
    source: "employee",
    format: "text",
    example: "female",
    description:
      "Utilisé par {{#ifGender male}}...{{/ifGender}}. Valeurs : male, female, non_binary, prefer_not_to_say.",
  },
  {
    key: "employee.civility",
    label: "Civilité (M./Mme/Mx)",
    source: "employee",
    format: "text",
    example: "Mme",
    description: "Titre court : M., Mme, Mx ou vide selon le genre déclaré.",
  },
  {
    key: "employee.title",
    label: "Titre long (Monsieur/Madame)",
    source: "employee",
    format: "text",
    example: "Madame",
    description: "Monsieur / Madame / Mx / « Madame, Monsieur » si inconnu.",
  },
  {
    key: "employee.pronoun",
    label: "Pronom sujet (il/elle)",
    source: "employee",
    format: "text",
    example: "elle",
    description: "il / elle / iel / « il ou elle » si inconnu.",
  },
  {
    key: "employee.pronounObj",
    label: "Pronom objet (le/la)",
    source: "employee",
    format: "text",
    example: "la",
    description: "le / la / lui / « le ou la » si inconnu.",
  },
  {
    key: "employee.pronounDet",
    label: "Déterminant possessif (son/sa)",
    source: "employee",
    format: "text",
    example: "sa",
    description: "son / sa / son (épicène) / « son ou sa » si inconnu.",
  },
  {
    key: "employee.employed",
    label: "« Employé(e) » accordé",
    source: "employee",
    format: "text",
    example: "Employée",
    description: "Employé / Employée / Employé·e / Employé(e) selon le genre.",
  },
  {
    key: "employee.employedLower",
    label: "« employé(e) » accordé (minuscule)",
    source: "employee",
    format: "text",
    example: "employée",
  },
  {
    key: "employee.born",
    label: "« né(e) » accordé",
    source: "employee",
    format: "text",
    example: "née",
    description: "né / née / né·e / né(e) selon le genre.",
  },
  {
    key: "employee.accordE",
    label: "Suffixe d'accord (e/·e/(e))",
    source: "employee",
    format: "text",
    example: "e",
    description: "Suffixe à coller après un mot masculin. Ex: «engagé{{employee.accordE}}».",
  },

  // ─── Entreprise ────────────────────────────────────────────
  {
    key: "company.name",
    label: "Nom court entreprise",
    source: "company",
    format: "text",
    example: "VNK",
  },
  {
    key: "company.fullName",
    label: "Nom légal complet",
    source: "company",
    format: "text",
    example: "VNK Automatisation Inc.",
  },
  {
    key: "company.address",
    label: "Adresse entreprise",
    source: "company",
    format: "text",
    example: "...",
  },
  {
    key: "company.phone",
    label: "Téléphone entreprise",
    source: "company",
    format: "phone",
    example: "...",
  },
  {
    key: "company.email",
    label: "Courriel entreprise",
    source: "company",
    format: "email",
    example: "info@vnk.ca",
  },
  {
    key: "company.neq",
    label: "Numéro NEQ (Québec)",
    source: "company",
    format: "text",
    example: "1234567890",
  },

  // ─── Date ──────────────────────────────────────────────────
  {
    key: "date.today",
    label: "Aujourd'hui (ISO)",
    source: "date",
    format: "date",
    example: "2026-05-30",
  },
  {
    key: "date.todayFr",
    label: "Aujourd'hui (FR)",
    source: "date",
    format: "date",
    example: "30 mai 2026",
  },

  // ─── Contrat ───────────────────────────────────────────────
  {
    key: "contract.title",
    label: "Titre du contrat",
    source: "contract",
    format: "text",
    example: "Contrat de travail - CDI",
  },
  {
    key: "contract.contractType",
    label: "Type de contrat",
    source: "contract",
    format: "text",
    example: "CDI",
  },
  {
    key: "contract.startDate",
    label: "Date de début (ISO)",
    source: "contract",
    format: "date",
    example: "2026-06-01",
  },
  {
    key: "contract.startDateFr",
    label: "Date de début (FR)",
    source: "contract",
    format: "date",
    example: "1er juin 2026",
  },
  {
    key: "contract.endDate",
    label: "Date de fin (ISO)",
    source: "contract",
    format: "date",
    example: "",
  },
  {
    key: "contract.endDateFr",
    label: "Date de fin (FR)",
    source: "contract",
    format: "date",
    example: "",
  },
  {
    key: "contract.probationEndDate",
    label: "Fin période probatoire (ISO)",
    source: "contract",
    format: "date",
    example: "2026-09-01",
  },
  {
    key: "contract.probationEndDateFr",
    label: "Fin période probatoire (FR)",
    source: "contract",
    format: "date",
    example: "1er septembre 2026",
  },
  {
    key: "contract.salaryAnnual",
    label: "Salaire annuel (chiffre)",
    source: "contract",
    format: "number",
    example: "65000",
  },
  {
    key: "contract.salaryFormatted",
    label: "Salaire annuel formaté",
    source: "contract",
    format: "currency",
    example: "65 000,00 $ CAD",
  },
  {
    key: "contract.hourlyRate",
    label: "Taux horaire contrat",
    source: "contract",
    format: "currency",
    example: "32,50 $ CAD",
  },
  {
    key: "contract.hoursPerWeek",
    label: "Heures/semaine contrat",
    source: "contract",
    format: "number",
    example: "40",
  },
  {
    key: "contract.vacationPct",
    label: "% Vacances contrat",
    source: "contract",
    format: "percent",
    example: "4 %",
  },
  {
    key: "contract.salaryAnnualFromHourly",
    label: "Salaire annuel calculé (taux × heures × 52)",
    source: "contract",
    format: "currency",
    example: "67 600,00 $ CAD",
    description: "Calcul auto si seul le taux horaire est saisi.",
  },
  {
    key: "contract.hourlyFromAnnual",
    label: "Taux horaire calculé (salaire / heures / 52)",
    source: "contract",
    format: "currency",
    example: "32,50 $ CAD",
    description: "Calcul auto si seul le salaire annuel est saisi.",
  },
  {
    key: "contract.probationEndAutoFr",
    label: "Fin probation auto (start + 90 j)",
    source: "contract",
    format: "date",
    example: "30 août 2026",
    description: "Calcul auto = startDate + 90 jours (3 mois Loi NT).",
  },

  // ─── Signatures (ancres pour positionnement PDFKit) ───────
  {
    key: "signature.employee",
    label: "Bloc signature employé",
    source: "signature",
    format: "text",
    example: "[Signature employé]",
  },
  {
    key: "signature.employer",
    label: "Bloc signature employeur",
    source: "signature",
    format: "text",
    example: "[Signature employeur]",
  },
];

// ─── Helpers ────────────────────────────────────────────────

export function getVariablesBySource(source: VariableSource): VariableDef[] {
  return VARIABLE_REGISTRY.filter((v) => v.source === source);
}

export function findVariable(key: string): VariableDef | undefined {
  return VARIABLE_REGISTRY.find((v) => v.key === key);
}

export function isKnownVariable(key: string): boolean {
  return VARIABLE_REGISTRY.some((v) => v.key === key);
}

// Liste des sources groupees pour UI (ordre stable)
export const VARIABLE_SOURCES: { source: VariableSource; label: string }[] = [
  { source: "employee", label: "Employé" },
  { source: "contract", label: "Contrat" },
  { source: "company", label: "Entreprise" },
  { source: "date", label: "Date" },
  { source: "signature", label: "Signatures" },
];
