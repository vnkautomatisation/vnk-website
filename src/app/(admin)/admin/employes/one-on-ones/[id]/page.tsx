import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { OneOnOneEditor } from "./editor";

export default async function OneOnOneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;
  const { id } = await params;

  const meeting = await prisma.oneOnOneMeeting.findUnique({
    where: { id: Number(id) },
    include: {
      admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      manager: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
  });
  if (!meeting) notFound();

  const isManager = meeting.managerId === adminId;
  const isEmployee = meeting.adminId === adminId;
  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr = me?.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write") || (perms.users ?? []).includes("write");

  if (!isManager && !isEmployee && !isHr) redirect("/admin/employes/one-on-ones");

  return (
    <OneOnOneEditor
      meeting={JSON.parse(JSON.stringify(meeting))}
      isManager={isManager || isHr}
      isEmployee={isEmployee}
      currentAdminId={adminId}
    />
  );
}
