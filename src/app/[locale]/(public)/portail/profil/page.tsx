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

  // Serialize for client component (remove passwordHash, convert dates)
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
    createdAt: client.createdAt.toISOString(),
  };

  return <ProfileForm client={data} />;
}
