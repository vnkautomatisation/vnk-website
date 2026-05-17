import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeavesView } from "./leaves-view";
import { getLeaveBalance } from "@/lib/services/leave-balance";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employés — Congés" };

export default async function CongesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isReviewer = me?.customRole?.name === "super_admin" || (perms.leaves ?? []).includes("write") || (perms.users ?? []).includes("write");

  const [myRequests, pendingReviews, balance] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      include: { reviewer: { select: { fullName: true, email: true } } },
    }),
    isReviewer
      ? prisma.leaveRequest.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          include: { admin: { select: { id: true, fullName: true, email: true } } },
        })
      : Promise.resolve([]),
    getLeaveBalance(adminId),
  ]);

  return (
    <LeavesView
      myRequests={JSON.parse(JSON.stringify(myRequests))}
      pendingReviews={JSON.parse(JSON.stringify(pendingReviews))}
      isReviewer={isReviewer}
      balance={balance}
    />
  );
}
