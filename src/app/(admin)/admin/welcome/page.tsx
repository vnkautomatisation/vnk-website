// Onboarding nouvel utilisateur — affiché à la 1re connexion après acceptation d'invitation
import { auth } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { WelcomeWizard } from "./welcome-wizard";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("bienvenue_vnk") };
}

export default async function WelcomePage() {
  const t = await getTranslations("admin.welcome");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const admin = await prisma.admin.findUnique({
    where: { id: session.user.adminId! },
    select: {
      id: true,
      email: true,
      fullName: true,
      twoFactorEnabled: true,
      onboardingDone: true,
      avatarUrl: true,
      title: true,
      department: true,
      customRole: { select: { name: true, color: true } },
      position: { select: { name: true, color: true } },
    },
  });

  if (!admin) redirect("/admin/login");

  // Si onboarding déjà fait, rediriger vers dashboard
  if (admin.onboardingDone) redirect("/admin");

  // Récupère la politique 2FA depuis settings
  const policySetting = await prisma.setting.findUnique({
    where: { category_key: { category: "security", key: "require2FAForAdmins" } },
  }).catch(() => null);
  const require2FA = policySetting?.value === "true";

  return <WelcomeWizard admin={JSON.parse(JSON.stringify(admin))} require2FA={require2FA} />;
}
