import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { AnnouncementsAdminView } from "./annonces-view";

export default async function AnnouncementsAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!, { domain: "hr_comms" }))) redirect("/admin/employes/organigramme");

  const [announcements, teams, roles] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: { select: { fullName: true, email: true } },
        _count: { select: { reads: true } },
      },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return <AnnouncementsAdminView announcements={JSON.parse(JSON.stringify(announcements))} teams={teams} roles={roles} />;
}
