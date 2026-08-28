// HR · Matrice formations (qui a quoi) · alertes expiration
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dateLocale } from "@/lib/i18n-format";

export default async function HrTrainingsPage() {
  const dateTag = dateLocale(await getLocale());
  const t = await getTranslations("admin.hr_nav");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!, { domain: "safety" }))) redirect("/admin/employes/organigramme");

  const today = new Date();
  const trainings = await prisma.trainingRecord.findMany({
    orderBy: [{ expiresAt: "asc" }, { completedAt: "desc" }],
    include: { admin: { select: { id: true, fullName: true, email: true, isActive: true } } },
  });


  const byTitle = new Map<string, typeof trainings>();
  for (const t of trainings) {
    if (!byTitle.has(t.title)) byTitle.set(t.title, []);
    byTitle.get(t.title)!.push(t);
  }

  const expired = trainings.filter((t) => t.expiresAt && new Date(t.expiresAt) < today && t.admin.isActive);
  const totalActive = trainings.filter((t) => t.admin.isActive).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[#0F2D52]" />Formations & cursus
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("vue_apos_ensemble_formations_suivies")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-xs uppercase tracking-wider text-muted-foreground">{t("total_enregistrees")}</p><p className="text-2xl font-bold">{totalActive}</p></Card>
        <Card className="p-3 bg-red-50/40 border-red-200"><p className="text-xs uppercase tracking-wider text-red-700">{t("expirees")}</p><p className="text-2xl font-bold text-red-900">{expired.length}</p></Card>
        <Card className="p-3"><p className="text-xs uppercase tracking-wider text-muted-foreground">{t("types_distincts")}</p><p className="text-2xl font-bold">{byTitle.size}</p></Card>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2">{t("formation")}</h2>
        <div className="space-y-2">
          {Array.from(byTitle.entries()).map(([title, list]) => (
            <Card key={title} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm">{title}</h3>
                <Badge variant="outline" className="text-[10px]">{list.length} personne{list.length > 1 ? "s" : ""}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((t) => {
                  const expiresInDays = t.expiresAt ? Math.floor((new Date(t.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
                  const colorClass = expiresInDays !== null && expiresInDays < 0 ? "text-red-700 border-red-300 bg-red-50"
                    : expiresInDays !== null && expiresInDays < 30 ? "text-amber-700 border-amber-300 bg-amber-50"
                    : "text-emerald-700 border-emerald-300 bg-emerald-50";
                  return (
                    <span key={t.id} className={`text-[11px] px-2 py-1 rounded-full border ${colorClass}`}>
                      {t.admin.fullName || t.admin.email}
                      {t.expiresAt && <span className="opacity-70 ml-1">· {new Date(t.expiresAt).toLocaleDateString(dateTag)}</span>}
                    </span>
                  );
                })}
              </div>
            </Card>
          ))}
          {byTitle.size === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">{t("aucune_formation_enregistree")}</Card>
          )}
        </div>
      </section>
    </div>
  );
}
