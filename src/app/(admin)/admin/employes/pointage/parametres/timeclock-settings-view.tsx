"use client";
// Settings rows (label + hint left, control right), grouped in sections,
// with a save bar that only shows when something changed.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
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
  overtimeWeeklyMin: number;
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
  const t = useTranslations("admin.timeclock_settings");
  const locale = useLocale();
  const dateTag = useDateLocale();
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [form, setForm] = useState<Config>(config);
  const [pending, setPending] = useState(false);
  const [pinBusyId, setPinBusyId] = useState<number | null>(null);
  const [issued, setIssued] = useState<{ name: string; pin: string } | null>(null);
  const [pinSearch, setPinSearch] = useState(pinList.q);


  const [latText, setLatText] = useState(config.geofenceLat?.toString() ?? "");
  const [lngText, setLngText] = useState(config.geofenceLng?.toString() ?? "");
  const [navPending, startNav] = useTransition();


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
        title: t("timeclock_settings_view_remplacer_le_nip_de_p0", { p0: emp.name }),
        description: t("nip_actuel_cessera_fonctionner"),
        confirmLabel: t("remplacer"),
      });
      if (!ok) return;
    }
    setPinBusyId(emp.id);
    const r = await resetKioskPinForAction({ adminId: emp.id });
    setPinBusyId(null);
    if (r.success) {
      setIssued({ name: r.data.name, pin: r.data.pin });
      router.refresh();
    } else toast.error(r.error || t("erreur"));
  };

  const removePin = async (emp: EmployeePin) => {
    const ok = await confirmDialog({
      title: t("timeclock_settings_view_retirer_le_nip_de_p0", { p0: emp.name }),
      description: t("personne_ne_pourra_plus_poinconner"),
      confirmLabel: t("retirer"),
      variant: "destructive",
    });
    if (!ok) return;
    setPinBusyId(emp.id);
    const r = await clearKioskPinForAction({ adminId: emp.id });
    setPinBusyId(null);
    if (r.success) { toast.success(t("nip_retire")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const parseCoord = (t: string): number | null | undefined => {
    const v = t.trim();
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined; // undefined = still being typed
  };
  const lat = parseCoord(latText);
  const lng = parseCoord(lngText);

  const coordsValid =
    !form.geofenceEnabled
    || (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);

  const dirty = useMemo(
    () =>
      (Object.keys(form) as Array<keyof Config>)
        .filter((k) => k !== "geofenceLat" && k !== "geofenceLng")
        .some((k) => form[k] !== config[k])
      || latText !== (config.geofenceLat?.toString() ?? "")
      || lngText !== (config.geofenceLng?.toString() ?? ""),
    [form, config, latText, lngText],
  );

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setForm((s) => ({ ...s, [k]: v }));

  const useMyPosition = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("geolocalisation_indisponible_cet_appareil"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatText(pos.coords.latitude.toFixed(6));
        setLngText(pos.coords.longitude.toFixed(6));
        toast.success(t("position_actuelle_utilisee_comme_centre"));
      },
      () => toast.error(t("position_refusee_indisponible")),
      { timeout: 8000 },
    );
  };

  const save = async () => {
    if (!coordsValid) { toast.error(t("latitude_longitude_invalide")); return; }
    setPending(true);
    const r = await updateTimeclockSettingsAction({
      roundingMin: form.roundingMin,
      geolocEnabled: form.geolocEnabled,
      geofenceEnabled: form.geofenceEnabled,
      geofenceLat: lat ?? null,
      geofenceLng: lng ?? null,
      geofenceRadiusM: form.geofenceRadiusM,
      kioskEnabled: form.kioskEnabled,
      overtimeWeeklyMin: form.overtimeWeeklyMin,
    });
    setPending(false);
    if (r.success) {
      toast.success(t("parametres_enregistres"));
      router.refresh();
    } else {
      toast.error(r.error || t("erreur"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <SlidersHorizontal className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t("parametres_pointage")}</h1>
              <p className="text-xs text-white/80">
                {t("arrondi_punchs_localisation_borne_partagee")}
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
            {t("retour_pointage")}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <FormSection icon={Clock} title={t("punchs")}>
          <div className="divide-y">
            <SettingRow
              label={t("seuil_heures_supplementaires")}
              hint={t("dela_total_hebdomadaire_heures_comptees")}
            >
              <Select
                value={String(form.overtimeWeeklyMin)}
                onValueChange={(v) => set("overtimeWeeklyMin", Number(v))}
              >
                <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[35, 37.5, 38, 40, 44, 48].map((h) => (
                    <SelectItem key={h} value={String(Math.round(h * 60))}>
                      {t("n_h_par_semaine", { hours: new Intl.NumberFormat(locale).format(h) })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              label={t("arrondi_punchs")}
              hint={t("arrondit_heure_entree_sortie_pas")}
            >
              <Select
                value={String(form.roundingMin)}
                onValueChange={(v) => set("roundingMin", Number(v))}
              >
                <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("aucun_minute")}</SelectItem>
                  <SelectItem value="5">{t("5_minutes")}</SelectItem>
                  <SelectItem value="10">{t("10_minutes")}</SelectItem>
                  <SelectItem value="15">{t("15_minutes")}</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </div>
        </FormSection>
      </Card>

      <Card className="p-4">
        <FormSection icon={MapPin} title={t("localisation")}>
          <div className="divide-y">
            <SettingRow
              label={t("enregistrer_position_punch")}
              hint={t("position_gps_demandee_navigateur_jointe")}
            >
              <Switch
                checked={form.geolocEnabled}
                onCheckedChange={(v) => set("geolocEnabled", v)}
                aria-label={t("enregistrer_position_punch")}
              />
            </SettingRow>

            <SettingRow
              label={t("georeperage_zone_autorisee")}
              hint={t("refuse_punchs_faits_hors_rayon")}
              danger={form.geofenceEnabled}
            >
              <Switch
                checked={form.geofenceEnabled}
                onCheckedChange={(v) => set("geofenceEnabled", v)}
                aria-label={t("georeperage")}
              />
            </SettingRow>

            {form.geofenceEnabled && (
              <div className="pt-3 space-y-3">
                <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>{t("timeclock_settings_view_les_employes_hors_zone_ne_pourront_plus")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("latitude")}</label>
                    <Input
                      value={latText}
                      onChange={(e) => setLatText(e.target.value)}
                      placeholder="45.501690"
                      inputMode="decimal"
                      className={`h-9 text-sm font-mono mt-1 ${lat === undefined ? "border-red-400" : ""}`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("longitude")}</label>
                    <Input
                      value={lngText}
                      onChange={(e) => setLngText(e.target.value)}
                      placeholder="-73.567253"
                      inputMode="decimal"
                      className={`h-9 text-sm font-mono mt-1 ${lng === undefined ? "border-red-400" : ""}`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("rayon_m")}</label>
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
                  {lat != null && lng != null && (
                    <ActionTooltip label={t("verifier_centre_zone_google_maps")}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" asChild>
                        <a
                          href={`https://www.google.com/maps?q=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />{t("timeclock_settings_view_voir_sur_la_carte")}</a>
                      </Button>
                    </ActionTooltip>
                  )}
                </div>
              </div>
            )}
          </div>
        </FormSection>
      </Card>

      <Card className="p-4">
        <FormSection icon={Monitor} title={t("borne_kiosque")}>
          <div className="divide-y">
            <SettingRow
              label={t("activer_borne_partagee")}
              hint={t("tablette_laissee_place_ouvre_kiosque")}
            >
              <Switch
                checked={form.kioskEnabled}
                onCheckedChange={(v) => set("kioskEnabled", v)}
                aria-label={t("activer_borne_kiosque")}
              />
            </SettingRow>

          </div>


          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2.5 bg-muted/30 border-b space-y-2.5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F2D52] inline-flex items-center gap-1.5 shrink-0">
                  <KeyRound className="h-3.5 w-3.5" />
                  {t("nip_employes")}
                  <Badge variant="outline" className="text-[10px] tabular-nums">
                    {pinList.withPin} / {pinList.totalEmployees}
                  </Badge>
                </span>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={pinSearch}
                    onChange={(e) => setPinSearch(e.target.value)}
                    placeholder={t("rechercher_employe")}
                    className="h-8 text-xs pl-7"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { key: "all", label: t("tous"), count: pinList.totalEmployees },
                  { key: "requested", label: t("demandes"), count: pinList.requested },
                  { key: "none", label: t("sans_nip"), count: pinList.totalEmployees - pinList.withPin },
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
            <p className="px-3 py-2 text-[11px] text-muted-foreground border-b bg-muted/10">{t("timeclock_settings_view_generer_et_envoyer_attribue_un_nip_et")}</p>
            <div className="divide-y">
              {employees.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{t("aucun_employe_correspondant")}</p>
              ) : employees.map((emp) => (
                <div
                  key={emp.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${emp.requestedAt ? "bg-amber-50/50" : ""}`}
                >
                  <div className="flex-1 min-w-[11rem]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{emp.name}</p>
                      {emp.requestedAt && (
                        <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300 bg-amber-50">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          Demande le {new Date(emp.requestedAt).toLocaleDateString(dateTag, { day: "numeric", month: "long" })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {emp.hasPin && !emp.canReveal
                        ? t("employe_ne_peut_pas_afficher")
                        : emp.hasPin
                          ? emp.setAt
                            ? t("nip_remis_le", {
                                date: new Date(emp.setAt).toLocaleDateString(dateTag, {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }),
                              })
                            : t("nip_actif")
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
                    {emp.hasPin ? (emp.canReveal ? t("configure") : t("remplacer_2")) : t("aucun")}
                  </Badge>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {emp.hasPin && (
                      <Button
                        variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                        onClick={() => removePin(emp)}
                        disabled={pinBusyId === emp.id}
                      >
                        {t("retirer")}
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
                      {emp.hasPin ? t("remplacer") : t("generer_envoyer")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>


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
                    <ChevronLeft className="h-3 w-3 mr-1" />{tc("previous")}
                  </Button>
                  <span className="text-[11px] text-muted-foreground tabular-nums px-1">
                    {pinList.page} / {pinTotalPages}
                  </span>
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    disabled={pinList.page >= pinTotalPages}
                    onClick={() => pushPinParams({ pinPage: String(pinList.page + 1) })}
                  >
                    {tc("next")}<ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {form.kioskEnabled && (
            <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-[#0F2D52] uppercase tracking-wider text-[10px]">{t("mise_place")}</p>
              <p>{t("1_generez_nip_ci_dessus")}</p>
              <p>{t("2_ouvrez")} <span className="font-mono">/kiosque</span> {t("plein_ecran_tablette_laissee_place")}</p>
              <p>{t("3_apos_employe_tape_nip")}</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-0 text-[#0F2D52]" asChild>
                <a href="/kiosque" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1.5" />{t("timeclock_settings_view_ouvrir_la_borne")}</a>
              </Button>
            </div>
          )}
        </FormSection>
      </Card>


      <Dialog open={issued != null} onOpenChange={(o) => { if (!o) setIssued(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <KeyRound className="h-4 w-4" />NIP de {issued?.name}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                {t("deja_envoye_espace_notez_seulement")}
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
                    .then(() => toast.success(t("nip_copie")))
                    .catch(() => toast.error(t("copie_impossible")));
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />{tc("copy")}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {t("apos_employe_pourra_reafficher_lui")}
            </p>
          </div>
          <DialogFooter className="px-5 py-3 border-t bg-muted/30">
            <Button onClick={() => setIssued(null)} className="bg-[#0F2D52] hover:bg-[#15406d]">
              {tc("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dirty && (
        <div className="sticky bottom-4 z-20 flex items-center gap-3 rounded-lg bg-[#0F2D52] text-white px-4 py-3 shadow-lg flex-wrap">
          <span className="text-xs flex-1">{t("modifications_non_enregistrees")}</span>
          <Button
            variant="ghost" size="sm"
            className="text-white hover:bg-white/20 h-8 text-xs"
            onClick={() => {
              setForm(config);
              setLatText(config.geofenceLat?.toString() ?? "");
              setLngText(config.geofenceLng?.toString() ?? "");
            }}
            disabled={pending}
          >
            {tc("cancel")}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
            onClick={save}
            disabled={pending || !coordsValid}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {pending ? t("enregistrement") : t("enregistrer")}
          </Button>
        </div>
      )}
    </div>
  );
}
