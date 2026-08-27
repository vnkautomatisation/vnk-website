// Settings · Notifications Push — abonnements navigateur.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { PushView } from "./push-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("notifications_push_vnk") };
}

export default async function PushPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { adminId: session.user.adminId! },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PushView
      subscriptions={JSON.parse(JSON.stringify(subscriptions))}
      vapidConfigured={!!process.env.VAPID_PUBLIC_KEY}
    />
  );
}
