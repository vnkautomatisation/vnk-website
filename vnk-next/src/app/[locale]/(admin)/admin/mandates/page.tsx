import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { MandatesTable } from "./mandates-table";

export default async function MandatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const mandates = await prisma.mandate.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <MandatesTable mandates={mandates} />;
}
