"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type ActionResult = { success: true } | { success: false; error: string };

// ── Mettre a jour le profil (nom, avatar) ──────────────────
const profileSchema = z.object({
  fullName: z.string().min(1, "Nom requis").max(200),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export async function updateProfileAction(
  input: z.infer<typeof profileSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorise" };
  }
  const adminId = session.user.adminId!;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const before = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { fullName: true, avatarUrl: true },
    });

    await prisma.admin.update({
      where: { id: adminId },
      data: {
        fullName: parsed.data.fullName,
        avatarUrl: parsed.data.avatarUrl || null,
      },
    });

    await logAudit({
      adminId,
      action: "update",
      entityType: "admin",
      entityId: adminId,
      changes: {
        before: { fullName: before?.fullName, avatarUrl: before?.avatarUrl },
        after: { fullName: parsed.data.fullName, avatarUrl: parsed.data.avatarUrl },
      },
    });

    revalidatePath("/admin/profile");
    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur lors de la mise a jour" };
  }
}

// ── Revoquer une session ────────────────────────────────────
export async function revokeSessionAction(
  sessionId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorise" };
  }
  const adminId = session.user.adminId!;

  try {
    // Verifier que la session appartient a cet admin
    const target = await prisma.adminSession.findUnique({
      where: { id: sessionId },
    });
    if (!target || target.adminId !== adminId) {
      return { success: false, error: "Session introuvable" };
    }

    await prisma.adminSession.delete({ where: { id: sessionId } });

    await logAudit({
      adminId,
      action: "delete",
      entityType: "admin_session",
      entityId: null,
      changes: { sessionId, ip: target.ipAddress },
    });

    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur lors de la revocation" };
  }
}

// ── Revoquer toutes les autres sessions ─────────────────────
export async function revokeAllOtherSessionsAction(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorise" };
  }
  const adminId = session.user.adminId!;

  try {
    const result = await prisma.adminSession.deleteMany({
      where: { adminId },
    });

    await logAudit({
      adminId,
      action: "delete",
      entityType: "admin_session",
      entityId: null,
      changes: { revokedCount: result.count },
    });

    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur lors de la revocation" };
  }
}
