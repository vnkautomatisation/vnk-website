import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalMandatesList } from "./mandates-list";

export default async function PortalMandatesPage() {
  const session = await auth();
  const rawMandates = await prisma.mandate.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  const mandates = rawMandates.map((m) => ({
    ...m,
    estimatedHours: m.estimatedHours != null ? Number(m.estimatedHours) : null,
    actualHours: m.actualHours != null ? Number(m.actualHours) : null,
    hourlyRate: m.hourlyRate != null ? Number(m.hourlyRate) : null,
  }));
  return <PortalMandatesList mandates={mandates} />;
}
