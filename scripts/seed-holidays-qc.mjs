// Seed des jours feries Quebec pour 2025-2030.
// Idempotent : skip les entrees deja presentes (contrainte unique (date, name)).
//
// Usage : node scripts/seed-holidays-qc.mjs
//
// Liste des feries officiels (Loi sur les normes du travail) + ferie federal :
//   - Jour de l'An (1er janvier)
//   - Vendredi saint (Paques - 2 jours)
//   - Lundi de Paques (Paques + 1 jour)
//   - Fete des Patriotes (lundi precedant le 25 mai)
//   - Fete nationale (24 juin)
//   - Fete du Canada (1er juillet)
//   - Fete du travail (1er lundi de septembre)
//   - Action de grace (2e lundi d'octobre)
//   - Noel (25 decembre)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

// Calcul de la date de Paques (algorithme de Gauss/Meeus)
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Lundi precedant le 25 mai (Fete des Patriotes)
function patriotesDay(year) {
  const may25 = new Date(year, 4, 25);
  const dow = may25.getDay(); // 0 = dim ... 6 = sam
  // Si lundi (1) on prend le 18 (25-7) ; sinon on remonte au lundi precedent
  const offset = dow === 0 ? 6 : dow === 1 ? 7 : dow - 1;
  return new Date(year, 4, 25 - offset);
}

// Nieme lundi du mois
function nthMonday(year, month, n) {
  const d = new Date(year, month, 1);
  const offset = (8 - d.getDay()) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function holidaysForYear(year) {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);
  return [
    { date: new Date(year, 0, 1), name: "Jour de l'An", type: "statutory", isPaid: true },
    { date: goodFriday, name: "Vendredi saint", type: "statutory", isPaid: true },
    { date: easterMonday, name: "Lundi de Paques", type: "statutory", isPaid: true },
    { date: patriotesDay(year), name: "Fete des Patriotes", type: "statutory", isPaid: true },
    { date: new Date(year, 5, 24), name: "Fete nationale du Quebec", type: "statutory", isPaid: true },
    { date: new Date(year, 6, 1), name: "Fete du Canada", type: "statutory", isPaid: true },
    { date: nthMonday(year, 8, 1), name: "Fete du travail", type: "statutory", isPaid: true },
    { date: nthMonday(year, 9, 2), name: "Action de grace", type: "statutory", isPaid: true },
    { date: new Date(year, 11, 25), name: "Noel", type: "statutory", isPaid: true },
  ];
}

try {
  const years = [2025, 2026, 2027, 2028, 2029, 2030];
  let inserted = 0;
  let skipped = 0;
  for (const year of years) {
    const hs = holidaysForYear(year);
    for (const h of hs) {
      try {
        await prisma.holiday.create({
          data: {
            date: h.date,
            name: h.name,
            type: h.type,
            isPaid: h.isPaid,
          },
        });
        inserted++;
        const ds = h.date.toISOString().slice(0, 10);
        console.log(`  + ${ds} ${h.name}`);
      } catch (e) {
        if (String(e.message || "").includes("Unique constraint")) {
          skipped++;
        } else {
          console.error(`  ! Erreur pour ${h.name} ${h.date.toISOString().slice(0, 10)} :`, e.message);
        }
      }
    }
  }
  console.log(`\n(OK) Seed termine.`);
  console.log(`     ${inserted} ferie(s) ajoute(s)`);
  console.log(`     ${skipped} deja present(s) (skip)`);
} catch (e) {
  console.error("(X) Erreur :", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
