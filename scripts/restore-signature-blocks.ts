#!/usr/bin/env node
// ─────────────────────────────────────────────────────────
// Migration : normalise les ancres signature dans les
// templates EXISTANTS en DB selon leur signatureScope.
//
// REGLE D'OR : l'editeur Tiptap est la SEULE source de
// verite. La bodyMarkdown stockee en DB doit contenir
// EXACTEMENT les ancres qui doivent apparaitre dans
// l'editeur (et donc dans le PDF final).
//
// Logique de normalisation (idempotente) :
//   - scope = "none"          -> supprime TOUTE ancre +
//                                la section "## Signatures"
//   - scope = "employee_only" -> garde {{signature.employee}},
//                                retire {{signature.employer}}
//   - scope = "employer_only" -> garde {{signature.employer}},
//                                retire {{signature.employee}}
//   - scope = "both" / null   -> garde les deux ancres
//                                (ajoute celles qui manquent)
//
// Convention : si on doit AJOUTER des ancres et qu'il n'y a
// aucune section Signatures, on append "## Signatures" + ancres.
//
// Usage :
//   npx tsx scripts/restore-signature-blocks.ts
// ─────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMPLOYEE_ANCHOR_RE = /\{\{\s*signature\.employee\s*\}\}/gi;
const EMPLOYER_ANCHOR_RE = /\{\{\s*signature\.employer\s*\}\}/gi;

function hasEmployeeAnchor(md: string): boolean {
  return /\{\{\s*signature\.employee\s*\}\}/i.test(md);
}
function hasEmployerAnchor(md: string): boolean {
  return /\{\{\s*signature\.employer\s*\}\}/i.test(md);
}

function stripEmployerAnchor(md: string): string {
  // Retire l'ancre + ligne vide eventuelle qui suit (pour eviter doubles sauts)
  return md.replace(/\{\{\s*signature\.employer\s*\}\}\s*\n*/gi, "");
}
function stripEmployeeAnchor(md: string): string {
  return md.replace(/\{\{\s*signature\.employee\s*\}\}\s*\n*/gi, "");
}

function stripSignaturesSection(md: string): string {
  // Supprime entierement "## Signatures" + ancres qui suivent + lignes vides
  return md.replace(
    /\n*##\s+Signatures\s*\n[\s\S]*?(?:\{\{\s*signature\.(?:employee|employer)\s*\}\}\s*\n*)+/gi,
    "\n",
  );
}

function ensureSignaturesSection(md: string, employee: boolean, employer: boolean): string {
  // Si le markdown contient deja une section "## Signatures", on ajoute juste
  // les ancres manquantes a la fin de cette section.
  // Sinon on append une nouvelle section Signatures en queue de doc.
  const hasSection = /##\s+Signatures/i.test(md);
  const lines: string[] = [];
  if (employee && !hasEmployeeAnchor(md)) lines.push("{{signature.employee}}");
  if (employer && !hasEmployerAnchor(md)) lines.push("{{signature.employer}}");
  if (lines.length === 0) return md;

  if (hasSection) {
    // Append a la fin du document — la section Signatures est par convention
    // toujours en queue, donc on s'assure d'avoir un saut propre.
    return md.trimEnd() + "\n\n" + lines.join("\n\n") + "\n";
  }
  return md.trimEnd() + "\n\n## Signatures\n\n" + lines.join("\n\n") + "\n";
}

type NormalizeResult = { newBody: string; changed: boolean };

function normalizeSignatures(
  body: string,
  scope: string | null | undefined,
): NormalizeResult {
  const s = (scope ?? "both").toLowerCase();
  let newBody = body;

  if (s === "none") {
    newBody = stripSignaturesSection(newBody);
    // Si malgre tout des ancres survivent en dehors d'une section, on les retire aussi
    newBody = stripEmployeeAnchor(newBody);
    newBody = stripEmployerAnchor(newBody);
  } else if (s === "employee_only") {
    newBody = stripEmployerAnchor(newBody);
    newBody = ensureSignaturesSection(newBody, true, false);
  } else if (s === "employer_only") {
    newBody = stripEmployeeAnchor(newBody);
    newBody = ensureSignaturesSection(newBody, false, true);
  } else {
    // "both" (ou inconnu) : s'assurer que les deux ancres sont presentes
    newBody = ensureSignaturesSection(newBody, true, true);
  }

  // Nettoyage : compacte les sauts multiples (3+ -> 2)
  newBody = newBody.replace(/\n{3,}/g, "\n\n");

  return { newBody, changed: newBody !== body };
}

async function main() {
  console.log("Migration : normalise les ancres signature selon signatureScope");
  console.log("");

  const templates = await prisma.legalDocumentTemplate.findMany({
    select: { id: true, key: true, title: true, bodyMarkdown: true, signatureScope: true },
  });
  console.log(`LegalDocumentTemplate : ${templates.length} templates trouves`);

  let updated = 0;
  let unchanged = 0;

  for (const tpl of templates) {
    const { newBody, changed } = normalizeSignatures(tpl.bodyMarkdown, tpl.signatureScope);
    if (!changed) {
      unchanged++;
      continue;
    }
    await prisma.legalDocumentTemplate.update({
      where: { id: tpl.id },
      data: { bodyMarkdown: newBody },
    });
    updated++;
    console.log(
      `  - ${tpl.key} (scope=${tpl.signatureScope}) : ${tpl.bodyMarkdown.length} -> ${newBody.length} chars`,
    );
  }

  console.log("");
  console.log(`  -> ${updated} normalises, ${unchanged} deja OK`);
  console.log("");
  console.log("Migration terminee.");
}

main()
  .catch((e) => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
