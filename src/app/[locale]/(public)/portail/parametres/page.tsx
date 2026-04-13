export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsView } from "./settings-view";

export default async function PortalSettingsPage() {
  const session = await auth();
  const client = await prisma.client.findUnique({
    where: { id: session!.user.clientId! },
    select: {
      id: true,
      email: true,
      twoFactorEnabled: true,
      lastLogin: true,
    },
  });

  if (!client) return null;

  return (
    <SettingsView
      email={client.email}
      twoFactorEnabled={client.twoFactorEnabled}
      lastLogin={client.lastLogin?.toISOString() ?? null}
    />
  );
}
