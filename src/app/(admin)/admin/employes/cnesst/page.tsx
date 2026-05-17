import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CnesstView } from "./cnesst-view";

export default async function CnesstPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const [incidents, employees] = await Promise.all([
    prisma.cnesstIncident.findMany({
      orderBy: { incidentDate: "desc" },
      include: {
        admin: { select: { id: true, fullName: true, email: true } },
        reporter: { select: { fullName: true, email: true } },
      },
    }),
    prisma.admin.findMany({ where: { isActive: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, email: true } }),
  ]);

  return <CnesstView incidents={JSON.parse(JSON.stringify(incidents))} employees={employees} />;
}
