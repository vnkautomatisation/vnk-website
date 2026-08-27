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
  labelKey: string;
  source: VariableSource;
  format: VariableFormat;
  example: string; // ex "Jean Tremblay"
  descriptionKey?: string;
}

export const VARIABLE_REGISTRY: VariableDef[] = [
  // ─── Employé ───────────────────────────────────────────────
  {
    key: "employee.fullName",
    labelKey: "var_lbl_nom_complet",
    source: "employee",
    format: "text",
    example: "Jean Tremblay",
  },
  {
    key: "employee.firstName",
    labelKey: "var_lbl_prenom",
    source: "employee",
    format: "text",
    example: "Jean",
  },
  {
    key: "employee.lastName",
    labelKey: "var_lbl_nom_de_famille",
    source: "employee",
    format: "text",
    example: "Tremblay",
  },
  {
    key: "employee.email",
    labelKey: "var_lbl_courriel",
    source: "employee",
    format: "email",
    example: "jean@vnk.ca",
  },
  {
    key: "employee.phone",
    labelKey: "var_lbl_telephone",
    source: "employee",
    format: "phone",
    example: "(514) 555-1234",
  },
  {
    key: "employee.address",
    labelKey: "var_lbl_adresse",
    source: "employee",
    format: "text",
    example: "123 rue Saint-Denis, Montréal",
  },
  {
    key: "employee.position",
    labelKey: "var_lbl_poste",
    source: "employee",
    format: "text",
    example: "Technicien automatisation",
  },
  {
    key: "employee.department",
    labelKey: "var_lbl_departement",
    source: "employee",
    format: "text",
    example: "Ingénierie",
  },
  {
    key: "employee.team",
    labelKey: "var_lbl_equipe",
    source: "employee",
    format: "text",
    example: "Automatisation industrielle",
  },
  {
    key: "employee.startDate",
    labelKey: "var_lbl_date_d_embauche_iso",
    source: "employee",
    format: "date",
    example: "2026-05-30",
  },
  {
    key: "employee.startDateFr",
    labelKey: "var_lbl_date_d_embauche_fr",
    source: "employee",
    format: "date",
    example: "30 mai 2026",
  },
  {
    key: "employee.manager.fullName",
    labelKey: "var_lbl_nom_du_gestionnaire",
    source: "employee",
    format: "text",
    example: "Marie Côté",
  },
  {
    key: "employee.manager.email",
    labelKey: "var_lbl_courriel_du_gestionnaire",
    source: "employee",
    format: "email",
    example: "marie@vnk.ca",
  },
  {
    key: "employee.salary",
    labelKey: "var_lbl_salaire_annuel_chiffre_brut",
    source: "employee",
    format: "number",
    example: "65000",
  },
  {
    key: "employee.salaryFormatted",
    labelKey: "var_lbl_salaire_annuel_formate",
    source: "employee",
    format: "currency",
    example: "65 000,00 $ CAD",
  },
  {
    key: "employee.hourlyRate",
    labelKey: "var_lbl_taux_horaire",
    source: "employee",
    format: "currency",
    example: "32,50 $ CAD",
  },
  {
    key: "employee.hoursPerWeek",
    labelKey: "var_lbl_heures_semaine",
    source: "employee",
    format: "number",
    example: "40",
  },
  {
    key: "employee.vacationPct",
    labelKey: "var_lbl_vacances",
    source: "employee",
    format: "percent",
    example: "4 %",
  },
  {
    key: "employee.nas",
    labelKey: "var_lbl_nas_masque",
    source: "employee",
    format: "text",
    example: "XXX-XXX-789",
  },
  {
    key: "employee.nasFormatted",
    labelKey: "var_lbl_nas_formate_xxx_xxx_xxx",
    source: "employee",
    format: "text",
    example: "123 456 789",
    descriptionKey: "var_desc_a_utiliser_uniquement_dans_documents_rh",
  },
  {
    key: "employee.birthdateFr",
    labelKey: "var_lbl_date_de_naissance_fr",
    source: "employee",
    format: "date",
    example: "15 mars 1990",
  },
  {
    key: "employee.tenureMonths",
    labelKey: "var_lbl_anciennete_mois",
    source: "employee",
    format: "number",
    example: "18",
  },
  {
    key: "employee.tenureYears",
    labelKey: "var_lbl_anciennete_annees",
    source: "employee",
    format: "number",
    example: "1",
  },
  {
    key: "employee.tenureLabel",
    labelKey: "var_lbl_anciennete_libelle_fr",
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
    labelKey: "var_lbl_code_genre_normalise",
    source: "employee",
    format: "text",
    example: "female",
    descriptionKey: "var_desc_utilise_par_ifgender",
  },
  {
    key: "employee.civility",
    labelKey: "var_lbl_civilite_m_mme_mx",
    source: "employee",
    format: "text",
    example: "Mme",
    descriptionKey: "var_desc_titre_court_m_mme_mx_ou",
  },
  {
    key: "employee.title",
    labelKey: "var_lbl_titre_long_monsieur_madame",
    source: "employee",
    format: "text",
    example: "Madame",
    descriptionKey: "var_desc_monsieur_madame_mx_madame_monsieur_si",
  },
  {
    key: "employee.pronoun",
    labelKey: "var_lbl_pronom_sujet_il_elle",
    source: "employee",
    format: "text",
    example: "elle",
    descriptionKey: "var_desc_il_elle_iel_il_ou_elle",
  },
  {
    key: "employee.pronounObj",
    labelKey: "var_lbl_pronom_objet_le_la",
    source: "employee",
    format: "text",
    example: "la",
    descriptionKey: "var_desc_le_la_lui_le_ou_la",
  },
  {
    key: "employee.pronounDet",
    labelKey: "var_lbl_determinant_possessif_son_sa",
    source: "employee",
    format: "text",
    example: "sa",
    descriptionKey: "var_desc_son_sa_son_epicene_son_ou",
  },
  {
    key: "employee.employed",
    labelKey: "var_lbl_employe_e_accorde",
    source: "employee",
    format: "text",
    example: "Employée",
    descriptionKey: "var_desc_employe_employee_employee_employe_e_selon",
  },
  {
    key: "employee.employedLower",
    labelKey: "var_lbl_employe_e_accorde_minuscule",
    source: "employee",
    format: "text",
    example: "employée",
  },
  {
    key: "employee.born",
    labelKey: "var_lbl_ne_e_accorde",
    source: "employee",
    format: "text",
    example: "née",
    descriptionKey: "var_desc_ne_nee_nee_ne_e_selon",
  },
  {
    key: "employee.accordE",
    labelKey: "var_lbl_suffixe_d_accord_e_e_e",
    source: "employee",
    format: "text",
    example: "e",
    descriptionKey: "var_desc_suffixe_a_coller_apres_un_mot",
  },

  // ─── Entreprise ────────────────────────────────────────────
  {
    key: "company.name",
    labelKey: "var_lbl_nom_court_entreprise",
    source: "company",
    format: "text",
    example: "VNK",
  },
  {
    key: "company.fullName",
    labelKey: "var_lbl_nom_legal_complet",
    source: "company",
    format: "text",
    example: "VNK Automatisation Inc.",
  },
  {
    key: "company.address",
    labelKey: "var_lbl_adresse_entreprise",
    source: "company",
    format: "text",
    example: "...",
  },
  {
    key: "company.phone",
    labelKey: "var_lbl_telephone_entreprise",
    source: "company",
    format: "phone",
    example: "...",
  },
  {
    key: "company.email",
    labelKey: "var_lbl_courriel_entreprise",
    source: "company",
    format: "email",
    example: "info@vnk.ca",
  },
  {
    key: "company.neq",
    labelKey: "var_lbl_numero_neq_quebec",
    source: "company",
    format: "text",
    example: "1234567890",
  },

  // ─── Date ──────────────────────────────────────────────────
  {
    key: "date.today",
    labelKey: "var_lbl_aujourd_hui_iso",
    source: "date",
    format: "date",
    example: "2026-05-30",
  },
  {
    key: "date.todayFr",
    labelKey: "var_lbl_aujourd_hui_fr",
    source: "date",
    format: "date",
    example: "30 mai 2026",
  },

  // ─── Contrat ───────────────────────────────────────────────
  {
    key: "contract.title",
    labelKey: "var_lbl_titre_du_contrat",
    source: "contract",
    format: "text",
    example: "Contrat de travail - CDI",
  },
  {
    key: "contract.contractType",
    labelKey: "var_lbl_type_de_contrat",
    source: "contract",
    format: "text",
    example: "CDI",
  },
  {
    key: "contract.startDate",
    labelKey: "var_lbl_date_de_debut_iso",
    source: "contract",
    format: "date",
    example: "2026-06-01",
  },
  {
    key: "contract.startDateFr",
    labelKey: "var_lbl_date_de_debut_fr",
    source: "contract",
    format: "date",
    example: "1er juin 2026",
  },
  {
    key: "contract.endDate",
    labelKey: "var_lbl_date_de_fin_iso",
    source: "contract",
    format: "date",
    example: "",
  },
  {
    key: "contract.endDateFr",
    labelKey: "var_lbl_date_de_fin_fr",
    source: "contract",
    format: "date",
    example: "",
  },
  {
    key: "contract.probationEndDate",
    labelKey: "var_lbl_fin_periode_probatoire_iso",
    source: "contract",
    format: "date",
    example: "2026-09-01",
  },
  {
    key: "contract.probationEndDateFr",
    labelKey: "var_lbl_fin_periode_probatoire_fr",
    source: "contract",
    format: "date",
    example: "1er septembre 2026",
  },
  {
    key: "contract.salaryAnnual",
    labelKey: "var_lbl_salaire_annuel_chiffre",
    source: "contract",
    format: "number",
    example: "65000",
  },
  {
    key: "contract.salaryFormatted",
    labelKey: "var_lbl_salaire_annuel_formate",
    source: "contract",
    format: "currency",
    example: "65 000,00 $ CAD",
  },
  {
    key: "contract.hourlyRate",
    labelKey: "var_lbl_taux_horaire_contrat",
    source: "contract",
    format: "currency",
    example: "32,50 $ CAD",
  },
  {
    key: "contract.hoursPerWeek",
    labelKey: "var_lbl_heures_semaine_contrat",
    source: "contract",
    format: "number",
    example: "40",
  },
  {
    key: "contract.vacationPct",
    labelKey: "var_lbl_vacances_contrat",
    source: "contract",
    format: "percent",
    example: "4 %",
  },
  {
    key: "contract.salaryAnnualFromHourly",
    labelKey: "var_lbl_salaire_annuel_calcule_taux_heures_52",
    source: "contract",
    format: "currency",
    example: "67 600,00 $ CAD",
    descriptionKey: "var_desc_calcul_auto_si_seul_le_taux",
  },
  {
    key: "contract.hourlyFromAnnual",
    labelKey: "var_lbl_taux_horaire_calcule_salaire_heures_52",
    source: "contract",
    format: "currency",
    example: "32,50 $ CAD",
    descriptionKey: "var_desc_calcul_auto_si_seul_le_salaire",
  },
  {
    key: "contract.probationEndAutoFr",
    labelKey: "var_lbl_fin_probation_auto_start_90_j",
    source: "contract",
    format: "date",
    example: "30 août 2026",
    descriptionKey: "var_desc_calcul_auto_startdate_90_jours_3",
  },

  // ─── Signatures (ancres pour positionnement PDFKit) ───────
  {
    key: "signature.employee",
    labelKey: "var_lbl_bloc_signature_employe",
    source: "signature",
    format: "text",
    example: "[Signature employé]",
  },
  {
    key: "signature.employer",
    labelKey: "var_lbl_bloc_signature_employeur",
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
export const VARIABLE_SOURCES: { source: VariableSource; labelKey: string }[] = [
  { source: "employee", labelKey: "var_lbl_employe" },
  { source: "contract", labelKey: "var_lbl_contrat" },
  { source: "company", labelKey: "var_lbl_entreprise" },
  { source: "date", labelKey: "var_lbl_date" },
  { source: "signature", labelKey: "var_lbl_signatures" },
];

// Le libelle d'une variable suit la locale du lecteur.
export function variableLabel(key: string, t: (k: string) => string): string {
  const def = findVariable(key);
  return def ? t(def.labelKey) : key;
}

// Les documents generes sont en francais : le libelle vient du catalogue FR.
import frLibrary from "../../../messages/fr/admin/library.json";

export function variableLabelFr(key: string): string {
  const def = findVariable(key);
  if (!def) return key;
  return (frLibrary as Record<string, string>)[def.labelKey] ?? def.labelKey;
}
