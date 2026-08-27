// Wizard d'onboarding — premier login après acceptation d'invitation.
// Guide pas-à-pas : profil → 2FA → passkey → docs légaux → terminé.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./wizard";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("bienvenue_chez_vnk") };
}

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [admin, passkeys, requiredDocs, mySignatures] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true, email: true, fullName: true, avatarUrl: true,
        twoFactorEnabled: true, phone: true, title: true, bio: true,
        onboardingDone: true,
      },
    }),
    prisma.adminPasskey.count({ where: { adminId } }),
    prisma.legalDocumentTemplate.findMany({
      where: { isActive: true, isRequired: true },
      select: { id: true, title: true, version: true, key: true },
    }),
    prisma.legalDocumentSignature.findMany({
      where: { adminId },
      select: { templateId: true, version: true },
    }),
  ]);

  if (!admin) redirect("/admin/login");
  if (admin.onboardingDone) redirect("/admin");

  const signedKeys = new Set(mySignatures.map((s) => `${s.templateId}-${s.version}`));
  const unsignedRequired = requiredDocs.filter((d) => !signedKeys.has(`${d.id}-${d.version}`));

  return (
    <OnboardingWizard
      admin={{
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        avatarUrl: admin.avatarUrl,
        twoFactorEnabled: admin.twoFactorEnabled,
        phone: admin.phone,
        title: admin.title,
        bio: admin.bio,
      }}
      hasPasskey={passkeys > 0}
      unsignedDocs={unsignedRequired}
    />
  );
}
