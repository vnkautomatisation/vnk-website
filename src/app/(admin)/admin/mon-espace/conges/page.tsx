import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeavesView } from "../../employes/conges/leaves-view";

export default async function MyCongesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const myRequests = await prisma.leaveRequest.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    include: { reviewer: { select: { fullName: true, email: true } } },
  });

  return (
    <LeavesView
      myRequests={JSON.parse(JSON.stringify(myRequests))}
      pendingReviews={[]}
      isReviewer={false}
    />
  );
}
