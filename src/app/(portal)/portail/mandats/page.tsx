import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalMandatesList } from "./mandates-list";

export default async function PortalMandatesPage() {
  const session = await auth();
  const mandates = await prisma.mandate.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  return <PortalMandatesList mandates={mandates} />;
}
