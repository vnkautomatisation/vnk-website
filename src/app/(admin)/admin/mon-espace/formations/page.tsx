import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TrainingsView } from "./trainings-view";

export default async function MyTrainingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [licenses, trainings] = await Promise.all([
    prisma.professionalLicense.findMany({ where: { adminId }, orderBy: { expiresAt: "asc" } }),
    prisma.trainingRecord.findMany({ where: { adminId }, orderBy: [{ expiresAt: "asc" }, { completedAt: "desc" }] }),
  ]);

  return (
    <TrainingsView
      adminId={adminId}
      licenses={JSON.parse(JSON.stringify(licenses))}
      trainings={JSON.parse(JSON.stringify(trainings))}
    />
  );
}
