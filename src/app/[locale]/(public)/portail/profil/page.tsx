export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";

export default async function PortalProfilePage() {
  const session = await auth();
  const client = await prisma.client.findUnique({
    where: { id: session!.user.clientId! },
  });

  if (!client) return null;

  const data = {
    id: client.id,
    fullName: client.fullName,
    email: client.email,
    companyName: client.companyName ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    province: client.province ?? "QC",
    postalCode: client.postalCode ?? "",
    sector: client.sector ?? "",
    technologies: client.technologies ?? "",
    avatarUrl: client.avatarUrl ?? "",
    twoFactorEnabled: client.twoFactorEnabled,
    storageQuotaMb: client.storageQuotaMb,
    createdAt: client.createdAt.toISOString(),
    lastLogin: client.lastLogin?.toISOString() ?? null,
  };

  // Stats client
  const [mandateCount, invoiceCount, contractCount, documentCount] = await Promise.all([
    prisma.mandate.count({ where: { clientId: client.id } }),
    prisma.invoice.count({ where: { clientId: client.id } }),
    prisma.contract.count({ where: { clientId: client.id } }),
    prisma.document.count({ where: { clientId: client.id } }),
  ]);

  return (
    <ProfileForm
      client={data}
      stats={{ mandates: mandateCount, invoices: invoiceCount, contracts: contractCount, documents: documentCount }}
    />
  );
}
