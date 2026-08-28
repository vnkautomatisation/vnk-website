import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Megaphone, Pin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnnouncementReadTracker } from "./announcement-read-tracker";
import { dateLocale } from "@/lib/i18n-format";

export default async function AnnouncementsPage() {
  const dateTag = dateLocale(await getLocale());
  const t = await getTranslations("admin.announcements");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;
  const today = new Date();


  const me = await prisma.admin.findUnique({ where: { id: adminId }, select: { teamId: true, roleId: true } });
  const announcements = await prisma.announcement.findMany({
    where: {
      publishedAt: { not: null, lte: today },
      OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
    },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    include: {
      author: { select: { fullName: true, email: true, avatarUrl: true } },
      reads: { where: { adminId }, take: 1, select: { id: true } },
    },
  });


  const visible = announcements.filter((a) => {
    if (a.audienceType === "all") return true;
    if (a.audienceType === "team" && a.audienceTeamId === me?.teamId) return true;
    if (a.audienceType === "role" && a.audienceRoleId === me?.roleId) return true;
    return false;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-[#0F2D52]" />Annonces internes
        </h1>
        <p className="text-sm text-muted-foreground">{t("communications_direction_rh")}</p>
      </div>

      {visible.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("aucune_annonce_cours")}</Card>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => (
            <Card key={a.id} className={`p-4 ${a.pinned ? "border-amber-200 bg-amber-50/30" : ""}`}>
              <AnnouncementReadTracker announcementId={a.id} alreadyRead={(a.reads?.length ?? 0) > 0} />
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="font-bold flex items-center gap-1.5">
                    {a.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                    {a.title}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Par {a.author?.fullName || a.author?.email || "VNK"} · {new Date(a.publishedAt!).toLocaleDateString(dateTag, { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{a.category}</Badge>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{a.body}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
