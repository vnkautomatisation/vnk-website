// Settings · Notifications Push — abonnements navigateur.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PushView } from "./push-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications push — VNK" };

export default async function PushPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

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
