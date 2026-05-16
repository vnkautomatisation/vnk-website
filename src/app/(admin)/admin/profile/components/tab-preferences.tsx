"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Sun, Moon, Monitor as MonitorIcon, Home, Palette, Keyboard, Clock } from "lucide-react";
import { updatePreferencesAction } from "@/app/actions/profile";
import { EditableSection, ReadField } from "./editable-section";
import { applyAdminTheme } from "@/components/admin/theme-provider";
import type { AdminProfile } from "../profile-view";

const TIMEZONES = [
  "America/Toronto", "America/Montreal", "America/Vancouver", "America/Halifax",
  "America/Edmonton", "America/Winnipeg", "America/St_Johns",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/Paris", "Europe/London", "UTC",
];

const ACCENT_COLORS = [
  { color: "#0F2D52", key: "navy" },
  { color: "#1A5FB4", key: "blue" },
  { color: "#26A269", key: "green" },
  { color: "#E5A50A", key: "orange" },
  { color: "#C01C28", key: "red" },
  { color: "#613583", key: "purple" },
  { color: "#3D3846", key: "graphite" },
] as const;

// ─────────────────────────────────────────────────────────
// Hook d'auto-save avec debounce
// ─────────────────────────────────────────────────────────
function useAutoSave(callback: () => Promise<void>, deps: unknown[], delay = 800) {
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { callback(); }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function TabPreferences({ admin }: { admin: AdminProfile }) {
  const t = useTranslations("admin.profile.preferences");
  const router = useRouter();

  const [timezone, setTimezone] = useState(admin.timezone ?? "America/Toronto");
  const [locale, setLocale] = useState<"fr-CA" | "en-CA">(admin.locale === "en-CA" ? "en-CA" : "fr-CA");
  const initialLocale = useRef(admin.locale === "en-CA" ? "en-CA" : "fr-CA");
  const [theme, setTheme] = useState<"light" | "dark" | "auto">((admin.theme as "light" | "dark" | "auto") ?? "light");
  const [accentColor, setAccentColor] = useState(admin.accentColor ?? "");
  const [defaultLanding, setDefaultLanding] = useState(admin.defaultLanding ?? "dashboard");
  const shortcutsObj = (admin.shortcuts as Record<string, string> | null) ?? {};
  const [shortcutSearch, setShortcutSearch] = useState(shortcutsObj.search ?? "k");
  const [shortcutSave, setShortcutSave] = useState(shortcutsObj.save ?? "s");

  const [savingLoc, startLoc] = useTransition();
  const [savingBeh, startBeh] = useTransition();
  const [, startApp] = useTransition();
  const [, startShort] = useTransition();

  const save = (partial: Parameters<typeof updatePreferencesAction>[0], silent = false) => {
    return new Promise<void>((resolve) => {
      const start = partial.timezone !== undefined || partial.locale !== undefined ? startLoc :
                    partial.theme !== undefined || partial.accentColor !== undefined ? startApp :
                    partial.defaultLanding !== undefined ? startBeh : startShort;
      start(async () => {
        const r = await updatePreferencesAction(partial);
        if (r.success && !silent) toast.success("Préférences enregistrées");
        else if (!r.success) toast.error(r.error);
        resolve();
      });
    });
  };

  // ── Auto-save Apparence (theme + accent) + application immédiate ─────────────
  useAutoSave(() => {
    // Appliquer immédiatement côté client pour effet instantané
    applyAdminTheme(theme, accentColor || null);
    return save({ theme, accentColor: accentColor || "" }, true);
  }, [theme, accentColor]);

  // ── Auto-save Raccourcis + application immédiate (localStorage) ─
  useAutoSave(() => {
    try {
      if (shortcutSearch) localStorage.setItem("vnk-admin-shortcut-search", shortcutSearch);
      if (shortcutSave) localStorage.setItem("vnk-admin-shortcut-save", shortcutSave);
    } catch {}
    return save({ shortcuts: { search: shortcutSearch, save: shortcutSave } }, true);
  }, [shortcutSearch, shortcutSave]);

  // ── Horloge temps réel (rafraîchit chaque minute) ─────
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);
  void tick;
  const now = new Date().toLocaleString(locale === "en-CA" ? "en-CA" : "fr-CA", { timeZone: timezone, dateStyle: "full", timeStyle: "short" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Langue + Fuseau (édition contrôlée) ───────── */}
      <EditableSection
        title={t("language_and_tz.title")}
        icon={Globe}
        saving={savingLoc}
        onSave={async () => {
          await save({ timezone, locale });
          // Si la langue a changé : on supprime le cookie NEXT_LOCALE (utilisé par
          // le site public) pour qu'il ne pollue pas /portail ou /. Le portail admin
          // utilise UNIQUEMENT admin.locale lu depuis la base par request.ts.
          if (locale !== initialLocale.current) {
            try {
              // Supprime le cookie NEXT_LOCALE peu importe le path précédent
              document.cookie = "NEXT_LOCALE=; path=/; max-age=0; SameSite=Lax";
              document.cookie = "NEXT_LOCALE=; path=/admin; max-age=0; SameSite=Lax";
            } catch {}
            router.refresh();
            // Reload sur la même URL admin (pas de redirection ailleurs)
            setTimeout(() => {
              const currentPath = window.location.pathname;
              if (currentPath.startsWith("/admin")) {
                window.location.replace(currentPath + window.location.search);
              }
            }, 300);
          }
        }}
        readView={
          <div>
            <ReadField label={t("language_and_tz.language_label")} value={locale === "en-CA" ? t("language_and_tz.language_en") : t("language_and_tz.language_fr")} />
            <ReadField label={t("language_and_tz.timezone_label")} value={timezone.replace("_", " ")} />
            <ReadField label={t("language_and_tz.current_time")} value={<span className="text-[12px]">{now}</span>} />
          </div>
        }
        editView={
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("language_and_tz.language_label")}</Label>
              <Select value={locale} onValueChange={(v) => setLocale(v as "fr-CA" | "en-CA")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr-CA">{t("language_and_tz.language_fr")}</SelectItem>
                  <SelectItem value="en-CA">{t("language_and_tz.language_en")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {t("language_and_tz.timezone_label")}</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">{t("language_and_tz.current_time_inline", { time: now })}</p>
            </div>
          </div>
        }
      />

      {/* ── Comportement (édition contrôlée) ──────────── */}
      <EditableSection
        title={t("behavior.title")}
        icon={Home}
        saving={savingBeh}
        onSave={() => save({ defaultLanding: defaultLanding as "dashboard" | "requests" | "calendar" | "messages" | "invoices" })}
        readView={
          <div>
            <ReadField label={t("behavior.default_landing_label")} value={t(`behavior.landing_${defaultLanding}` as "behavior.landing_dashboard")} />
          </div>
        }
        editView={
          <div className="space-y-1.5">
            <Label className="text-xs">{t("behavior.default_landing_label")}</Label>
            <Select value={defaultLanding} onValueChange={setDefaultLanding}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">{t("behavior.landing_dashboard")}</SelectItem>
                <SelectItem value="requests">{t("behavior.landing_requests")}</SelectItem>
                <SelectItem value="calendar">{t("behavior.landing_calendar")}</SelectItem>
                <SelectItem value="messages">{t("behavior.landing_messages")}</SelectItem>
                <SelectItem value="invoices">{t("behavior.landing_invoices")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* ── Apparence (toujours éditable + auto-save) ─── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t("appearance.title")}
            <span className="text-[10px] text-muted-foreground font-normal ml-auto">{t("auto_save")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">{t("appearance.theme_label")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "light", icon: Sun, label: t("appearance.theme_light") },
                { v: "dark", icon: Moon, label: t("appearance.theme_dark") },
                { v: "auto", icon: MonitorIcon, label: t("appearance.theme_auto") },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTheme(v)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${theme === v ? "border-[#0F2D52] bg-[#0F2D52]/5" : "border-input hover:border-muted-foreground/50"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
            {theme === "auto" && (
              <p className="text-[10px] text-muted-foreground">{t("appearance.theme_auto_hint")}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{t("appearance.accent_label")}</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  title={t(`appearance.accent_${c.key}` as "appearance.accent_navy")}
                  onClick={() => setAccentColor(c.color)}
                  className={`h-8 w-8 rounded-full ring-2 transition ${accentColor === c.color ? "ring-[#0F2D52] ring-offset-2" : "ring-transparent"}`}
                  style={{ backgroundColor: c.color }}
                />
              ))}
              <button
                type="button"
                onClick={() => setAccentColor("")}
                className={`h-8 px-3 rounded-full text-xs border ${!accentColor ? "border-[#0F2D52] bg-[#0F2D52]/5" : "border-input"}`}
              >
                {t("appearance.accent_none")}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Raccourcis (toujours éditable + auto-save) ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            {t("shortcuts.title")}
            <span className="text-[10px] text-muted-foreground font-normal ml-auto">{t("auto_save")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <Label className="text-sm">{t("shortcuts.search_label")}</Label>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{t("shortcuts.modifier")}</kbd>
              <Input
                value={shortcutSearch}
                onChange={(e) => setShortcutSearch(e.target.value.slice(0, 1).toLowerCase())}
                maxLength={1}
                className="h-8 w-12 font-mono text-center uppercase"
              />
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm">{t("shortcuts.save_label")}</Label>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{t("shortcuts.modifier")}</kbd>
              <Input
                value={shortcutSave}
                onChange={(e) => setShortcutSave(e.target.value.slice(0, 1).toLowerCase())}
                maxLength={1}
                className="h-8 w-12 font-mono text-center uppercase"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">{t("shortcuts.hint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
