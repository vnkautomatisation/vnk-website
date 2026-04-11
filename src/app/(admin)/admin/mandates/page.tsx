import { prisma } from "@/lib/prisma";
import { MandatesTable } from "./mandates-table";

export default async function MandatesPage() {
  const mandates = await prisma.mandate.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <MandatesTable mandates={mandates} />;
}
