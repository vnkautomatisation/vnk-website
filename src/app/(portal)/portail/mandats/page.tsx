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
    id: m.id,
    title: m.title,
    description: m.description,
    status: m.status,
    progress: m.progress,
    estimatedHours: m.estimatedHours != null ? Number(m.estimatedHours) : null,
    actualHours: m.actualHours != null ? Number(m.actualHours) : null,
    hourlyRate: m.hourlyRate != null ? Number(m.hourlyRate) : null,
    startDate: m.startDate?.toISOString() ?? null,
    endDate: m.endDate?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  }));
  return <PortalMandatesList mandates={mandates} />;
}
