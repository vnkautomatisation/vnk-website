// API · Changement de mot de passe (client ou admin) — avec HIBP check
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { captureRequestContext } from "@/lib/request-context";
import { logAudit } from "@/lib/audit";
import { checkPasswordBreached } from "@/lib/security/hibp";
import { logSecurityEvent } from "@/lib/security/security-events";

const schema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Minimum 8 caractères"),
  confirmPassword: z.string(),
  bypassBreachCheck: z.boolean().optional(), // user a vu le warning et veut quand meme proceder
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const role = session.user.role;

    // Fetch current password hash
    let currentHash: string | null = null;
    let entityId: number | null = null;

    if (role === "admin" && session.user.adminId) {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.adminId },
        select: { id: true, passwordHash: true },
      });
      currentHash = admin?.passwordHash ?? null;
      entityId = admin?.id ?? null;
    } else if (role === "client" && session.user.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: session.user.clientId },
        select: { id: true, passwordHash: true },
      });
      currentHash = client?.passwordHash ?? null;
      entityId = client?.id ?? null;
    }

    if (!currentHash || !entityId) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, currentHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Mot de passe actuel incorrect" },
        { status: 403 }
      );
    }

    // ── HIBP k-anonymity breach check ────────────────────────
    if (!parsed.data.bypassBreachCheck) {
      const breach = await checkPasswordBreached(newPassword);
      if (breach.breached) {
        return NextResponse.json(
          {
            error: "breach_detected",
            breachCount: breach.count,
            message: `Ce mot de passe a ete vu dans ${breach.count.toLocaleString("fr-CA")} fuites de donnees publiques. Choisissez-en un autre ou confirmez l'utilisation a vos risques.`,
          },
          { status: 422 }
        );
      }
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);
    const ctx = captureRequestContext(request);

    // Update
    if (role === "admin") {
      // Conserver les 5 derniers hash pour empecher reutilisation
      const current = await prisma.admin.findUnique({
        where: { id: entityId },
        select: { passwordHistory: true },
      });
      const history = (Array.isArray(current?.passwordHistory) ? current!.passwordHistory : []) as Array<{ hash: string; changedAt: string }>;
      const newHistory = [{ hash: currentHash, changedAt: new Date().toISOString() }, ...history].slice(0, 5);

      // Verifier reutilisation
      for (const past of history.slice(0, 5)) {
        if (await bcrypt.compare(newPassword, past.hash)) {
          return NextResponse.json(
            { error: "Vous avez deja utilise ce mot de passe recemment. Choisissez-en un nouveau." },
            { status: 422 }
          );
        }
      }

      await prisma.admin.update({
        where: { id: entityId },
        data: {
          passwordHash: newHash,
          passwordChangedAt: new Date(),
          passwordHistory: newHistory as never,
          lastPasswordIp: ctx.ipAddress,
        },
      });

      if (parsed.data.bypassBreachCheck) {
        await logSecurityEvent({
          adminId: entityId,
          type: "password_breach_detected",
          severity: "critical",
          message: "Mot de passe change malgre presence dans fuites publiques (HIBP)",
        });
      }
      await logSecurityEvent({
        adminId: entityId,
        type: "password_changed",
        message: "Mot de passe change",
      });
    } else {
      await prisma.client.update({
        where: { id: entityId },
        data: { passwordHash: newHash },
      });
    }

    await logAudit({
      adminId: role === "admin" ? entityId : null,
      action: "update",
      entityType: role === "admin" ? "admin" : "clients",
      entityId: entityId,
      changes: { type: "password_changed", actor: role },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return NextResponse.json({ ok: true, message: "Mot de passe modifié" });
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
