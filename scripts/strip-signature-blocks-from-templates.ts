#!/usr/bin/env node
// ─────────────────────────────────────────────────────────
// Migration one-shot : retire les ancres signature
// (`{{signature.employee}}`, `{{signature.employer}}`,
// `[Signature ...]`, heading `## Signatures` orphelin) du
// `bodyMarkdown` de tous les templates en DB.
//
// Pourquoi : les blocs signature sont desormais auto-generes
// par le renderer PDF en fonction du `signatureScope`. Les
// templates n'ont plus a contenir ces ancres dans leur
// markdown. L'editeur Tiptap n'affichera plus les pills
// "Bloc signature employe/employeur" parasites.
//
// Idempotent : peut etre relance sans effet de bord.
//
// Usage :
//   npx tsx scripts/strip-signature-blocks-from-templates.ts
// ─────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function stripSignatureMarkers(md: string): string {
  if (!md) return md;
  return md
    // Variables signature non resolues
    .replace(/\{\{\s*signature\.(employee|employer)\s*\}\}/gi, "")
    // Ancres signature directes (employe/employeur, avec ou sans accent)
    .replace(/\[Signature\s+(?:employ[ée]e?|employeur?|employer)\]/gi, "")
    // Heading "## Signatures" / "### Signatures" orphelin
    .replace(/^#{1,3}\s+Signatures?\s*$/gim, "")
    // Compact les lignes blanches creees par les suppressions
    .replace(/\n{3,}/g, "\n\n")
    // Trim final
    .trim();
}

async function migrateModel<T extends { id: number; bodyMarkdown: string }>(
  modelName: string,
  rows: T[],
  update: (id: number, body: string) => Promise<unknown>,
): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const cleaned = stripSignatureMarkers(row.bodyMarkdown);
    if (cleaned === row.bodyMarkdown) {
      skipped++;
      continue;
    }
    await update(row.id, cleaned);
    updated++;
    console.log(`  - ${modelName} #${row.id} : ${row.bodyMarkdown.length} -> ${cleaned.length} chars`);
  }
  return { updated, skipped };
}

async function main() {
  console.log("Migration : strip ancres signature du markdown des templates");
  console.log("");

  // 1. LegalDocumentTemplate
  const legalTemplates = await prisma.legalDocumentTemplate.findMany({
    select: { id: true, bodyMarkdown: true },
  });
  console.log(`LegalDocumentTemplate : ${legalTemplates.length} templates trouves`);
  const legalRes = await migrateModel(
    "LegalDocumentTemplate",
    legalTemplates,
    (id, body) =>
      prisma.legalDocumentTemplate.update({
        where: { id },
        data: { bodyMarkdown: body },
      }),
  );
  console.log(`  -> ${legalRes.updated} updated, ${legalRes.skipped} skipped`);
  console.log("");

  // 2. ContractTemplate (les contrats ont signatureScope=both donc le
  //    renderer auto-injecte les blocs ; on enleve les ancres legacy ici).
  const contractTemplates = await prisma.contractTemplate.findMany({
    select: { id: true, bodyMarkdown: true },
  });
  console.log(`ContractTemplate : ${contractTemplates.length} templates trouves`);
  const contractRes = await migrateModel(
    "ContractTemplate",
    contractTemplates,
    (id, body) =>
      prisma.contractTemplate.update({
        where: { id },
        data: { bodyMarkdown: body },
      }),
  );
  console.log(`  -> ${contractRes.updated} updated, ${contractRes.skipped} skipped`);
  console.log("");

  // 3. HrPolicy (politiques : reading_only / scope=none, n'ont pas de bloc
  //    signature mais peuvent avoir des ancres legacy a stripper).
  const policies = await prisma.hrPolicy.findMany({
    select: { id: true, bodyMarkdown: true },
  });
  console.log(`HrPolicy : ${policies.length} politiques trouvees`);
  const policyRes = await migrateModel(
    "HrPolicy",
    policies,
    (id, body) =>
      prisma.hrPolicy.update({
        where: { id },
        data: { bodyMarkdown: body },
      }),
  );
  console.log(`  -> ${policyRes.updated} updated, ${policyRes.skipped} skipped`);
  console.log("");

  console.log("Migration terminee.");
  console.log(
    `Total : ${legalRes.updated + contractRes.updated + policyRes.updated} templates nettoyes.`,
  );
}

main()
  .catch((e) => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
