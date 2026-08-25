// Settings · Sauvegarde & Restauration de la configuration.
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { BackupView } from "./backup-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sauvegarde — VNK" };

export default async function BackupPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");
  return <BackupView />;
}
