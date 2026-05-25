// Nettoyage des notes TimeClock historiques.
// Retire les préfixes [REJET YYYY-MM-DD] et [ANNULATION APPROBATION YYYY-MM-DD]
// (avec ou sans raison) qui polluaient les notes utilisateur. L'historique
// vit désormais dans la table TimeClockHistory.
//
// Usage : node scripts/clean-timeclock-notes.mjs
// Idempotent : peut être relancé sans dégât.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

// Regex : capture les deux préfixes en début de ligne, suivis d'une raison
// optionnelle jusqu'au saut de ligne. Le préfixe peut apparaître sur plusieurs
// lignes consécutives (rejet -> annulation -> re-rejet), d'où le /g + boucle.
const PREFIX_RE = /^\[(REJET|ANNULATION APPROBATION) [^\]]+\][^\n]*\n?/;

function cleanNotes(raw) {
  if (!raw) return raw;
  let cleaned = raw;
  // Boucle : retire chaque préfixe en tête de chaîne jusqu'à plus en trouver.
  while (PREFIX_RE.test(cleaned)) {
    cleaned = cleaned.replace(PREFIX_RE, "");
  }
  cleaned = cleaned.trim();
  return cleaned === "" ? null : cleaned;
}

try {
  // On charge uniquement les notes qui contiennent au moins un préfixe.
  const candidates = await prisma.timeClock.findMany({
    where: {
      OR: [
        { notes: { contains: "[REJET " } },
        { notes: { contains: "[ANNULATION APPROBATION " } },
      ],
    },
    select: { id: true, notes: true, adminId: true, clockIn: true },
  });

  console.log(`(i) ${candidates.length} entree(s) avec prefixe historique trouvee(s).`);
  if (candidates.length === 0) {
    console.log("(OK) Rien a nettoyer.");
    process.exit(0);
  }

  let updated = 0;
  let unchanged = 0;
  for (const tc of candidates) {
    const next = cleanNotes(tc.notes);
    if (next === tc.notes) {
      unchanged++;
      continue;
    }
    await prisma.timeClock.update({
      where: { id: tc.id },
      data: { notes: next },
    });
    updated++;
    const dateStr = tc.clockIn.toISOString().slice(0, 10);
    console.log(`  #${tc.id} (admin ${tc.adminId}, ${dateStr}) : "${tc.notes?.slice(0, 60)}..." -> "${next?.slice(0, 60) ?? "(vide)"}"`);
  }

  console.log(`\n(OK) Nettoyage termine.`);
  console.log(`     ${updated} entree(s) nettoyee(s)`);
  console.log(`     ${unchanged} entree(s) inchangee(s) (faux positifs du LIKE)`);
} catch (e) {
  console.error("(X) Erreur :", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
