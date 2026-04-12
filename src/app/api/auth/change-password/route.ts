// API · Changement de mot de passe (client ou admin)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Minimum 8 caractères"),
  confirmPassword: z.string(),
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

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update
    if (role === "admin") {
      await prisma.admin.update({
        where: { id: entityId },
        data: { passwordHash: newHash },
      });
    } else {
      await prisma.client.update({
        where: { id: entityId },
        data: { passwordHash: newHash },
      });
    }

    return NextResponse.json({ ok: true, message: "Mot de passe modifié" });
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
