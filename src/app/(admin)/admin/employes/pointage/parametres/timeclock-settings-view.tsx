"use client";
// Settings rows (label + hint left, control right), grouped in sections,
// with a save bar that only shows when something changed.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  SlidersHorizontal, Clock, MapPin, Monitor, ChevronLeft, Save,
  Crosshair, ExternalLink, KeyRound, AlertTriangle, Search, Copy, ChevronRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormSection } from "@/components/admin/form-section";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { confirmDialog } from "@/components/admin/prompt-dialog";
import {
  updateTimeclockSettingsAction, resetKioskPinForAction, clearKioskPinForAction,
} from "@/app/actions/hr-timeclock";

type Config = {
  roundingMin: number;
  geolocEnabled: boolean;
  geofenceEnabled: boolean;
  geofenceLat: number | null;
  geofenceLng: number | null;
  geofenceRadiusM: number;
  kioskEnabled: boolean;
};

// Setting row: label + hint on the left, control on the right.
function SettingRow({
  icon: Icon, label, hint, children, danger = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${danger ? "text-amber-600" : "text-[#0F2D52]"}`} />}
          <p className="text-sm font-medium">{label}</p>
        </div>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

type EmployeePin = {
  id: number;
  name: string;
  email: string;
  hasPin: boolean;
  /** false = PIN stored without its encrypted copy: the employee cannot display it. */
  canReveal: boolean;
  setAt: string | null;
  requestedAt: string | null;
};

type PinList = {
  q: string;
  filter: string;
  page: number;
  pageSize: number;
  total: number;
  totalEmployees: number;
  withPin: number;
  requested: number;
};

export function TimeclockSettingsView({
  config, employees, pinList,
}: {
  config: Config;
  employees: EmployeePin[];
  pinList: PinList;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [form, setForm] = useState<Config>(config);
  const [pending, setPending] = useState(false);
  const [pinBusyId, setPinBusyId] = useState<number | null>(null);
  const [issued, setIssued] = useState<{ name: string; pin: string } | null>(null);
  const [pinSearch, setPinSearch] = useState(pinList.q);
  const [navPending, startNav] = useTransition();

  // URL-driven search, filters and paging: the server only loads the visible page.
  const pushPinParams = useCallback((overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, sp]);

  useEffect(() => { setPinSearch(pinList.q); }, [pinList.q]);
  useEffect(() => {
    if (pinSearch === pinList.q) return;
    const t = setTimeout(() => pushPinParams({ pinQ: pinSearch || null, pinPage: null }), 350);
    return () => clearTimeout(t);
  }, [pinSearch, pinList.q, pushPinParams]);

  const pinTotalPages = Math.max(1, Math.ceil(pinList.total / pinList.pageSize));
  const pinStart = pinList.total === 0 ? 0 : (pinList.page - 1) * pinList.pageSize + 1;
  const pinEnd = Math.min(pinList.total, pinList.page * pinList.pageSize);

  const issuePin = async (emp: EmployeePin) => {
    if (emp.hasPin) {
      const ok = await confirmDialog({
        title: `Remplacer le NIP de ${emp.name}`,
        description: "Son NIP actuel cessera immédiatement de fonctionner. Le nouveau s'affiche une seule fois — notez-le pour le lui remettre.",
        confirmLabel: "Remplacer",
      });
      if (!ok) return;
    }
    setPinBusyId(emp.id);
    const r = await resetKioskPinForAction({ adminId: emp.id });
    setPinBusyId(null);
    if (r.success) {
      setIssued({ name: r.data.name, pin: r.data.pin });
      router.refresh();
    } else toast.error(r.error || "Erreur");
  };

  const removePin = async (emp: EmployeePin) => {
    const ok = await confirmDialog({
      title: `Retirer le NIP de ${emp.name}`,
      description: "Cette personne ne pourra plus poinçonner sur la borne partagée.",
      confirmLabel: "Retirer",
      variant: "destructive",
    });
    if (!ok) return;
    setPinBusyId(emp.id);
    const r = await clearKioskPinForAction({ adminId: emp.id });
    setPinBusyId(null);
    if (r.success) { toast.success("NIP retiré"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  const dirty = useMemo(
    () => (Object.keys(form) as Array<keyof Config>).some((k) => form[k] !== config[k]),
    [form, config],
  );

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setForm((s) => ({ ...s, [k]: v }));

  const useMyPosition = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Géolocalisation indisponible sur cet appareil");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((s) => ({
          ...s,
          geofenceLat: Number(pos.coords.latitude.toFixed(6)),
          geofenceLng: Number(pos.coords.longitude.toFixed(6)),
        }));
        toast.success("Position actuelle utilisée comme centre de la zone");
      },
      () => toast.error("Position refusée ou indisponible"),
      { timeout: 8000 },
    );
  };

  const save = async () => {
    setPending(true);
    const r = await updateTimeclockSettingsAction({
      roundingMin: form.roundingMin,
      geolocEnabled: form.geolocEnabled,
      geofenceEnabled: form.geofenceEnabled,
      geofenceLat: form.geofenceLat,
      geofenceLng: form.geofenceLng,
      geofenceRadiusM: form.geofenceRadiusM,
      kioskEnabled: form.kioskEnabled,
    });
    setPending(false);
    if (r.success) {
      toast.success("Paramètres enregistrés");
      router.refresh();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header navy VNK */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <SlidersHorizontal className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">Paramètres du pointage</h1>
              <p className="text-xs text-white/80">
                Arrondi des punchs, localisation et borne partagée.
              </p>
            </div>
          </div>
          {/* Plain <Link> gave no feedback while the target page compiled,
              which read as a dead button. */}
          <Button
            variant="outline" size="sm"
            disabled={navPending}
            onClick={() => startNav(() => router.push("/admin/employes/pointage"))}
            className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur disabled:opacity-70"
          >
            {navPending
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <ChevronLeft className="h-3.5 w-3.5 mr-1.5" />}
            Retour au pointage
          </Button>
        </div>
      </div>

      {/* ── Punchs ────────────────────────────────────────────── */}
      <Card className="p-4">
        <FormSection icon={Clock} title="Punchs">
          <div className="divide-y">
            <SettingRow
              label="Arrondi des punchs"
              hint="Arrondit l'heure d'entrée et de sortie au pas le plus proche. « Aucun » conserve la minute exacte."
            >
              <Select
                value={String(form.roundingMin)}
                onValueChange={(v) => set("roundingMin", Number(v))}
              >
                <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Aucun (minute)</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </div>
        </FormSection>
      </Card>

      {/* ── Localisation ──────────────────────────────────────── */}
      <Card className="p-4">
        <FormSection icon={MapPin} title="Localisation">
          <div className="divide-y">
            <SettingRow
              label="Enregistrer la position au punch"
              hint="La position GPS est demandée au navigateur et jointe au pointage. Un refus ne bloque jamais le punch."
            >
              <Switch
                checked={form.geolocEnabled}
                onCheckedChange={(v) => set("geolocEnabled", v)}
                aria-label="Enregistrer la position au punch"
              />
            </SettingRow>

            <SettingRow
              label="Géorepérage (zone autorisée)"
              hint="Refuse les punchs faits hors du rayon défini. Les punchs sur la borne kiosque ne sont jamais bloqués."
              danger={form.geofenceEnabled}
            >
              <Switch
                checked={form.geofenceEnabled}
                onCheckedChange={(v) => set("geofenceEnabled", v)}
                aria-label="Géorepérage"
              />
            </SettingRow>

            {form.geofenceEnabled && (
              <div className="pt-3 space-y-3">
                <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Les employés hors zone ne pourront plus pointer depuis le web. Vérifiez les coordonnées
                    avant d&apos;enregistrer — une zone mal placée bloque tout le monde.
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Latitude</label>
                    <Input
                      value={form.geofenceLat ?? ""}
                      onChange={(e) => set("geofenceLat", e.target.value === "" ? null : Number(e.target.value))}
                      placeholder="45.501690"
                      inputMode="decimal"
                      className="h-9 text-sm font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Longitude</label>
                    <Input
                      value={form.geofenceLng ?? ""}
                      onChange={(e) => set("geofenceLng", e.target.value === "" ? null : Number(e.target.value))}
                      placeholder="-73.567253"
                      inputMode="decimal"
                      className="h-9 text-sm font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Rayon (m)</label>
                    <Input
                      value={form.geofenceRadiusM}
                      onChange={(e) => set("geofenceRadiusM", Number(e.target.value.replace(/\D/g, "")) || 0)}
                      inputMode="numeric"
                      className="h-9 text-sm font-mono mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={useMyPosition}>
                    <Crosshair className="h-3.5 w-3.5 mr-1.5" />Utiliser ma position actuelle
                  </Button>
                  {form.geofenceLat !== null && form.geofenceLng !== null && (
                    <ActionTooltip label="Vérifier le centre de la zone sur Google Maps">
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" asChild>
                        <a
                          href={`https://www.google.com/maps?q=${form.geofenceLat},${form.geofenceLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Voir sur la carte
                        </a>
                      </Button>
                    </ActionTooltip>
                  )}
                </div>
              </div>
            )}
          </div>
        </FormSection>
      </Card>

      {/* ── Borne kiosque ─────────────────────────────────────── */}
      <Card className="p-4">
        <FormSection icon={Monitor} title="Borne kiosque">
          <div className="divide-y">
            <SettingRow
              label="Activer la borne partagée"
              hint="Une tablette laissée sur place ouvre /kiosque : l'employé tape son NIP et poinçonne, sans session personnelle."
            >
              <Switch
                checked={form.kioskEnabled}
                onCheckedChange={(v) => set("kioskEnabled", v)}
                aria-label="Activer la borne kiosque"
              />
            </SettingRow>

          </div>

          {/* Per-employee PIN */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2.5 bg-muted/30 border-b space-y-2.5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F2D52] inline-flex items-center gap-1.5 shrink-0">
                  <KeyRound className="h-3.5 w-3.5" />
                  NIP des employés
                  <Badge variant="outline" className="text-[10px] tabular-nums">
                    {pinList.withPin} / {pinList.totalEmployees}
                  </Badge>
                </span>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={pinSearch}
                    onChange={(e) => setPinSearch(e.target.value)}
                    placeholder="Rechercher un employé…"
                    className="h-8 text-xs pl-7"
                  />
                </div>
              </div>
              {/* Filters, pending requests first */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { key: "all", label: "Tous", count: pinList.totalEmployees },
                  { key: "requested", label: "Demandes", count: pinList.requested },
                  { key: "none", label: "Sans NIP", count: pinList.totalEmployees - pinList.withPin },
                ] as const).map((f) => {
                  const active = pinList.filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => pushPinParams({ pinFilter: f.key === "all" ? null : f.key, pinPage: null })}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                        active
                          ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                          : f.key === "requested" && f.count > 0
                            ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "border-input bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {f.label}
                      <span className="ml-1 tabular-nums opacity-70">{f.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="px-3 py-2 text-[11px] text-muted-foreground border-b bg-muted/10">
              « Générer et envoyer » attribue un NIP et prévient l&apos;employé dans son espace —
              aucun message à écrire. Lui seul peut ensuite l&apos;afficher, avec son mot de passe.
            </p>
            <div className="divide-y">
              {employees.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Aucun employé correspondant.</p>
              ) : employees.map((emp) => (
                <div
                  key={emp.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${emp.requestedAt ? "bg-amber-50/50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{emp.name}</p>
                      {emp.requestedAt && (
                        <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300 bg-amber-50">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          Demande le {new Date(emp.requestedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {emp.hasPin && !emp.canReveal
                        ? "L'employé ne peut pas l'afficher — remplacez-le"
                        : emp.hasPin
                          ? emp.setAt
                            ? `NIP remis le ${new Date(emp.setAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}`
                            : "NIP actif"
                          : emp.email}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      emp.hasPin && !emp.canReveal
                        ? "text-red-700 border-red-300 bg-red-50"
                        : emp.hasPin
                          ? "text-emerald-700 border-emerald-300 bg-emerald-50"
                          : "text-slate-500 border-slate-200 bg-slate-50"
                    }`}
                  >
                    {emp.hasPin ? (emp.canReveal ? "Configuré" : "À remplacer") : "Aucun"}
                  </Badge>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {emp.hasPin && (
                      <Button
                        variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                        onClick={() => removePin(emp)}
                        disabled={pinBusyId === emp.id}
                      >
                        Retirer
                      </Button>
                    )}
                    <Button
                      variant={emp.requestedAt ? "default" : "outline"}
                      size="sm"
                      className={`h-8 text-xs ${emp.requestedAt ? "bg-[#0F2D52] hover:bg-[#1a3a66] text-white" : ""}`}
                      onClick={() => issuePin(emp)}
                      disabled={pinBusyId === emp.id}
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                      {emp.hasPin ? "Remplacer" : "Générer et envoyer"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Server-side paging: never more than 10 rows loaded */}
            {pinList.total > pinList.pageSize && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-muted/20 flex-wrap">
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {pinStart}–{pinEnd} sur {pinList.total}
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    disabled={pinList.page <= 1}
                    onClick={() => pushPinParams({ pinPage: String(pinList.page - 1) })}
                  >
                    <ChevronLeft className="h-3 w-3 mr-1" />Précédent
                  </Button>
                  <span className="text-[11px] text-muted-foreground tabular-nums px-1">
                    {pinList.page} / {pinTotalPages}
                  </span>
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    disabled={pinList.page >= pinTotalPages}
                    onClick={() => pushPinParams({ pinPage: String(pinList.page + 1) })}
                  >
                    Suivant<ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {form.kioskEnabled && (
            <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-[#0F2D52] uppercase tracking-wider text-[10px]">Mise en place</p>
              <p>1. Générez un NIP ci-dessus pour chaque employé et remettez-le-lui.</p>
              <p>2. Ouvrez <span className="font-mono">/kiosque</span> en plein écran sur la tablette laissée sur place.</p>
              <p>3. L&apos;employé tape son NIP, voit son nom, poinçonne — l&apos;écran se réinitialise pour le suivant.</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-0 text-[#0F2D52]" asChild>
                <a href="/kiosque" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1.5" />Ouvrir la borne
                </a>
              </Button>
            </div>
          )}
        </FormSection>
      </Card>

      {/* Issued PIN, shown once */}
      <Dialog open={issued != null} onOpenChange={(o) => { if (!o) setIssued(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <KeyRound className="h-4 w-4" />NIP de {issued?.name}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Déjà envoyé dans son espace. Notez-le seulement si vous devez le lui remettre en main propre.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-5 py-6 space-y-3 text-center">
            <p className="font-mono text-4xl font-bold tracking-[0.35em] text-[#0F2D52] tabular-nums">
              {issued?.pin}
            </p>
            <Button
              variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => {
                if (issued) {
                  navigator.clipboard?.writeText(issued.pin)
                    .then(() => toast.success("NIP copié"))
                    .catch(() => toast.error("Copie impossible"));
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />Copier
            </Button>
            <p className="text-[11px] text-muted-foreground">
              L&apos;employé pourra le réafficher lui-même depuis Mon espace, avec son mot de passe.
            </p>
          </div>
          <DialogFooter className="px-5 py-3 border-t bg-muted/30">
            <Button onClick={() => setIssued(null)} className="bg-[#0F2D52] hover:bg-[#15406d]">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barre d'enregistrement : n'apparait qu'en cas de changement */}
      {dirty && (
        <div className="sticky bottom-4 z-20 flex items-center gap-3 rounded-lg bg-[#0F2D52] text-white px-4 py-3 shadow-lg flex-wrap">
          <span className="text-xs flex-1">Modifications non enregistrées</span>
          <Button
            variant="ghost" size="sm"
            className="text-white hover:bg-white/20 h-8 text-xs"
            onClick={() => setForm(config)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
            onClick={save}
            disabled={pending}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      )}
    </div>
  );
}
