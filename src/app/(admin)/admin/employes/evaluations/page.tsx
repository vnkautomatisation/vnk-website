import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Award, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvaluationsList } from "./evaluations-list";

export default async function EvaluationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const reviews = await prisma.performanceReview.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      admin: { select: { id: true, fullName: true, email: true } },
      reviewer: { select: { id: true, fullName: true, email: true } },
    },
  });

  // Sérialiser dates en string pour passer au composant client
  const serialized = reviews.map((r) => ({
    id: r.id,
    status: r.status,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    rating: r.rating,
    admin: r.admin,
    reviewer: r.reviewer,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-[#0F2D52]" />Évaluations de performance
          </h1>
          <p className="text-sm text-muted-foreground">Reviews annuelles · objectifs · feedback formel.</p>
        </div>
        <Link href="/admin/employes/evaluations/new"><Button><Plus className="h-4 w-4 mr-1.5" />Nouvelle évaluation</Button></Link>
      </div>

      <EvaluationsList reviews={serialized} />
    </div>
  );
}
