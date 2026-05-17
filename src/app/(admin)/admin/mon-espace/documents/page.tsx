import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MyDocumentsView } from "./my-documents-view";

export default async function MyDocumentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const [legalToSign, taxDocs, letterRequests] = await Promise.all([
    prisma.legalDocumentTemplate.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      include: { signatures: { where: { adminId } } },
    }),
    prisma.taxDocument.findMany({
      where: { adminId },
      orderBy: [{ taxYear: "desc" }, { issuedAt: "desc" }],
      include: { issuer: { select: { fullName: true, email: true } } },
    }),
    prisma.employmentLetterRequest.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <MyDocumentsView
      legalDocs={JSON.parse(JSON.stringify(legalToSign))}
      taxDocs={JSON.parse(JSON.stringify(taxDocs))}
      letterRequests={JSON.parse(JSON.stringify(letterRequests))}
    />
  );
}
