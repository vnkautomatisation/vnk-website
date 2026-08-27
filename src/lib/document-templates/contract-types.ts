// Types de contrat (terminologie québécoise — LNT / Code du travail QC).
// Centralise les valeurs utilisées dans tous les <Select> et formulaires
// de contrat. Conserve la rétro-compatibilité avec les anciennes valeurs
// françaises (cdi, cdd, contractuel, stagiaire) via LEGACY_CONTRACT_TYPE_MAP.

export const CONTRACT_TYPES = [
  {
    value: "permanent_full_time",
    labelKey: "ct_permanent_full_time",
    descriptionKey: "ctd_permanent_full_time",
  },
  {
    value: "permanent_part_time",
    labelKey: "ct_permanent_part_time",
    descriptionKey: "ctd_permanent_part_time",
  },
  {
    value: "temporary",
    labelKey: "ct_temporary",
    descriptionKey: "ctd_temporary",
  },
  {
    value: "seasonal",
    labelKey: "ct_seasonal",
    descriptionKey: "ctd_seasonal",
  },
  {
    value: "on_call",
    labelKey: "ct_on_call",
    descriptionKey: "ctd_on_call",
  },
  {
    value: "student",
    labelKey: "ct_student",
    descriptionKey: "ctd_student",
  },
  {
    value: "internship",
    labelKey: "ct_internship",
    descriptionKey: "ctd_internship",
  },
  {
    value: "freelance",
    labelKey: "ct_freelance",
    descriptionKey: "ctd_freelance",
  },
] as const;

export type ContractTypeValue = typeof CONTRACT_TYPES[number]["value"];

// Migration : anciennes valeurs (France/legacy) → nouvelles valeurs QC
export const LEGACY_CONTRACT_TYPE_MAP: Record<string, ContractTypeValue> = {
  cdi: "permanent_full_time",
  cdd: "temporary",
  contractuel: "freelance",
  contractor: "freelance",
  stagiaire: "internship",
  intern: "internship",
  permanent: "permanent_full_time",
  etudiant: "student",
};

/**
 * Retourne le libellé d'affichage pour une valeur de type de contrat.
 * Rétro-compatible : si la valeur est legacy (cdi, cdd, etc.), elle est
 * mappée vers la nouvelle valeur avant de retourner le label.
 * Si aucune correspondance, la valeur brute est retournée.
 */
export function getContractTypeKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const found = CONTRACT_TYPES.find((c) => c.value === value);
  if (found) return found.labelKey;
  const mapped = LEGACY_CONTRACT_TYPE_MAP[value];
  if (mapped) {
    return CONTRACT_TYPES.find((c) => c.value === mapped)?.labelKey ?? null;
  }
  return null;
}

/**
 * Normalise une valeur de type de contrat : retourne la valeur QC actuelle
 * pour toute valeur legacy, sinon retourne la valeur d'origine.
 */
export function normalizeContractType(value: string): ContractTypeValue | string {
  return LEGACY_CONTRACT_TYPE_MAP[value] ?? value;
}
