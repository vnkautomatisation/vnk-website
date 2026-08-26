// Schema migrations, applied automatically at start-up.
//
// This project uses `prisma db push` rather than a migrations folder, so the
// columns added by a deploy have to be created explicitly. Every statement
// here is idempotent, so running it on every boot costs one round trip and
// nothing else. Wired into `npm start`: an unreachable database or a failed
// ALTER stops the boot rather than serving requests against a stale schema.
//
// Run it by hand with: node scripts/migrate.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

/** Provenance of a merged or restored punch. Structural, not a note prefix. */
async function timeclockMergeMeta() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE time_clocks
      ADD COLUMN IF NOT EXISTS merged_from INTEGER,
      ADD COLUMN IF NOT EXISTS merged_gap_min INTEGER,
      ADD COLUMN IF NOT EXISTS restored_from_snapshot_id INTEGER
  `);
  // Backfill from the legacy "[FUSION de N pointages]" / "[RESTAURÉ]" prefixes,
  // then strip them: `notes` belongs to the employee.
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, notes FROM time_clocks
    WHERE notes LIKE '[FUSION%' OR notes LIKE '[RESTAUR%'
  `);
  let backfilled = 0;
  for (const row of rows) {
    const merged = /^\[FUSION de (\d+) pointages?\]\s*/.exec(row.notes ?? "");
    const restored = /^\[RESTAUR[^\]]*\]\s*/.exec(row.notes ?? "");
    const prefix = merged ?? restored;
    if (!prefix) continue;
    const cleaned = (row.notes ?? "").slice(prefix[0].length).trim() || null;
    await prisma.timeClock.update({
      where: { id: row.id },
      data: { notes: cleaned, ...(merged ? { mergedFrom: Number(merged[1]) } : {}) },
    });
    backfilled++;
  }
  return backfilled;
}

/** Public holidays on a pay stub: worked at 2x, or the indemnity when not worked. */
async function paystubHolidayPay() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE pay_stubs
      ADD COLUMN IF NOT EXISTS hours_holiday NUMERIC(6,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS holiday_indemnity NUMERIC(10,2) NOT NULL DEFAULT 0
  `);
}

try {
  const backfilled = await timeclockMergeMeta();
  await paystubHolidayPay();
  console.log(`[migrate] schema ready${backfilled ? ` (${backfilled} punch notes cleaned)` : ""}`);
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
