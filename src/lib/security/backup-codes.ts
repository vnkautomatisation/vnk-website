// ============================================================
// Generation + hash des codes de recuperation 2FA
// Format: XXXX-XXXX (8 caracteres alphanumeriques, lowercase)
// Stockes hashes SHA-256, montres une seule fois au user.
// ============================================================

import { prisma } from "@/lib/prisma";

const CODE_LEN = 8;
const CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // sans 0/O/1/l/i

export function generateBackupCode(): string {
  const arr = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(arr);
  const code = Array.from(arr).map((n) => CHARS[n % CHARS.length]).join("");
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function hashBackupCode(code: string): Promise<string> {
  const normalized = code.replace(/-/g, "").toLowerCase();
  const enc = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Regenere 10 codes pour un admin (revoque les anciens)
export async function regenerateBackupCodes(adminId: number): Promise<string[]> {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const c = generateBackupCode();
    codes.push(c);
    hashes.push(await hashBackupCode(c));
  }

  await prisma.$transaction([
    prisma.adminBackupCode.deleteMany({ where: { adminId } }),
    prisma.adminBackupCode.createMany({
      data: hashes.map((codeHash) => ({ adminId, codeHash })),
    }),
  ]);

  return codes;
}

// Verifie + consomme un code (one-time)
export async function consumeBackupCode(adminId: number, code: string): Promise<boolean> {
  const hash = await hashBackupCode(code);
  const row = await prisma.adminBackupCode.findFirst({
    where: { adminId, codeHash: hash, usedAt: null },
  });
  if (!row) return false;
  await prisma.adminBackupCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return true;
}

// Compte les codes restants
export async function countRemainingBackupCodes(adminId: number): Promise<number> {
  return prisma.adminBackupCode.count({ where: { adminId, usedAt: null } });
}
