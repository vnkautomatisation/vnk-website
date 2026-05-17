import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeavesView } from "../../employes/conges/leaves-view";
import { getLeaveBalance } from "@/lib/services/leave-balance";

export default async function MyCongesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [myRequests, balance] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      include: { reviewer: { select: { fullName: true, email: true } } },
    }),
    getLeaveBalance(adminId),
  ]);

  return (
    <LeavesView
      myRequests={JSON.parse(JSON.stringify(myRequests))}
      pendingReviews={[]}
      isReviewer={false}
      balance={balance}
    />
  );
}
