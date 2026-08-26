// Seed the "hr_pointage" settings category (idempotent upserts).
// These rows appear automatically in the admin Settings UI and drive the
// time clock features: punch rounding, automatic meal break deduction,
// geolocation capture, geofencing, kiosk mode and photo verification.
// Run: npx tsx scripts/seed-timeclock-settings.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SETTINGS: Array<{
  key: string;
  value: string;
  type: string;
  label: string;
  description: string;
  sortOrder: number;
}> = [
  {
    key: "rounding_min",
    value: "0",
    type: "number",
    label: "Arrondi des punchs (minutes)",
    description: "0 = aucun arrondi. 5, 10 ou 15 : les heures d'entrée/sortie sont arrondies au pas le plus proche.",
    sortOrder: 10,
  },
  {
    key: "geoloc_enabled",
    value: "false",
    type: "boolean",
    label: "Capturer la position GPS au punch",
    description: "Demande la position au navigateur lors du punch (meilleure-effort : le punch passe même si refusée, sauf si géofencing actif).",
    sortOrder: 40,
  },
  {
    key: "geofence_enabled",
    value: "false",
    type: "boolean",
    label: "Géofencing (punch limité à une zone)",
    description: "Refuse le punch web hors du rayon défini ci-dessous. Nécessite la capture GPS.",
    sortOrder: 50,
  },
  {
    key: "geofence_lat",
    value: "",
    type: "string",
    label: "Géofence : latitude du centre",
    description: "Ex. 46.8139",
    sortOrder: 60,
  },
  {
    key: "geofence_lng",
    value: "",
    type: "string",
    label: "Géofence : longitude du centre",
    description: "Ex. -71.2080",
    sortOrder: 70,
  },
  {
    key: "geofence_radius_m",
    value: "250",
    type: "number",
    label: "Géofence : rayon (mètres)",
    description: "Distance maximale du centre pour autoriser le punch.",
    sortOrder: 80,
  },
  {
    key: "kiosk_enabled",
    value: "false",
    type: "boolean",
    label: "Mode kiosque (borne tablette)",
    description: "Active la page /kiosque : punch par NIP sans session personnelle. Les NIP se définissent dans le dossier de chaque employé.",
    sortOrder: 90,
  },
];

async function main() {
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { category_key: { category: "hr_pointage", key: s.key } },
      update: { label: s.label, description: s.description, type: s.type, sortOrder: s.sortOrder },
      create: {
        category: "hr_pointage",
        key: s.key,
        value: s.value,
        type: s.type,
        label: s.label,
        description: s.description,
        sortOrder: s.sortOrder,
      },
    });
  }
  console.log(`OK ${SETTINGS.length} settings hr_pointage seeded`);
}

main().then(() => prisma.$disconnect()).catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
