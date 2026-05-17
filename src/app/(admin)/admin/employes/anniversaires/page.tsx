// HR · Anniversaires (naissance + ancienneté).
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Cake, Award, Sparkles, Trophy, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function BirthdaysPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const today = new Date();
  const inNDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const admins = await prisma.admin.findMany({
    where: { isActive: true },
    select: {
      id: true, fullName: true, email: true, avatarUrl: true, startDate: true, birthdate: true,
      position: { select: { name: true } },
    },
  });

  // Anniversaires de naissance (≤ 30 jours)
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  type BirthdayItem = {
    id: number;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
    positionName: string | null;
    nextBirthday: Date;
    daysUntil: number;
    turningAge: number;
    isToday: boolean;
  };
  const birthdays: BirthdayItem[] = admins
    .filter((e) => e.birthdate)
    .map((e) => {
      const bd = new Date(e.birthdate!);
      const next = new Date(todayMidnight.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < todayMidnight) next.setFullYear(todayMidnight.getFullYear() + 1);
      const daysUntil = Math.round((next.getTime() - todayMidnight.getTime()) / 86400000);
      const turningAge = next.getFullYear() - bd.getFullYear();
      return {
        id: e.id,
        fullName: e.fullName,
        email: e.email,
        avatarUrl: e.avatarUrl,
        positionName: e.position?.name ?? null,
        nextBirthday: next,
        daysUntil,
        turningAge,
        isToday: daysUntil === 0,
      };
    })
    .filter((b) => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const formatBirthDate = (d: Date) =>
    d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });

  // Anniversaires de travail (jubilés)
  const workAnniversaries = admins
    .filter((a) => a.startDate)
    .map((a) => {
      const start = new Date(a.startDate!);
      const thisYearAnniv = new Date(today.getFullYear(), start.getMonth(), start.getDate());
      const nextAnniv = thisYearAnniv < today ? new Date(today.getFullYear() + 1, start.getMonth(), start.getDate()) : thisYearAnniv;
      const yearsCompleted = today.getFullYear() - start.getFullYear() - (today < thisYearAnniv ? 1 : 0);
      const yearsAtNext = nextAnniv.getFullYear() - start.getFullYear();
      const daysUntil = Math.floor((nextAnniv.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      return { ...a, nextAnniv, yearsCompleted, yearsAtNext, daysUntil };
    })
    .filter((a) => a.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const milestones = workAnniversaries.filter((a) => [1, 5, 10, 15, 20, 25].includes(a.yearsAtNext));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Cake className="h-5 w-5 text-pink-500" />Anniversaires</h1>
        <p className="text-sm text-muted-foreground">Anniversaires de naissance (30 jours) et anniversaires de travail (60 jours).</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider flex items-center gap-2">
          <Cake className="h-4 w-4 text-[#0F2D52]" />Anniversaires (naissance)
          {birthdays.length > 0 && <span className="text-muted-foreground normal-case font-normal">({birthdays.length})</span>}
        </h2>
        {birthdays.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucun anniversaire dans les 30 prochains jours.</Card>
        ) : (
          <Card>
            <div className="divide-y">
              {birthdays.map((b) => (
                <div key={b.id} className="p-3 flex items-center gap-3 text-sm">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={b.avatarUrl ? { backgroundImage: `url(${b.avatarUrl})`, backgroundSize: "cover" } : undefined}>
                    {!b.avatarUrl && (b.fullName || b.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{b.fullName || b.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.positionName ?? "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {b.isToday ? (
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300">Aujourd&apos;hui</Badge>
                    ) : (
                      <p className="text-xs font-medium">{formatBirthDate(b.nextBirthday)} <span className="text-muted-foreground">(dans {b.daysUntil} j)</span></p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">aura {b.turningAge} ans</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {milestones.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />Jubilés à célébrer ({milestones.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {milestones.map((m) => (
              <Card key={m.id} className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="text-amber-600">
                    {m.yearsAtNext >= 20 ? <Trophy className="h-8 w-8" /> :
                     m.yearsAtNext >= 10 ? <Award className="h-8 w-8" /> :
                     m.yearsAtNext >= 5 ? <Star className="h-8 w-8" /> :
                     <Sparkles className="h-8 w-8" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{m.fullName || m.email}</p>
                    <p className="text-xs text-muted-foreground">{m.position?.name ?? "—"}</p>
                    <p className="text-sm font-semibold text-amber-700 mt-1">
                      {m.yearsAtNext} an{m.yearsAtNext > 1 ? "s" : ""} dans {m.daysUntil} jour{m.daysUntil > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider flex items-center gap-2">
          <Award className="h-4 w-4 text-[#0F2D52]" />Tous les anniversaires de travail à venir
        </h2>
        {workAnniversaries.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucun anniversaire dans les 60 prochains jours.</Card>
        ) : (
          <Card>
            <div className="divide-y">
              {workAnniversaries.map((a) => (
                <div key={a.id} className="p-3 flex items-center gap-3 text-sm">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-xs font-bold"
                    style={a.avatarUrl ? { backgroundImage: `url(${a.avatarUrl})`, backgroundSize: "cover" } : undefined}>
                    {!a.avatarUrl && (a.fullName || a.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{a.fullName || a.email}</p>
                    <p className="text-xs text-muted-foreground">{a.position?.name ?? "—"} · Débuté le {new Date(a.startDate!).toLocaleDateString("fr-CA")}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-[10px]">{a.yearsAtNext} an{a.yearsAtNext > 1 ? "s" : ""}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{a.daysUntil === 0 ? "Aujourd'hui !" : `Dans ${a.daysUntil} j`}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
