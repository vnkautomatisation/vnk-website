#!/usr/bin/env node
// ─────────────────────────────────────────────────────────
// BREAK-GLASS : procédure d'urgence pour récupérer l'accès
// au portail si TOUS les super-admins sont verrouillés / 2FA
// perdue / mot de passe oublié.
//
// ⚠️ À exécuter UNIQUEMENT depuis une machine ayant accès
//    direct à la BD de production (Railway shell ou tunnel SSH).
//
// Usage :
//   node scripts/break-glass-admin.mjs --email admin@vnk.ca --action unlock
//   node scripts/break-glass-admin.mjs --email admin@vnk.ca --action reset-password --password "NouveauMdp12!"
//   node scripts/break-glass-admin.mjs --email admin@vnk.ca --action disable-2fa
//   node scripts/break-glass-admin.mjs --email admin@vnk.ca --action promote-super-admin
//   node scripts/break-glass-admin.mjs --list-super-admins
//
// Toutes les actions sont loggées dans AuditLog et AdminSecurityEvent
// avec source "break_glass" pour audit ultérieur.
// ─────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "readline";

const prisma = new PrismaClient();

// Parser CLI minimal
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
}

function rl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}
async function ask(question) {
  return new Promise((resolve) => {
    const r = rl();
    r.question(question, (answer) => {
      r.close();
      resolve(answer.trim());
    });
  });
}

async function confirmDangerous(label) {
  console.log("");
  console.log("⚠️  ACTION DESTRUCTIVE :", label);
  const a = await ask(`Tapez "JE CONFIRME" pour continuer : `);
  if (a !== "JE CONFIRME") {
    console.log("Annulé.");
    process.exit(1);
  }
}

async function logBreakGlass(adminId, action, details) {
  await prisma.auditLog.create({
    data: {
      adminId: null, // pas d'acteur admin — accès direct DB
      action: "update",
      entityType: "admin_break_glass",
      entityId: adminId,
      changes: { breakGlassAction: action, ...details, executedAt: new Date().toISOString() },
    },
  });
  await prisma.adminSecurityEvent.create({
    data: {
      adminId,
      type: "suspicious_login",
      severity: "critical",
      message: `BREAK-GLASS : ${action}`,
      metadata: { source: "break_glass_cli", ...details },
    },
  });
}

async function main() {
  if (flags["list-super-admins"]) {
    const supers = await prisma.admin.findMany({
      where: { customRole: { name: "super_admin" } },
      select: {
        id: true, email: true, fullName: true, isActive: true,
        twoFactorEnabled: true, lockedUntil: true, lastLogin: true,
      },
    });
    console.log("\nSuper-admins existants :");
    console.table(supers);
    process.exit(0);
  }

  const email = flags.email;
  const action = flags.action;

  if (!email || !action) {
    console.log("Usage : node scripts/break-glass-admin.mjs --email <email> --action <action>");
    console.log("Actions : unlock | reset-password | disable-2fa | promote-super-admin");
    console.log("Option : --list-super-admins pour lister les super-admins");
    process.exit(1);
  }

  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { customRole: true },
  });
  if (!admin) {
    console.error(`Admin "${email}" introuvable.`);
    process.exit(1);
  }

  console.log("\nCompte ciblé :");
  console.log("  ID         :", admin.id);
  console.log("  Email      :", admin.email);
  console.log("  Nom        :", admin.fullName);
  console.log("  Rôle       :", admin.customRole?.name ?? "(aucun)");
  console.log("  Actif      :", admin.isActive);
  console.log("  2FA active :", admin.twoFactorEnabled);
  console.log("  Verrouillé :", admin.lockedUntil ? `jusqu'à ${admin.lockedUntil.toISOString()}` : "non");
  console.log("");

  switch (action) {
    case "unlock": {
      await confirmDangerous("Déverrouiller le compte + remettre failedLoginAttempts à 0");
      await prisma.admin.update({
        where: { id: admin.id },
        data: { lockedUntil: null, failedLoginAttempts: 0, isActive: true },
      });
      await logBreakGlass(admin.id, "unlock", {});
      console.log("✓ Compte déverrouillé et réactivé");
      break;
    }
    case "reset-password": {
      const password = flags.password;
      if (!password || password.length < 12) {
        console.error("--password requis (min 12 caractères)");
        process.exit(1);
      }
      await confirmDangerous(`Réinitialiser le mot de passe + invalider toutes les sessions`);
      const hash = await bcrypt.hash(password, 12);
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          passwordHash: hash,
          passwordChangedAt: new Date(),
          sessionsInvalidatedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
      await logBreakGlass(admin.id, "reset_password", {});
      console.log("✓ Mot de passe réinitialisé · sessions invalidées");
      console.log("");
      console.log("⚠️  COMMUNIQUE LE MOT DE PASSE PAR CANAL SÉCURISÉ.");
      console.log("⚠️  L'UTILISATEUR DOIT LE CHANGER À LA PROCHAINE CONNEXION (manuellement via /admin/settings/security).");
      break;
    }
    case "disable-2fa": {
      await confirmDangerous("Désactiver la 2FA + supprimer les backup codes + invalider sessions");
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          sessionsInvalidatedAt: new Date(),
        },
      });
      await prisma.adminBackupCode.deleteMany({ where: { adminId: admin.id } });
      await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
      await logBreakGlass(admin.id, "disable_2fa", {});
      console.log("✓ 2FA désactivée · L'utilisateur devrait la réactiver immédiatement après reconnexion");
      break;
    }
    case "promote-super-admin": {
      const superRole = await prisma.role.findFirst({ where: { name: "super_admin" } });
      if (!superRole) {
        console.error("Rôle 'super_admin' introuvable dans la BD.");
        process.exit(1);
      }
      await confirmDangerous(`Promouvoir au rôle super_admin (accès total)`);
      await prisma.admin.update({
        where: { id: admin.id },
        data: { roleId: superRole.id, isActive: true },
      });
      await logBreakGlass(admin.id, "promote_super_admin", { roleId: superRole.id });
      console.log("✓ Compte promu super_admin");
      break;
    }
    default:
      console.error("Action inconnue :", action);
      console.error("Actions valides : unlock | reset-password | disable-2fa | promote-super-admin");
      process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erreur :", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
