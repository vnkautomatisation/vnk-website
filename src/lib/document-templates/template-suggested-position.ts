// ─────────────────────────────────────────────────────────
// template-suggested-position.ts — Mapping cle template ->
// poste suggere pour les apercus.
//
// Logique : certains templates sont specifiques a un poste/role
// (engagement OIQ pour ingenieur, CPA pour comptable). Quand un RH
// previsualise ces templates avec un employe qui a un poste different
// (ex. un cadre qui visualise le template CPA pour reference), on
// remplace `employee.position` par la valeur suggeree pour rendre
// l'apercu coherent.
//
// IMPORTANT : ce mapping s'applique UNIQUEMENT aux apercus (preview).
// Pour le PDF reel signe (signLegalDocAction), le poste reel de
// l'employe est utilise sans override.
// ─────────────────────────────────────────────────────────

/**
 * Pour une cle de template donnee, retourne le poste suggere a afficher
 * dans l'apercu PDF a la place de `employee.position`. Retourne null si
 * aucun override (apercu utilise le poste reel ou le fallback).
 */
export function getSuggestedPositionForTemplate(
  templateKey: string | undefined | null,
): string | null {
  if (!templateKey) return null;
  const key = templateKey.toLowerCase();

  // Engagements professionnels — poste lie a l'ordre
  if (key === "engagement_oiq_engineer") return "Ingénieur (OIQ)";
  if (key === "engagement_cpa_accountant") return "Comptable (CPA)";

  // Onboarding checklists — poste correspondant
  if (key === "onboarding_checklist_programmer") return "Programmeur";
  if (key === "onboarding_checklist_field_tech") return "Technicien de terrain";
  if (key === "onboarding_checklist_engineer") return "Ingénieur";
  if (key === "onboarding_checklist_accountant") return "Comptable";

  return null;
}
