// Retro-remplit labelKey/labelParams sur les WorkflowEvent anterieurs a la bascule.
// La phrase stockee suit exactement un gabarit du catalogue FR : on la rejoue a
// l'envers pour en extraire les parametres. --apply pour ecrire, sinon essai a blanc.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const catalogue = {};
for (const file of ["api_errors.json", "workflow_events.json"]) {
  const p = path.join("messages", "fr", file);
  if (!fs.existsSync(p)) continue;
  const ns = file.replace(".json", "");
  flatten(JSON.parse(fs.readFileSync(p, "utf8")), ns, catalogue);
}

// Seules les cles que le code ecrit reellement comme labelKey sont candidates.
// Sans ce garde-fou, un gabarit presque entierement compose de marqueurs (un
// libelle d'audit, par exemple) avale n'importe quelle phrase et fabrique des
// parametres absurdes.
const allowed = new Set();
function collectKeys(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "node_modules") collectKeys(full); continue; }
    if (!/\.tsx?$/.test(entry.name)) continue;
    for (const m of fs.readFileSync(full, "utf8").matchAll(/labelKey: "((?:api_errors|workflow_events)\.[^"]+)"/g)) {
      allowed.add(m[1]);
    }
  }
}
collectKeys("src");
// Formes heritees : plus aucun code ne les ecrit, mais d'anciennes lignes les
// portent encore. Elles restent candidates pour la reconstruction seulement.
for (const key of Object.keys(catalogue)) {
  if (key.startsWith("workflow_events.legacy_")) allowed.add(key);
}
console.log(`cles autorisees (code + heritees) : ${allowed.size}`);

// Un gabarit "Facture {number} generee — {amount} $" devient un motif capturant.
const patterns = [];
for (const key of allowed) {
  const msg = catalogue[key];
  if (typeof msg !== "string") continue;
  if (msg.includes("{count,") || msg.includes("plural")) continue; // ICU : hors portee
  const names = [...msg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const rx = msg
    .split(/\{\w+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("(.+?)");
  const literal = msg.replace(/\{\w+\}/g, "").length;
  if (literal < 6) continue; // trop peu d'ancrage : ambigu par nature
  patterns.push({ key, names, rx: new RegExp("^" + rx + "$"), literal });
}
// Le gabarit le plus litteral gagne : il est le moins ambigu.
patterns.sort((a, b) => b.literal - a.literal);

const events = await prisma.workflowEvent.findMany({
  select: { id: true, eventType: true, eventLabel: true, metadata: true },
  orderBy: { id: "asc" },
});

let already = 0, matched = 0, unmatched = 0, cleaned = 0;
const misses = [];
for (const ev of events) {
  // Une cle posee par une passe precedente mais absente du jeu autorise est une
  // erreur de rattachement : on la retire avant de rejouer.
  if (ev.metadata && typeof ev.metadata === "object" && "labelKey" in ev.metadata) {
    if (allowed.has(ev.metadata.labelKey)) { already++; continue; }
    cleaned++;
    if (APPLY) {
      const { labelKey: _k, labelParams: _p, ...rest } = ev.metadata;
      await prisma.workflowEvent.update({ where: { id: ev.id }, data: { metadata: rest } });
    }
    ev.metadata = Object.fromEntries(
      Object.entries(ev.metadata).filter(([k]) => k !== "labelKey" && k !== "labelParams"));
  }
  const label = (ev.eventLabel ?? "").trim();
  if (!label) { unmatched++; continue; }
  let hit = null;
  for (const p of patterns) {
    const m = label.match(p.rx);
    if (!m) continue;
    const params = {};
    p.names.forEach((n, i) => { params[n] = m[i + 1]; });
    hit = { key: p.key, params };
    break;
  }
  if (!hit) { unmatched++; misses.push(`${ev.eventType} | ${label}`); continue; }
  matched++;
  if (APPLY) {
    await prisma.workflowEvent.update({
      where: { id: ev.id },
      data: { metadata: { ...(ev.metadata ?? {}), labelKey: hit.key, labelParams: hit.params } },
    });
  }
}

console.log(`evenements: ${events.length} | deja cles: ${already} | mal classees nettoyees: ${cleaned} | reconstruits: ${matched} | sans gabarit: ${unmatched}`);
if (misses.length) {
  console.log("\nsans gabarit (echantillon):");
  for (const m of [...new Set(misses)].slice(0, 15)) console.log("   " + m);
}
console.log(APPLY ? "\nECRIT en base." : "\nEssai a blanc. Relancer avec --apply pour ecrire.");
await prisma.$disconnect();
