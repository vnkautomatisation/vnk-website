import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalRequestsList } from "./requests-list";

export default async function PortalRequestsPage() {
  const session = await auth();
  const requests = await prisma.projectRequest.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  return <PortalRequestsList requests={requests} />;
}
