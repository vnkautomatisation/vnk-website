import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmergencyContactsView } from "./emergency-view";

export default async function EmergencyPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const contacts = await prisma.emergencyContact.findMany({
    where: { adminId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });
  return <EmergencyContactsView adminId={adminId} contacts={JSON.parse(JSON.stringify(contacts))} />;
}
