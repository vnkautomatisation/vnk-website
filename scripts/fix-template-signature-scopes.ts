#!/usr/bin/env node
// ─────────────────────────────────────────────────────────
// Script de migration : corrige le signatureScope des
// LegalDocumentTemplate existants selon la nouvelle classification.
//
// Logique :
//   - Confirmations / attestations recues par l'employe : employee_only
//     (l'employe signe pour accuser reception, pas l'employeur)
//   - Avertissements / changements bilateraux : both
//     (les deux parties signent — l'employeur emet, l'employe accepte)
//   - Lettres a tiers (reference) : employer_only (inchange)
//
// Idempotent : peut etre lance plusieurs fois sans effet de bord.
//
// Usage :
//   npx tsx scripts/fix-template-signature-scopes.ts
// ─────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Confirmations -> employee_only (seul l'employe accuse reception)
const TO_EMPLOYEE_ONLY = [
  "letter_employment_confirmation",
  "letter_salary_confirmation",
  "letter_probation_passed",
  "letter_recall_to_work",
];

// Bilateraux -> both (les deux signent)
const TO_BOTH = [
  "letter_promotion",
  "letter_disciplinary_warning",
  "letter_termination",
  "letter_position_change",
  "letter_probation_extended",
  "letter_disciplinary_warning_2",
  "letter_disciplinary_warning_final",
  "letter_temporary_layoff",
];

async function main() {
  console.log("Migration : correction signatureScope des templates legaux");
  console.log("");

  // Mise a jour employee_only
  for (const key of TO_EMPLOYEE_ONLY) {
    const tpl = await prisma.legalDocumentTemplate.findUnique({
      where: { key },
      select: { id: true, title: true, signatureScope: true },
    });
    if (!tpl) {
      console.log(`  - SKIP ${key} : template introuvable en DB`);
      continue;
    }
    if (tpl.signatureScope === "employee_only") {
      console.log(`  - SKIP ${key} : deja employee_only`);
      continue;
    }
    await prisma.legalDocumentTemplate.update({
      where: { key },
      data: { signatureScope: "employee_only" },
    });
    console.log(
      `  - UPDATE ${key} : ${tpl.signatureScope} -> employee_only (${tpl.title})`,
    );
  }

  // Mise a jour both
  for (const key of TO_BOTH) {
    const tpl = await prisma.legalDocumentTemplate.findUnique({
      where: { key },
      select: { id: true, title: true, signatureScope: true },
    });
    if (!tpl) {
      console.log(`  - SKIP ${key} : template introuvable en DB`);
      continue;
    }
    if (tpl.signatureScope === "both") {
      console.log(`  - SKIP ${key} : deja both`);
      continue;
    }
    await prisma.legalDocumentTemplate.update({
      where: { key },
      data: { signatureScope: "both" },
    });
    console.log(
      `  - UPDATE ${key} : ${tpl.signatureScope} -> both (${tpl.title})`,
    );
  }

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
