"use client";
// Section Paramètres — 15 onglets en cartes style VNK
// Chaque catégorie s'affiche comme une carte cliquable qui ouvre l'édition
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Setting } from "@prisma/client";
import { toast } from "sonner";
import {
  Building2,
  Briefcase,
  LayoutGrid,
  Receipt,
  FileSignature,
  Mail,
  Plug,
  Server,
  Users,
  Palette,
  Search,
  Bell,
  Scale,
  Newspaper,
  BarChart3,
  ChevronRight,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { updateSettingsAction, testConnectionAction } from "@/app/actions/settings";

// ═══════════════════════════════════════════════════════════
// CATÉGORIES — définies ici pour l'icône et l'ordre d'affichage
// ═══════════════════════════════════════════════════════════

type CategoryMeta = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // tailwind bg-*
};

const CATEGORIES: CategoryMeta[] = [
  { key: "general", icon: LayoutGrid, accent: "bg-blue-500" },
  { key: "company", icon: Building2, accent: "bg-indigo-500" },
  { key: "portal", icon: Briefcase, accent: "bg-purple-500" },
  { key: "billing", icon: Receipt, accent: "bg-emerald-500" },
  { key: "signature", icon: FileSignature, accent: "bg-violet-500" },
  { key: "emails", icon: Mail, accent: "bg-sky-500" },
  { key: "integrations", icon: Plug, accent: "bg-orange-500" },
  { key: "system", icon: Server, accent: "bg-slate-500" },
  { key: "users", icon: Users, accent: "bg-rose-500" },
  { key: "appearance", icon: Palette, accent: "bg-pink-500" },
  { key: "seo", icon: Search, accent: "bg-amber-500" },
  { key: "notifications", icon: Bell, accent: "bg-yellow-500" },
  { key: "legal", icon: Scale, accent: "bg-red-500" },
  { key: "blog", icon: Newspaper, accent: "bg-teal-500" },
  { key: "analytics", icon: BarChart3, accent: "bg-cyan-500" },
];

// ═══════════════════════════════════════════════════════════

export function SettingsView({
  settingsByCategory,
}: {
  settingsByCategory: Record<string, Setting[]>;
}) {
  const t = useTranslations("settings");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (activeCategory) {
    const meta = CATEGORIES.find((c) => c.key === activeCategory)!;
    const settings = settingsByCategory[activeCategory] ?? [];
    return (
      <CategoryEditor
        meta={meta}
        settings={settings}
        onBack={() => setActiveCategory(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t("page_title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("page_subtitle")}</p>
      </div>

      {/* ── Grille de 15 cartes catégories ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = settingsByCategory[cat.key]?.length ?? 0;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                "group text-left",
                "rounded-xl border bg-card p-5",
                "vnk-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
              aria-label={t(`categories.${cat.key}`)}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "h-11 w-11 rounded-lg flex items-center justify-center text-white",
                    cat.accent
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <h3 className="mt-4 font-semibold text-base leading-tight">
                {t(`categories.${cat.key}`)}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {t(`categories.${cat.key}_desc`)}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">
                  {count} {count > 1 ? "paramètres" : "paramètre"}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Info footer ─────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Modifier un paramètre sans toucher au code
            </p>
            <p>
              Cette section vous permet de configurer tout le site sans éditer
              les fichiers. Les modifications sont appliquées en temps réel. Les
              changements sont tracés dans le journal d&apos;audit.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EDITOR — vue d'édition d'une catégorie
// ═══════════════════════════════════════════════════════════

function CategoryEditor({
  meta,
  settings,
  onBack,
}: {
  meta: CategoryMeta;
  settings: Setting[];
  onBack: () => void;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const Icon = meta.icon;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of settings) init[s.key] = s.value ?? "";
    return init;
  });
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      const updates = Object.entries(values).map(([key, value]) => ({ key, value }));
      const result = await updateSettingsAction({
        category: meta.key,
        updates,
      });
      if (result.success) {
        toast.success(t("saved_success"));
        setDirty(false);
      } else {
        toast.error(result.error || t("saved_error"));
      }
    });
  };

  const handleDiscard = () => {
    const init: Record<string, string> = {};
    for (const s of settings) init[s.key] = s.value ?? "";
    setValues(init);
    setDirty(false);
  };

  const handleTestConnection = async (provider: string) => {
    const result = await testConnectionAction(provider);
    if (result.success) toast.success(t("connection_ok"));
    else toast.error(result.error || t("connection_error"));
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-1 text-muted-foreground hover:text-foreground"
            aria-label={tCommon("back")}
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div
            className={cn(
              "h-12 w-12 rounded-lg flex items-center justify-center text-white shrink-0",
              meta.accent
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t(`categories.${meta.key}`)}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t(`categories.${meta.key}_desc`)}
            </p>
          </div>
        </div>

        {/* Actions header */}
        {dirty && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={pending}>
              {t("discard")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending}>
              {pending ? (
                <>
                  <Save className="h-4 w-4 animate-pulse" />
                  {tCommon("saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t("save_all")}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── Unsaved banner ──────────────────────────────── */}
      {dirty && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-900 dark:text-amber-200">
            {t("unsaved_changes")}
          </span>
        </div>
      )}

      {/* ── Settings grid ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t(`categories.${meta.key}`)}</CardTitle>
          <CardDescription>
            {settings.length} {settings.length > 1 ? "paramètres disponibles" : "paramètre disponible"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5 divide-y divide-border">
            {settings.map((s, i) => (
              <div key={s.id} className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", i > 0 && "pt-5")}>
                <div className="lg:col-span-1 space-y-1">
                  <Label htmlFor={`setting-${s.id}`} className="flex items-center gap-2">
                    {s.label}
                    {s.isSecret && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        SECRET
                      </Badge>
                    )}
                  </Label>
                  {s.description && (
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <SettingField
                    setting={s}
                    value={values[s.key] ?? ""}
                    visible={visibleSecrets[s.key] ?? false}
                    onToggleVisible={() =>
                      setVisibleSecrets((p) => ({ ...p, [s.key]: !p[s.key] }))
                    }
                    onChange={(v) => handleChange(s.key, v)}
                    onCopy={async () => {
                      await navigator.clipboard.writeText(values[s.key] ?? "");
                      toast.success(tCommon("copied"));
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Integration test buttons ────────────────────── */}
      {meta.key === "integrations" && (
        <Card>
          <CardHeader>
            <CardTitle>Tester les connexions</CardTitle>
            <CardDescription>
              Vérifiez que vos clés API fonctionnent avant d&apos;enregistrer
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleTestConnection("stripe")}>
              <Check className="h-4 w-4" />
              Stripe
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleTestConnection("smtp")}>
              <Check className="h-4 w-4" />
              SMTP
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Danger zone ─────────────────────────────────── */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Zone sensible</CardTitle>
          <CardDescription>
            Ces actions sont irréversibles. Utilisez-les avec précaution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
            <RotateCcw className="h-4 w-4" />
            {t("reset_category")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FIELD RENDERER — choisit le bon input selon le type
// ═══════════════════════════════════════════════════════════

function SettingField({
  setting,
  value,
  visible,
  onChange,
  onToggleVisible,
  onCopy,
}: {
  setting: Setting;
  value: string;
  visible: boolean;
  onChange: (v: string) => void;
  onToggleVisible: () => void;
  onCopy: () => void;
}) {
  // Boolean → Switch
  if (setting.type === "boolean") {
    return (
      <div className="flex items-center h-11">
        <Switch
          id={`setting-${setting.id}`}
          checked={value === "true"}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          aria-label={setting.label}
        />
      </div>
    );
  }

  // Number → Input number
  if (setting.type === "number") {
    return (
      <Input
        id={`setting-${setting.id}`}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // JSON → Textarea
  if (setting.type === "json") {
    return (
      <Textarea
        id={`setting-${setting.id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="font-mono text-xs"
      />
    );
  }

  // Secret → masked input with show/hide toggle
  if (setting.isSecret || setting.type === "secret") {
    return (
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={`setting-${setting.id}`}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={value ? "••••••••" : ""}
            autoComplete="off"
            className="pr-10"
          />
          <button
            type="button"
            onClick={onToggleVisible}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={visible ? "Masquer" : "Afficher"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onCopy} aria-label="Copier">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Long text → Textarea
  if (setting.value && setting.value.length > 80) {
    return (
      <Textarea
        id={`setting-${setting.id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    );
  }

  // Default → Input text
  return (
    <Input
      id={`setting-${setting.id}`}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
