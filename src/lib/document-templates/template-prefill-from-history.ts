// ─────────────────────────────────────────────────────────
// template-prefill-from-history.ts — Suggere des valeurs de
// customFieldValues a partir des signatures precedentes du
// MEME employe sur des templates RELIES.
//
// Cas typique : un avertissement disciplinaire de 2e niveau.
// L'employe a deja signe le 1er niveau avec date + sujet remplis
// par RH. Quand RH ouvre le wizard pour le 2e niveau pour ce
// meme employe, on pre-remplit "Date" / "Sujet initial" avec
// les valeurs du 1er niveau, et RH n'a qu'a ajouter les nouveaux
// faits constatés.
// ─────────────────────────────────────────────────────────
import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Mapping cle template -> liste des cles "predecesseur" a chercher
 * (par ordre de preference, du plus recent au plus ancien).
 *
 * Pour un avertissement 2e niveau, on cherche le 1er niveau.
 * Pour un avertissement final, on cherche le 2e (sinon le 1er).
 */
const TEMPLATE_PREDECESSORS: Record<string, string[]> = {
  letter_disciplinary_warning_2: ["letter_disciplinary_warning"],
  letter_disciplinary_warning_final: [
    "letter_disciplinary_warning_2",
    "letter_disciplinary_warning",
  ],
  letter_probation_extended: ["letter_probation_passed"],
  letter_termination: [
    "letter_disciplinary_warning_final",
    "letter_disciplinary_warning_2",
    "letter_disciplinary_warning",
  ],
};

/**
 * Cherche les customFieldValues du predecesseur signe par cet employe.
 * Retourne `{}` si aucun predecesseur ou aucune signature trouvee.
 *
 * Seuls les champs HR-fillable (faits, dates, sujets) sont pertinents.
 * Les champs employe (numero de membre) ne sont JAMAIS pre-remplis a
 * partir d'un autre document.
 */
export async function getPrefillValuesForTemplate(
  templateKey: string,
  targetEmployeeId: number | null | undefined,
): Promise<Record<string, string>> {
  if (!templateKey || !targetEmployeeId) return {};
  const predecessorKeys = TEMPLATE_PREDECESSORS[templateKey];
  if (!predecessorKeys || predecessorKeys.length === 0) return {};

  // Cherche la demande de signature la plus recente qui CIBLE cet employe
  // sur l'un des templates predecesseurs. Recupere customFieldValues.
  // Note : on cherche la DSR (qui contient customFieldValues), pas la
  // signature elle-meme, parce que customFieldValues vit sur la DSR.
  const me = await prisma.admin.findUnique({
    where: { id: targetEmployeeId },
    select: { teamId: true },
  });

  for (const predKey of predecessorKeys) {
    const tpl = await prisma.legalDocumentTemplate.findUnique({
      where: { key: predKey },
      select: { id: true },
    });
    if (!tpl) continue;

    // Cherche la DSR la plus recente ciblant cet employe (ou sa team / global)
    const dsr = await prisma.documentSignatureRequest.findFirst({
      where: {
        templateId: tpl.id,
        OR: [
          { targetAdminId: targetEmployeeId },
          ...(me?.teamId ? [{ targetTeamId: me.teamId }] : []),
          { targetAll: true },
        ],
      },
      orderBy: { requestedAt: "desc" },
      select: { customFieldValues: true },
    });

    const vals = (dsr?.customFieldValues as Record<string, string> | null | undefined) ?? null;
    if (vals && Object.keys(vals).length > 0) {
      // Retire les valeurs vides ; ne pre-remplit que ce qui a une vraie valeur
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(vals)) {
        if (typeof v === "string" && v.trim().length > 0) cleaned[k] = v;
      }
      if (Object.keys(cleaned).length > 0) return cleaned;
    }
  }

  return {};
}
