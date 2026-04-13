export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalRequestsList } from "./requests-list";

export default async function PortalRequestsPage() {
  const session = await auth();
  const rawRequests = await prisma.projectRequest.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  const requests = rawRequests.map((r) => ({
    id: r.id,
    serviceType: r.serviceType,
    description: r.description,
    status: r.status,
    urgencyLevel: r.urgency,
    createdAt: r.createdAt.toISOString(),
  }));
  return <PortalRequestsList requests={requests} />;
}
