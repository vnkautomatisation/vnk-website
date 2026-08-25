"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LiveShiftCounter } from "@/components/admin/live-shift-counter";
import {
  Play, Pause, Square, FileSignature, AlertTriangle, CheckCircle2, Clock,
  Calculator, CalendarDays, GraduationCap, Megaphone, ArrowRight,
  Pin, ShieldCheck, Laptop, Smartphone, Briefcase, Cake, FileText,
  UserCheck, ClipboardList, Mail, BookOpen, Plane, Download, Wallet,
  HeartHandshake, FileBadge, Upload, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { clockInAction, clockOutAction, pauseClockAction, resumeClockAction } from "@/app/actions/hr-timeclock";
import { AnnouncementReadTracker } from "./annonces/announcement-read-tracker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";

function fmtHours(min: number): string {
  if (!min) return "0h00";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function getInitials(name: string | null, email: string) {
  return (name || email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function equipmentIcon(category: string) {
  const cat = (category || "").toLowerCase();
  if (cat === "laptop") return Laptop;
  if (cat === "phone") return Smartphone;
  return Briefcase;
}

function taxDocLabel(type: string): string {
  const map: Record<string, string> = {
    t4: "T4",
    releve1: "Relevé 1",
    employment_letter: "Lettre d'emploi",
    nr4: "NR4",
    t2200: "T2200",
  };
  return map[type] || type.toUpperCase();
}

type Me = {
  id: number;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  birthdate: string | null;
  position: { name: string; color: string | null } | null;
  customRole: { name: string; color: string | null } | null;
  team: { name: string; color: string | null } | null;
  manager: {
    id: number;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
    position: { name: string } | null;
  } | null;
};

type LeaveBalance = {
  vacationDaysTotal: number;
  vacationDaysTaken: number;
  vacationDaysPlanned: number;
  vacationDaysRemaining: number;
  sickDaysTaken: number;
};

type Equipment = { id: number; category: string; name: string; brand: string | null; model: string | null };

type Birthday = {
  id: number;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  positionName: string | null;
  nextBirthday: string;
  daysUntil: number;
  turningAge: number;
};

type TaxDoc = { id: number; type: string; taxYear: number | null; title: string; fileUrl: string | null; issuedAt: string };

type CompletionStep = { key: string; label: string; href: string; done: boolean; weight: number };
type JobCode = { id: number; code: string; label: string };

export function MonEspaceDashboard({
  me, openClock, weekHours,
  unsignedDocs, pendingContracts,
  expiringLicenses, expiringTrainings,
  pendingLeavesCount, recentPayStubs,
  announcements, upcomingOneOnOnes,
  leaveBalance, myEquipment, upcomingBirthdays,
  taxDocuments, completionPct, completionSteps,
  availableJobCodes,
  pendingUploadRequests = [],
  pendingSignatureRequests = [],
  recentNotifications = [],
}: {
  me: Me;
  openClock: { id: number; clockIn: string; category: string; pausedAt: string | null; totalBreakMin: number } | null;
  weekHours: number;
  unsignedDocs: Array<{ id: number; title: string; version: string }>;
  pendingContracts: Array<{ id: number; title: string }>;
  expiringLicenses: Array<{ id: number; type: string; expiresAt: string }>;
  expiringTrainings: Array<{ id: number; title: string; expiresAt: string }>;
  pendingLeavesCount: number;
  recentPayStubs: Array<{ id: number; netPay: number; period: { startDate: string; endDate: string } }>;
  announcements: Array<{ id: number; title: string; body: string; category: string; publishedAt: string; pinned: boolean; author: { fullName: string | null; email: string } | null; reads: Array<{ id: number }> }>;
  upcomingOneOnOnes: Array<{ id: number; scheduledAt: string; durationMin: number; admin: { id: number; fullName: string | null; email: string }; manager: { id: number; fullName: string | null; email: string } }>;
  leaveBalance: LeaveBalance | null;
  myEquipment: Equipment[];
  upcomingBirthdays: Birthday[];
  taxDocuments: TaxDoc[];
  completionPct: number;
  completionSteps: CompletionStep[];
  availableJobCodes: JobCode[];
  pendingUploadRequests?: Array<{ id: number; title: string; dueDate: string | null; isRequired: boolean; category: string; requestedBy: { fullName: string | null; email: string } | null }>;
  pendingSignatureRequests?: Array<{ id: number; dueDate: string | null; reason: string | null; targetAll: boolean; template: { id: number; title: string; version: string } }>;
  recentNotifications?: Array<{ id: number; title: string; body: string | null; type: string; link: string | null; icon: string | null; createdAt: string; readAt: string | null }>;
}) {
  const router = useRouter();
  const totalActions =
    unsignedDocs.length + pendingContracts.length + expiringLicenses.length +
    expiringTrainings.length + (me.twoFactorEnabled ? 0 : 1) +
    pendingUploadRequests.length + pendingSignatureRequests.length;

  // Dialog de selection du code au clock-in
  const [showJobCodeDialog, setShowJobCodeDialog] = useState(false);
  const [selectedJobCodeId, setSelectedJobCodeId] = useState<number | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; description?: string; filename?: string } | null>(null);

  const handleClockInClick = () => {
    // Si pas de codes dispos pour ce poste -> clock-in direct sans code
    if (availableJobCodes.length === 0) {
      void doClockIn(null);
      return;
    }
    // Sinon ouvrir le dialog pour choisir
    setSelectedJobCodeId(availableJobCodes[0]?.id ?? null);
    setShowJobCodeDialog(true);
  };

  const doClockIn = async (jobCodeId: number | null) => {
    const r = await clockInAction(jobCodeId ? { jobCodeId } : {});
    if (r.success) {
      const code = jobCodeId ? availableJobCodes.find((c) => c.id === jobCodeId)?.code : null;
      toast.success(code ? `Pointage démarré · ${code}` : "Pointage démarré");
      setShowJobCodeDialog(false);
      router.refresh();
    } else {
      toast.error(r.error || "");
    }
  };
  const handleClockOut = async () => {
    const r = await clockOutAction();
    if (r.success) { toast.success(`Pointage fermé · ${fmtHours(r.data.durationMin)}`); router.refresh(); }
    else toast.error(r.error || "");
  };
  const handlePause = async () => {
    const r = await pauseClockAction();
    if (r.success) { toast.success("En pause"); router.refresh(); }
    else toast.error(r.error || "");
  };
  const handleResume = async () => {
    const r = await resumeClockAction();
    if (r.success) {
      toast.success(r.data.breakAddedMin > 0 ? `Reprise · pause de ${fmtHours(r.data.breakAddedMin)}` : "Reprise");
      router.refresh();
    }
    else toast.error(r.error || "");
  };

  // KPI "Heures cette semaine" LIVE : si un shift est en cours, on incremente
  // 1 minute par tick. weekHours (prop server) inclut DEJA la duree du shift
  // ouvert au moment du fetch (calcule server-side). On ajoute juste le delta
  // depuis ce fetch.
  //
  // CRITIQUE : la dep du useEffect est openClock?.id (PRIMITIVE stable) et
  // non l'objet openClock entier (re-cree a chaque render via JSON serialization
  // -> ref instable -> effect en boucle). Reset explicite de tick a 0 quand
  // l'id change (clock-in -> clock-out -> clock-in laisserait sinon le tick
  // de la 1ere session se cumuler avec la 2eme).
  const openClockId = openClock?.id ?? null;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(0); // reset a chaque changement de pointage (in/out/in)
    if (!openClockId) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [openClockId]);
  const liveWeekHours = openClockId ? weekHours + tick : weekHours;

  const incompleteSteps = completionSteps.filter((s) => !s.done);

  return (
    <div className="space-y-4">
      {/* Hero VNK */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-12 w-12 rounded-full bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0 overflow-hidden"
              style={me.avatarUrl ? { backgroundImage: `url(${me.avatarUrl})`, backgroundSize: "cover" } : undefined}
            >
              {!me.avatarUrl && (
                <span className="text-base font-bold">
                  {getInitials(me.fullName, me.email)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">Bonjour {me.fullName?.split(" ")[0] || me.email}</h1>
              <div className="text-xs text-white/80 flex items-center gap-2 flex-wrap">
                {me.position && <span>{me.position.name}</span>}
                {me.team && <Badge variant="outline" className="bg-white/10 text-white border-white/30 text-[10px]">{me.team.name}</Badge>}
                {me.customRole && <Badge variant="outline" className="bg-white/10 text-white border-white/30 text-[10px]">{me.customRole.name}</Badge>}
              </div>
            </div>
          </div>
          {/* Quick clock : Pause / Reprendre / Arreter sur le shift en cours */}
          {openClock ? (
            <div className="flex items-center gap-2 shrink-0">
              {openClock.pausedAt ? (
                <>
                  <span className="px-2.5 py-1 rounded-md bg-amber-400/20 border border-amber-300/40 text-xs font-mono">
                    En pause
                  </span>
                  <Button variant="secondary" onClick={handleResume} size="sm">
                    <Play className="h-3.5 w-3.5 mr-1" />Reprendre
                  </Button>
                </>
              ) : (
                <>
                  <LiveShiftCounter
                    clockIn={openClock.clockIn}
                    pausedAt={openClock.pausedAt}
                    totalBreakMin={openClock.totalBreakMin}
                    variant="dark"
                  />
                  <Button variant="secondary" onClick={handlePause} size="sm">
                    <Pause className="h-3.5 w-3.5 mr-1" />Pause
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={handleClockOut} size="sm" className="bg-red-500/90 hover:bg-red-500 text-white border-0">
                <Square className="h-3.5 w-3.5 mr-1" />Arrêter
              </Button>
            </div>
          ) : (
            <Button onClick={handleClockInClick} variant="secondary" size="sm" className="shrink-0">
              <Play className="h-3.5 w-3.5 mr-1.5" />Commencer ma journée
            </Button>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <QuickAction icon={Plane} label="Demander un congé" href="/admin/mon-espace/conges" />
        <QuickAction icon={Mail} label="Demander une lettre" href="/admin/mon-espace/documents" />
        <QuickAction icon={FileSignature} label="Mon contrat" href="/admin/mon-espace/contrats" />
        <QuickAction icon={BookOpen} label="Mes politiques" href="/admin/mon-espace/politiques" />
      </div>

      {/* KPIs personnels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard label="Heures cette semaine" value={fmtHours(liveWeekHours)} icon={Clock} accent="emerald" />
        <KpiCard label="Actions à faire" value={String(totalActions)} icon={AlertTriangle} accent={totalActions > 0 ? "amber" : "emerald"} />
        <KpiCard label="Congés en attente" value={String(pendingLeavesCount)} icon={CalendarDays} accent={pendingLeavesCount > 0 ? "blue" : "muted"} />
        <KpiCard
          label="Dernière paie"
          value={recentPayStubs[0] ? `${Number(recentPayStubs[0].netPay).toFixed(2)} $` : "—"}
          icon={Calculator}
          accent="muted"
        />
      </div>

      {/* Solde de congés */}
      {leaveBalance && (
        <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-y-20 translate-x-20" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Plane className="h-4 w-4" />
                Mon solde de congés
              </h2>
              <Link href="/admin/mon-espace/conges" className="text-xs text-white/80 hover:text-white hover:underline">
                Gérer →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <LeaveBlock label="Disponibles" value={leaveBalance.vacationDaysRemaining} sub={`sur ${leaveBalance.vacationDaysTotal}`} highlight />
              <LeaveBlock label="Pris" value={leaveBalance.vacationDaysTaken} sub="cette année" />
              <LeaveBlock label="Planifiés" value={leaveBalance.vacationDaysPlanned} sub="à venir" />
              <LeaveBlock label="Maladie" value={leaveBalance.sickDaysTaken} sub="utilisés" />
            </div>
          </div>
        </div>
      )}

      {/* Actions à faire */}
      {totalActions > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <div className="p-4 space-y-2">
            <h2 className="font-bold text-sm flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Actions requises ({totalActions})
            </h2>
            <div className="space-y-1.5">
              {pendingUploadRequests.map((u) => (
                <ActionRow
                  key={`u-${u.id}`}
                  icon={Upload}
                  label={`Téléverser : ${u.title}${u.requestedBy ? ` (demandé par ${u.requestedBy.fullName ?? u.requestedBy.email})` : ""}`}
                  href="/admin/mon-espace/documents"
                  cta="Téléverser"
                  urgent={u.isRequired}
                />
              ))}
              {pendingSignatureRequests.map((s) => (
                <ActionRow
                  key={`sr-${s.id}`}
                  icon={FileSignature}
                  label={`Signer : ${s.template.title} (v${s.template.version})${s.targetAll ? " — pour tous les employés" : ""}`}
                  href="/admin/mon-espace/documents"
                  cta="Signer"
                  urgent={!!s.dueDate && new Date(s.dueDate).getTime() - Date.now() < 3 * 86400000}
                />
              ))}
              {!me.twoFactorEnabled && (
                <ActionRow
                  icon={ShieldCheck}
                  label="Activer la double authentification (2FA)"
                  href="/admin/settings/security"
                  cta="Configurer"
                />
              )}
              {pendingContracts.map((c) => (
                <ActionRow
                  key={`c-${c.id}`}
                  icon={FileSignature}
                  label={`Signer mon contrat : ${c.title}`}
                  href="/admin/mon-espace/contrats"
                  cta="Signer"
                  urgent
                />
              ))}
              {unsignedDocs.map((d) => (
                <ActionRow
                  key={`d-${d.id}`}
                  icon={FileSignature}
                  label={`Signer : ${d.title} (v${d.version})`}
                  href="/admin/mon-espace/documents"
                  cta="Lire & signer"
                />
              ))}
              {expiringLicenses.map((l) => (
                <ActionRow
                  key={`l-${l.id}`}
                  icon={AlertTriangle}
                  label={`Permis "${l.type}" expire le ${new Date(l.expiresAt).toLocaleDateString("fr-CA")}`}
                  href="/admin/mon-espace/formations"
                  cta="Voir"
                  urgent
                />
              ))}
              {expiringTrainings.map((t) => (
                <ActionRow
                  key={`t-${t.id}`}
                  icon={GraduationCap}
                  label={`Formation "${t.title}" expire le ${new Date(t.expiresAt).toLocaleDateString("fr-CA")}`}
                  href="/admin/mon-espace/formations"
                  cta="Voir"
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Complétion profil */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#0F2D52]" />
              Complétion de mon dossier
            </h2>
            <span className="text-xs font-semibold text-[#0F2D52] tabular-nums">{completionPct}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-[#0F2D52] to-[#15406d] transition-all"
              style={{ width: `${Math.min(100, completionPct)}%` }}
            />
          </div>
          {completionPct >= 100 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Profil complet — merci d&apos;avoir rempli toutes les informations.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {incompleteSteps.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  className="flex items-center gap-2 p-2 rounded-md bg-white border hover:border-[#0F2D52]/30 hover:shadow-sm transition"
                >
                  <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 shrink-0" aria-hidden />
                  <span className="flex-1 text-xs text-foreground">{s.label}</span>
                  <span className="text-[11px] font-semibold text-[#0F2D52] flex items-center gap-0.5">
                    Compléter
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Activité récente — dernières notifications de l'employé */}
      {recentNotifications.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#0F2D52]" />
              Activité récente
            </h2>
            <Link href="/admin/notifications" className="text-xs text-[#0F2D52] hover:underline">
              Toutes →
            </Link>
          </div>
          <div className="divide-y">
            {recentNotifications.slice(0, 6).map((n) => {
              const isUnread = !n.readAt;
              return (
                <div key={n.id} className={`p-3 flex items-start gap-3 ${isUnread ? "bg-[#0F2D52]/5" : ""}`}>
                  <div className="h-7 w-7 rounded-full bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                    <Bell className="h-3.5 w-3.5 text-[#0F2D52]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold truncate">{n.title}</p>
                      {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-[#0F2D52] shrink-0" />}
                    </div>
                    {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                      {new Date(n.createdAt).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {n.link && (
                    <Link href={n.link} className="text-[11px] text-[#0F2D52] hover:underline shrink-0 self-center">
                      Voir
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Grille 3 colonnes equilibrees : annonces a gauche, equipe au milieu, finances/equip a droite.
          Pas de max-h interne : tout coule naturellement avec le scroll de page (evite le double-scroll). */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {/* Colonne 1 : Annonces (peut etre la plus haute) */}
        <Card className="overflow-hidden md:col-span-2 lg:col-span-1">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[#0F2D52]" />
              Annonces récentes
            </h2>
            <Link href="/admin/mon-espace/annonces" className="text-xs text-[#0F2D52] hover:underline">
              Toutes →
            </Link>
          </div>
          <div className="divide-y">
            {announcements.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Aucune annonce récente.</p>
            ) : (
              announcements.map((a) => (
                <article key={a.id} className="p-4 hover:bg-muted/30 transition relative">
                  <AnnouncementReadTracker announcementId={a.id} alreadyRead={a.reads?.length > 0} />
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {a.pinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <Badge variant="outline" className="text-[9px]">{a.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-1">{a.body}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {a.author?.fullName || a.author?.email || "VNK"} · {new Date(a.publishedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}
                  </p>
                </article>
              ))
            )}
          </div>
        </Card>

        {/* Colonne 2 : Equipe (manager, 1-on-1, anniversaires) */}
        <div className="space-y-4">
          {/* Mon manager */}
          {me.manager && (
            <Card>
              <div className="p-4 border-b">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#0F2D52]" />
                  Mon manager
                </h2>
              </div>
              <div className="p-3 flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden"
                  style={me.manager.avatarUrl ? { backgroundImage: `url(${me.manager.avatarUrl})`, backgroundSize: "cover" } : undefined}
                >
                  {!me.manager.avatarUrl && getInitials(me.manager.fullName, me.manager.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{me.manager.fullName || me.manager.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{me.manager.position?.name ?? "—"}</p>
                </div>
              </div>
              <div className="px-3 pb-3">
                <Link
                  href={`/admin/employes/one-on-ones/new?manager=${me.manager.id}`}
                  className="block text-center text-xs font-semibold text-[#0F2D52] border border-[#0F2D52]/20 rounded-md py-1.5 hover:bg-[#0F2D52]/5 transition"
                >
                  Planifier un 1-on-1
                </Link>
              </div>
            </Card>
          )}

          {/* 1-on-1 */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="font-bold text-sm">Prochaines 1-on-1</h2>
            </div>
            <div className="p-3 space-y-2">
              {upcomingOneOnOnes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">Aucune réunion prévue.</p>
              ) : upcomingOneOnOnes.map((m) => {
                const other = m.admin.id === me.id ? m.manager : m.admin;
                return (
                  <div key={m.id} className="text-xs p-2 rounded-md bg-muted/40">
                    <p className="font-semibold">{other.fullName || other.email}</p>
                    <p className="text-muted-foreground">
                      {new Date(m.scheduledAt).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {" · "}{m.durationMin} min
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Anniversaires équipe */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Cake className="h-4 w-4 text-[#0F2D52]" />
                Anniversaires à venir
              </h2>
            </div>
            <div className="p-3 space-y-2">
              {upcomingBirthdays.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">Pas d&apos;anniversaire dans les 14 jours.</p>
              ) : upcomingBirthdays.map((b) => (
                <div key={b.id} className="text-xs p-2 rounded-md bg-muted/40 flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden"
                    style={b.avatarUrl ? { backgroundImage: `url(${b.avatarUrl})`, backgroundSize: "cover" } : undefined}
                  >
                    {!b.avatarUrl && getInitials(b.fullName, b.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{b.fullName || b.email}</p>
                    <p className="text-muted-foreground">
                      Le {new Date(b.nextBirthday).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
                      {b.daysUntil === 0 ? " (aujourd'hui)" : ` (dans ${b.daysUntil} j)`}
                      {" · "}aura {b.turningAge} ans
                    </p>
                  </div>
                  <HeartHandshake className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Colonne 3 : Finances et possessions (bulletins, equipement, docs fiscaux) */}
        <div className="space-y-4">
          {/* Bulletins récents */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#0F2D52]" />
                Bulletins récents
              </h2>
              <Link href="/admin/mon-espace/paie" className="text-xs text-[#0F2D52] hover:underline">Tous →</Link>
            </div>
            <div className="p-3 space-y-2">
              {recentPayStubs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">Aucun bulletin disponible.</p>
              ) : recentPayStubs.map((s) => (
                <div key={s.id} className="text-xs p-2 rounded-md bg-muted/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold">{Number(s.netPay).toFixed(2)} $</p>
                    <p className="text-muted-foreground truncate">
                      {new Date(s.period.startDate).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} → {new Date(s.period.endDate).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPdfPreview({
                        url: `/api/admin/pay-stubs/${s.id}/pdf`,
                        title: `Bulletin de paie #${s.id}`,
                        description: `${new Date(s.period.startDate).toLocaleDateString("fr-CA")} → ${new Date(s.period.endDate).toLocaleDateString("fr-CA")} · ${Number(s.netPay).toFixed(2)} $`,
                        filename: `bulletin-paie-${s.id}.pdf`,
                      })}
                      className="text-[11px] font-semibold text-[#0F2D52] hover:underline flex items-center gap-0.5"
                    >
                      <FileText className="h-3 w-3" />
                      PDF
                    </button>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Mon équipement */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#0F2D52]" />
                Mon équipement
              </h2>
              <Link href="/admin/mon-espace/equipement" className="text-xs text-[#0F2D52] hover:underline">Tout →</Link>
            </div>
            <div className="p-3 space-y-2">
              {myEquipment.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">Aucun équipement assigné.</p>
              ) : myEquipment.map((eq) => {
                const Icon = equipmentIcon(eq.category);
                const sub = [eq.brand, eq.model].filter(Boolean).join(" ");
                return (
                  <div key={eq.id} className="text-xs p-2 rounded-md bg-muted/40 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#0F2D52] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{eq.name}</p>
                      {sub && <p className="text-muted-foreground truncate">{sub}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Documents fiscaux */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FileBadge className="h-4 w-4 text-[#0F2D52]" />
                Documents fiscaux
              </h2>
              <Link href="/admin/mon-espace/documents" className="text-xs text-[#0F2D52] hover:underline">Tous →</Link>
            </div>
            <div className="p-3 space-y-2">
              {taxDocuments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">Aucun document fiscal disponible.</p>
              ) : taxDocuments.map((d) => (
                <div key={d.id} className="text-xs p-2 rounded-md bg-muted/40 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0F2D52] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {taxDocLabel(d.type)}{d.taxYear ? ` · ${d.taxYear}` : ""}
                    </p>
                    <p className="text-muted-foreground truncate">{d.title}</p>
                  </div>
                  {d.fileUrl && (
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[#0F2D52] hover:underline flex items-center gap-0.5 shrink-0"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Dialog : choix du code de tache au clock-in */}
      <Dialog open={showJobCodeDialog} onOpenChange={setShowJobCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir un code de tâche</DialogTitle>
            <DialogDescription>
              Sélectionnez la tâche sur laquelle vous allez travailler. Vous pourrez pointer
              <strong> Pause</strong>, <strong>Reprendre</strong> ou <strong>Arrêter</strong> ensuite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
            {availableJobCodes.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                Aucun code de tâche disponible pour votre poste.<br />
                Demandez à votre superviseur d&apos;en créer dans <em>RH → Codes de tâche</em>.
              </div>
            ) : (
              availableJobCodes.map((jc) => (
                <label
                  key={jc.id}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition ${
                    selectedJobCodeId === jc.id ? "border-[#0F2D52] bg-blue-50" : "hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="jobCode"
                    checked={selectedJobCodeId === jc.id}
                    onChange={() => setSelectedJobCodeId(jc.id)}
                    className="h-4 w-4"
                  />
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{jc.code}</span>
                  <span className="flex-1 text-sm">{jc.label}</span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJobCodeDialog(false)}>Annuler</Button>
            <Button
              onClick={() => selectedJobCodeId && doClockIn(selectedJobCodeId)}
              disabled={!selectedJobCodeId}
            >
              <Play className="h-4 w-4 mr-1.5" />Commencer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewModal
        open={!!pdfPreview}
        url={pdfPreview?.url ?? null}
        title={pdfPreview?.title ?? ""}
        description={pdfPreview?.description}
        downloadFilename={pdfPreview?.filename}
        onClose={() => setPdfPreview(null)}
      />
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "amber" | "blue" | "muted";
}) {
  const map = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    muted: "bg-card border-border text-foreground",
  };
  return (
    <div className={`rounded-lg border p-3 ${map[accent]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wider font-semibold opacity-80">{label}</span>
        <Icon className="h-3 w-3 opacity-60" />
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ActionRow({
  icon: Icon, label, href, cta, urgent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; href: string; cta: string; urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 p-2 rounded-md bg-white border hover:border-[#0F2D52]/30 hover:shadow-sm transition"
    >
      <Icon className={`h-4 w-4 shrink-0 ${urgent ? "text-red-600" : "text-amber-600"}`} />
      <span className="flex-1 text-xs text-foreground">{label}</span>
      <span className="text-[11px] font-semibold text-[#0F2D52] flex items-center gap-0.5">
        {cta}
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

function QuickAction({
  icon: Icon, label, href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:border-[#0F2D52]/40 hover:shadow-sm transition group"
    >
      <span className="h-8 w-8 rounded-md bg-[#0F2D52]/10 flex items-center justify-center group-hover:bg-[#0F2D52]/15 transition shrink-0">
        <Icon className="h-4 w-4 text-[#0F2D52]" />
      </span>
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </Link>
  );
}

function LeaveBlock({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-white/15 ring-1 ring-white/30" : "bg-white/5"}`}>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-white/70 mb-0.5">{label}</p>
      <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-white/60 mt-0.5">{sub}</p>}
    </div>
  );
}
