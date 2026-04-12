import { prisma } from "@/lib/prisma";
import { MandatesTable } from "./mandates-table";

export default async function MandatesPage() {
  const rawMandates = await prisma.mandate.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const mandates = rawMandates.map((m) => ({
    ...m,
    estimatedHours: m.estimatedHours != null ? Number(m.estimatedHours) : null,
    actualHours: m.actualHours != null ? Number(m.actualHours) : null,
    hourlyRate: m.hourlyRate != null ? Number(m.hourlyRate) : null,
  }));

  return <MandatesTable mandates={mandates} />;
}
