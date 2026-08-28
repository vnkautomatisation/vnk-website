"use client";
// Vue Maintenance — fenêtres planifiées, incidents, bandeau d'annonce.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Wrench, ChevronLeft, Plus, MoreHorizontal, Edit, Trash2,
  AlertTriangle, Megaphone, Calendar, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MaintenanceDialog } from "./maintenance-dialog";
import { IncidentDialog } from "./incident-dialog";
import {
  deleteMaintenanceAction, deleteIncidentAction, updateAnnouncementBannerAction,
} from "@/app/actions/maintenance";

export type MaintenanceRow = {
  id: number; title: string; description: string | null;
  startsAt: string; endsAt: string;
  isActive: boolean; affectsPortal: boolean; affectsAdmin: boolean; affectsPublic: boolean;
  createdAt: string;
};
export type IncidentRow = {
  id: number; title: string; description: string;
  severity: string; status: string;
  startedAt: string; resolvedAt: string | null;
  isPublic: boolean; createdAt: string;
};

type Tab = "banner" | "windows" | "incidents";

const SEVERITY_BADGE: Record<string, { labelKey: string; color: string }> = {
  minor: { labelKey: "mineur", color: "bg-blue-500" },
  major: { labelKey: "majeur", color: "bg-amber-500" },
  critical: { labelKey: "critique", color: "bg-red-600" },
};
const STATUS_BADGE: Record<string, { labelKey: string; color: string }> = {
  investigating: { labelKey: "investigation", color: "bg-red-500" },
  identified: { labelKey: "identifie", color: "bg-amber-500" },
  monitoring: { labelKey: "surveillance", color: "bg-blue-500" },
  resolved: { labelKey: "resolu", color: "bg-emerald-600" },
};

export function MaintenanceView({
  windows, incidents, banner,
}: {
  windows: MaintenanceRow[];
  incidents: IncidentRow[];
  banner: Record<string, string>;
}) {
  const t = useTranslations("admin.maintenance");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("banner");
  const dateTag = useDateLocale();
  const [pending, startTransition] = useTransition();


  const [bannerEnabled, setBannerEnabled] = useState(banner.banner_enabled === "true");
  const [bannerMessage, setBannerMessage] = useState(banner.banner_message ?? "");
  const [bannerVariant, setBannerVariant] = useState<"info" | "warning" | "success" | "error">((banner.banner_variant as "info" | "warning" | "success" | "error") ?? "info");
  const [bannerDismissible, setBannerDismissible] = useState(banner.banner_dismissible !== "false");
  const [bannerCtaLabel, setBannerCtaLabel] = useState(banner.banner_cta_label ?? "");
  const [bannerCtaUrl, setBannerCtaUrl] = useState(banner.banner_cta_url ?? "");
  const [bannerAudience, setBannerAudience] = useState<"all" | "admin" | "portal" | "public">((banner.banner_audience as "all" | "admin" | "portal" | "public") ?? "all");

  const [maintenanceDialog, setMaintenanceDialog] = useState<{ open: boolean; window: MaintenanceRow | null }>({ open: false, window: null });
  const [incidentDialog, setIncidentDialog] = useState<{ open: boolean; incident: IncidentRow | null }>({ open: false, incident: null });
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "maintenance" | "incident"; id: number; label: string } | null>(null);

  const saveBanner = () => {
    startTransition(async () => {
      const r = await updateAnnouncementBannerAction({
        enabled: bannerEnabled,
        message: bannerMessage,
        variant: bannerVariant,
        dismissible: bannerDismissible,
        ctaLabel: bannerCtaLabel || null,
        ctaUrl: bannerCtaUrl || null,
        audience: bannerAudience,
      });
      if (r.success) { toast.success(t("bandeau_enregistre")); router.refresh(); }
      else toast.error(r.error || t("erreur"));
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const r = confirmDelete.kind === "maintenance"
      ? await deleteMaintenanceAction({ id: confirmDelete.id })
      : await deleteIncidentAction({ id: confirmDelete.id });
    if (r.success) { toast.success(t("supprime")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
    setConfirmDelete(null);
  };


  const BANNER_VARIANTS: Record<string, { bg: string; border: string; text: string }> = {
    info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900" },
    success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" },
    error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-900" },
  };

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: "banner", label: t("bandeau_annonce"), icon: Megaphone, count: bannerEnabled ? 1 : 0 },
    { key: "windows", label: t("fenetres_maintenance"), icon: Calendar, count: windows.length },
    { key: "incidents", label: t("incidents"), icon: AlertTriangle, count: incidents.filter((i) => i.status !== "resolved").length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-slate-600 shrink-0">
          <Wrench className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("maintenance_annonces")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("bandeau_global_fenetres_maintenance_planifiees")}
          </p>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap",
                  active ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />{t.label}
                <Badge variant="secondary" className="text-[10px] ml-1">{t.count}</Badge>
              </button>
            );
          })}
        </div>
      </div>


      {tab === "banner" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                <div>
                  <p className="text-sm font-semibold">{t("bandeau_active")}</p>
                  <p className="text-xs text-muted-foreground">{t("affiche_haut_pages_selon_apos")}</p>
                </div>
                <Switch checked={bannerEnabled} onCheckedChange={setBannerEnabled} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("type")}</Label>
                  <Select value={bannerVariant} onValueChange={(v) => setBannerVariant(v as typeof bannerVariant)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">{t("info_bleu")}</SelectItem>
                      <SelectItem value="warning">{t("avertissement_jaune")}</SelectItem>
                      <SelectItem value="success">{t("succes_vert")}</SelectItem>
                      <SelectItem value="error">{t("erreur_rouge")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("audience")}</Label>
                  <Select value={bannerAudience} onValueChange={(v) => setBannerAudience(v as typeof bannerAudience)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("toutes_pages")}</SelectItem>
                      <SelectItem value="admin">{t("admin_uniquement")}</SelectItem>
                      <SelectItem value="portal">{t("portail_client_uniquement")}</SelectItem>
                      <SelectItem value="public">{t("site_public_uniquement")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("message")}</Label>
                <Textarea value={bannerMessage} onChange={(e) => setBannerMessage(e.target.value)} rows={2} maxLength={500} placeholder={t("ex_maintenance_prevue_dimanche_2h00")} className="mt-1 text-sm" />
                <p className="text-[10px] text-muted-foreground mt-1">{bannerMessage.length}/500</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("texte_bouton_cta")}</Label>
                  <Input value={bannerCtaLabel} onChange={(e) => setBannerCtaLabel(e.target.value)} placeholder={t("savoir_plus")} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("url_bouton")}</Label>
                  <Input value={bannerCtaUrl} onChange={(e) => setBannerCtaUrl(e.target.value)} placeholder="https://..." className="mt-1" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{t("permettre_fermeture")}</p>
                  <p className="text-xs text-muted-foreground">{t("apos_utilisateur_peut_masquer_bandeau")}</p>
                </div>
                <Switch checked={bannerDismissible} onCheckedChange={setBannerDismissible} />
              </div>


              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">{t("apercu")}</Label>
                <div className={cn(
                  "rounded-md border-l-4 px-4 py-3 flex items-center gap-3",
                  BANNER_VARIANTS[bannerVariant].bg,
                  BANNER_VARIANTS[bannerVariant].border,
                  BANNER_VARIANTS[bannerVariant].text
                )}>
                  <Megaphone className="h-4 w-4 shrink-0" />
                  <span className="text-sm flex-1">{bannerMessage || t("votre_message_apparaitra_ici")}</span>
                  {bannerCtaLabel && (
                    <span className="text-xs font-medium underline">{bannerCtaLabel}</span>
                  )}
                  {bannerDismissible && <span className="text-xs">✕</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={saveBanner} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            <Save className="h-4 w-4 mr-1.5" />{pending ? "..." : t("enregistrer_bandeau")}
          </Button>
        </div>
      )}


      {tab === "windows" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{windows.filter((w) => w.isActive).length} actif{windows.filter((w) => w.isActive).length > 1 ? "ves" : "ve"} sur {windows.length}</p>
            <Button onClick={() => setMaintenanceDialog({ open: true, window: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />{t("maintenance_view_planifier_une_maintenance")}</Button>
          </div>
          <Card>
            <div className="divide-y">
              {windows.map((w) => {
                const now = Date.now();
                const start = new Date(w.startsAt).getTime();
                const end = new Date(w.endsAt).getTime();
                const isOngoing = w.isActive && now >= start && now <= end;
                const isPast = end < now;
                return (
                  <div key={w.id} className={cn("flex items-start gap-4 p-4 hover:bg-muted/40", isPast && "opacity-60")}>
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: isOngoing ? "#C01C28" : isPast ? "#6b7280" : "#1A5FB4" }}>
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{w.title}</p>
                        {isOngoing && <Badge className="text-[10px] bg-red-600 hover:bg-red-600 animate-pulse">{t("cours")}</Badge>}
                        {!w.isActive && <Badge variant="secondary" className="text-[10px]">{t("desactivee")}</Badge>}
                        {isPast && <Badge variant="outline" className="text-[10px]">{t("passee")}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(w.startsAt).toLocaleString(dateTag, { dateStyle: "medium", timeStyle: "short" })}
                        {" → "}
                        {new Date(w.endsAt).toLocaleString(dateTag, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {w.affectsPortal && <Badge variant="outline" className="text-[9px]">{t("portail")}</Badge>}
                        {w.affectsAdmin && <Badge variant="outline" className="text-[9px]">{t("admin")}</Badge>}
                        {w.affectsPublic && <Badge variant="outline" className="text-[9px]">{t("site_public")}</Badge>}
                      </div>
                      {w.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{w.description}</p>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setMaintenanceDialog({ open: true, window: w })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "maintenance", id: w.id, label: w.title })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              {windows.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{t("aucune_fenetre_planifiee")}</p>}
            </div>
          </Card>
        </div>
      )}


      {tab === "incidents" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {incidents.filter((i) => i.status !== "resolved").length} actif{incidents.filter((i) => i.status !== "resolved").length > 1 ? "s" : ""}
            </p>
            <Button onClick={() => setIncidentDialog({ open: true, incident: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />{t("maintenance_view_signaler_un_incident")}</Button>
          </div>
          <Card>
            <div className="divide-y">
              {incidents.map((i) => {
                const sev = SEVERITY_BADGE[i.severity];
                const stat = STATUS_BADGE[i.status];
                return (
                  <div key={i.id} className={cn("flex items-start gap-4 p-4 hover:bg-muted/40", i.status === "resolved" && "opacity-60")}>
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white", sev?.color)}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{i.title}</p>
                        <Badge className={cn("text-[10px] text-white", sev?.color)}>{sev ? t(sev.labelKey) : null}</Badge>
                        <Badge className={cn("text-[10px] text-white", stat?.color)}>{stat ? t(stat.labelKey) : null}</Badge>
                        {!i.isPublic && <Badge variant="outline" className="text-[10px]">{t("prive")}</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Début : {new Date(i.startedAt).toLocaleString(dateTag, { dateStyle: "medium", timeStyle: "short" })}
                        {i.resolvedAt && t("maintenance_view_resolu_p0", { p0: new Date(i.resolvedAt).toLocaleString(dateTag, { dateStyle: "medium", timeStyle: "short" }) })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{i.description}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIncidentDialog({ open: true, incident: i })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "incident", id: i.id, label: i.title })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              {incidents.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{t("aucun_incident_enregistre")}</p>}
            </div>
          </Card>
        </div>
      )}

      <MaintenanceDialog
        open={maintenanceDialog.open}
        onOpenChange={(open) => setMaintenanceDialog({ open, window: open ? maintenanceDialog.window : null })}
        window={maintenanceDialog.window}
        onSaved={() => router.refresh()}
      />
      <IncidentDialog
        open={incidentDialog.open}
        onOpenChange={(open) => setIncidentDialog({ open, incident: open ? incidentDialog.incident : null })}
        incident={incidentDialog.incident}
        onSaved={() => router.refresh()}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Supprimer ${confirmDelete?.label} ?`}
        description={t("action_irreversible")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
