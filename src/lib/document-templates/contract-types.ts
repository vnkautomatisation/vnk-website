// Types de contrat (terminologie québécoise — LNT / Code du travail QC).
// Centralise les valeurs utilisées dans tous les <Select> et formulaires
// de contrat. Conserve la rétro-compatibilité avec les anciennes valeurs
// françaises (cdi, cdd, contractuel, stagiaire) via LEGACY_CONTRACT_TYPE_MAP.

export const CONTRACT_TYPES = [
  {
    value: "permanent_full_time",
    label: "Permanent temps plein",
    description: "Poste régulier 35h+ / sem, durée indéterminée",
  },
  {
    value: "permanent_part_time",
    label: "Permanent temps partiel",
    description: "Poste régulier moins de 35h / sem, durée indéterminée",
  },
  {
    value: "temporary",
    label: "Temporaire (durée déterminée)",
    description: "Contrat avec date de fin précise",
  },
  {
    value: "seasonal",
    label: "Saisonnier",
    description: "Travail récurrent selon saison ou cycle d'activité",
  },
  {
    value: "on_call",
    label: "Sur appel",
    description: "Heures variables selon besoins opérationnels",
  },
  {
    value: "student",
    label: "Étudiant (temps partiel)",
    description: "Étudiant aux études, horaire compatible session",
  },
  {
    value: "internship",
    label: "Stage rémunéré",
    description: "Stage encadré dans le cadre d'un programme d'études",
  },
  {
    value: "freelance",
    label: "Pigiste / Travailleur autonome",
    description: "Sous-traitant indépendant, hors LNT",
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
export function getContractTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  const found = CONTRACT_TYPES.find((c) => c.value === value);
  if (found) return found.label;
  const mapped = LEGACY_CONTRACT_TYPE_MAP[value];
  if (mapped) {
    return CONTRACT_TYPES.find((c) => c.value === mapped)?.label ?? value;
  }
  return value;
}

/**
 * Normalise une valeur de type de contrat : retourne la valeur QC actuelle
 * pour toute valeur legacy, sinon retourne la valeur d'origine.
 */
export function normalizeContractType(value: string): ContractTypeValue | string {
  return LEGACY_CONTRACT_TYPE_MAP[value] ?? value;
}
