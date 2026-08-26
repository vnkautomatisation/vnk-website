"use server";
// Server Actions — wizard d'onboarding (premier login après invitation).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result = { success: true } | { success: false; error: string };

const profileSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().max(40).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  bio: z.string().max(280).nullable().optional(),
});

export async function updateOnboardingProfileAction(input: z.infer<typeof profileSchema>): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const adminId = session.user.adminId!;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  await prisma.admin.update({
    where: { id: adminId },
    data: {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone ?? null,
      title: parsed.data.title ?? null,
      bio: parsed.data.bio ?? null,
    },
  });
  await logAudit({ adminId, action: "update", entityType: "admin", entityId: adminId, changes: { onboardingProfile: true } });
  return { success: true };
}

export async function completeOnboardingAction(): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorized();
  }
  const adminId = session.user.adminId!;

  await prisma.admin.update({
    where: { id: adminId },
    data: {
      onboardingDone: true,
      onboardingSteps: { completedAt: new Date().toISOString() } as never,
    },
  });

  await logAudit({
    adminId,
    action: "update",
    entityType: "admin_onboarding",
    entityId: adminId,
    changes: { completed: true },
  });

  revalidatePath("/admin");
  return { success: true };
}
