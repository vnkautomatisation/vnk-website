// Mon profil admin
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { ProfileForm } from "./profile-form";
import { UserCircle } from "lucide-react";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const admin = await prisma.admin.findUnique({
    where: { id: session!.user.adminId! },
  });

  if (!admin) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Mon profil" subtitle="Vos informations personnelles et préférences" icon={UserCircle} />
      <ProfileForm admin={{ id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role }} />
    </div>
  );
}
