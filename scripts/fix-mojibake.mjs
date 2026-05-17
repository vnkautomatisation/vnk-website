// Fix mojibake: undo UTF-8 → Windows-1252 → UTF-8 double-encoding.
// Usage: node scripts/fix-mojibake.mjs <file1> [file2 ...]
import { readFileSync, writeFileSync } from "node:fs";

// Windows-1252 specific chars (those with codepoints > 255) → byte value
const CP1252_MAP = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C],
  [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F],
]);

function fixFile(filepath) {
  const mojibake = readFileSync(filepath, "utf8");
  const bytes = Buffer.alloc(mojibake.length * 4); // overestimate
  let pos = 0;
  for (let i = 0; i < mojibake.length; i++) {
    const cp = mojibake.codePointAt(i);
    if (cp > 0xFFFF) i++; // surrogate pair
    if (cp <= 0xFF) {
      bytes[pos++] = cp;
    } else if (CP1252_MAP.has(cp)) {
      bytes[pos++] = CP1252_MAP.get(cp);
    } else {
      // Pas du mojibake : caractère unicode normal qu'on conserve tel quel (UTF-8 multi-byte)
      const enc = Buffer.from(String.fromCodePoint(cp), "utf8");
      for (const b of enc) bytes[pos++] = b;
    }
  }
  const fixed = bytes.subarray(0, pos).toString("utf8");
  // Sanity check : on doit avoir au moins quelques chars accentués réels après conversion
  if (fixed === mojibake) {
    console.log(`= ${filepath} (rien à faire)`);
    return false;
  }
  writeFileSync(filepath, fixed, "utf8");
  console.log(`✓ ${filepath}`);
  return true;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/fix-mojibake.mjs <file1> [file2 ...]");
  process.exit(1);
}

let count = 0;
for (const f of files) {
  try {
    if (fixFile(f)) count++;
  } catch (err) {
    console.error(`✗ ${f}: ${err.message}`);
  }
}
console.log(`\n${count}/${files.length} fichiers corrigés.`);
