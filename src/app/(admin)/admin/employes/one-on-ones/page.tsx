import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MessageSquare, Clock } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateLocale } from "@/lib/i18n-format";

export default async function OneOnOnesPage() {
  const dateTag = dateLocale(await getLocale());
  const t = await getTranslations("admin.hr_nav");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;
  const today = new Date();

  const [upcoming, past] = await Promise.all([
    prisma.oneOnOneMeeting.findMany({
      where: { OR: [{ adminId }, { managerId: adminId }], scheduledAt: { gte: today }, status: { in: ["scheduled", "rescheduled"] } },
      orderBy: { scheduledAt: "asc" },
      include: {
        admin: { select: { fullName: true, email: true } },
        manager: { select: { fullName: true, email: true } },
      },
    }),
    prisma.oneOnOneMeeting.findMany({
      where: { OR: [{ adminId }, { managerId: adminId }], scheduledAt: { lt: today } },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      include: {
        admin: { select: { fullName: true, email: true } },
        manager: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5 text-[#0F2D52]" />{t("reunions_1_on_1")}</h1>
          <p className="text-sm text-muted-foreground">{t("mes_1_on_1_comme")}</p>
        </div>
        <Link href="/admin/employes/one-on-ones/new"><Button>{t("planifier")}</Button></Link>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider">{t("a_venir_count", { count: upcoming.length })}</h2>
        {upcoming.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">{t("aucune_reunion_planifiee")}</Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <Link key={m.id} href={`/admin/employes/one-on-ones/${m.id}`}>
                <Card className="p-4 hover:bg-muted/30 transition flex items-center gap-3">
                  <Clock className="h-4 w-4 text-[#0F2D52]" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {m.admin.fullName || m.admin.email} <span className="text-muted-foreground">↔</span> {m.manager.fullName || m.manager.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.scheduledAt).toLocaleString(dateTag, { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {m.durationMin} min
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider">{t("passees")}</h2>
          <div className="space-y-2">
            {past.map((m) => (
              <Link key={m.id} href={`/admin/employes/one-on-ones/${m.id}`}>
                <Card className="p-3 hover:bg-muted/30 transition flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{new Date(m.scheduledAt).toLocaleDateString(dateTag)}</span>
                  <span className="flex-1">
                    {m.admin.fullName || m.admin.email} ↔ {m.manager.fullName || m.manager.email}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{m.status === "held" ? "Tenue" : m.status}</Badge>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
