import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { EvaluationEditor } from "./editor";

export default async function EvaluationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;
  const { id } = await params;

  const review = await prisma.performanceReview.findUnique({
    where: { id: Number(id) },
    include: {
      admin: { select: { id: true, fullName: true, email: true } },
      reviewer: { select: { id: true, fullName: true, email: true } },
    },
  });
  if (!review) notFound();

  const isReviewer = review.reviewerId === adminId;
  const isEmployee = review.adminId === adminId;
  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr = me?.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write");

  if (!isReviewer && !isEmployee && !isHr) redirect("/admin/employes/evaluations");

  return (
    <EvaluationEditor
      review={JSON.parse(JSON.stringify(review))}
      isReviewer={isReviewer || isHr}
      isEmployee={isEmployee}
    />
  );
}
