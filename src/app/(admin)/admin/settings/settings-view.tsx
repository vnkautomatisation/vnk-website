"use client";
// Section Paramètres — 15 onglets en cartes style VNK
// Chaque catégorie s'affiche comme une carte cliquable qui ouvre l'édition
import { useState, useTransition, useEffect, useRef } from "react";
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
  Database,
  Activity,
  Settings as SettingsIcon,
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
import { TabIntegrations } from "../profile/components/tab-integrations";
import { TabAutomatisations } from "../profile/components/tab-automatisations";
import { TabNotifications } from "../profile/components/tab-notifications";
import Link from "next/link";
import { ChevronLeft, FileText, Zap, ArrowRight } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// CATÉGORIES — définies ici pour l'icône et l'ordre d'affichage
// ═══════════════════════════════════════════════════════════

type CategoryMeta = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // tailwind bg-*
};

type CategoryMetaExtended = CategoryMeta & {
  custom?: "integrations" | "automations" | "email_templates" | "notifications";
  href?: string; // si défini → la carte navigue vers une autre page au lieu d'ouvrir l'éditeur inline
  badgeLabel?: string; // libellé custom du badge module
};

// ───────────────────────────────────────────────────────────
// Palette VNK restreinte : 4 familles fonctionnelles seulement
//   navy   = configuration générale & organisation (par défaut)
//   blue   = communication & contenu
//   green  = finance & conformité
//   amber  = système & technique
// ───────────────────────────────────────────────────────────
const FAMILY = {
  navy: "bg-[#0F2D52]",       // Général · Entreprise · Portail · Équipe
  blue: "bg-[#1A5FB4]",       // Email · Templates · Notifications · Contenu · Branding
  green: "bg-[#26A269]",      // Finance · Légal · Catalogues · Comptabilité
  amber: "bg-[#C77700]",      // Système · Diagnostics · Backup · API · Sécurité
} as const;

const CATEGORIES: CategoryMetaExtended[] = [
  { key: "general", icon: LayoutGrid, accent: FAMILY.navy },
  { key: "company", icon: Building2, accent: FAMILY.navy },
  { key: "portal", icon: Briefcase, accent: FAMILY.navy },
  { key: "users", icon: Users, accent: FAMILY.navy, href: "/admin/settings/team", badgeLabel: "Utilisateurs · Rôles · Postes" },
  { key: "catalogs", icon: LayoutGrid, accent: FAMILY.green, href: "/admin/settings/catalogs", badgeLabel: "Services · Codes promo · Listes" },
  { key: "billing", icon: Receipt, accent: FAMILY.green, href: "/admin/settings/finance", badgeLabel: "Banque · Taxes · Loi 25" },
  { key: "legal", icon: Scale, accent: FAMILY.green, href: "/admin/settings/finance", badgeLabel: "Voir Finance & Loi 25" },
  { key: "signature", icon: FileSignature, accent: FAMILY.blue },
  { key: "emails", icon: Mail, accent: FAMILY.blue },
  { key: "email_templates", icon: FileText, accent: FAMILY.blue, href: "/admin/settings/templates", badgeLabel: "Modèles emails + PDF" },
  { key: "notifications", icon: Bell, accent: FAMILY.blue, custom: "notifications" },
  { key: "blog", icon: Newspaper, accent: FAMILY.blue, href: "/admin/settings/content", badgeLabel: "Blog · FAQ · Témoignages" },
  { key: "appearance", icon: Palette, accent: FAMILY.blue, href: "/admin/settings/branding", badgeLabel: "Logos · Couleurs · Polices" },
  { key: "integrations", icon: Plug, accent: FAMILY.amber, custom: "integrations" },
  { key: "automations", icon: Zap, accent: FAMILY.amber, custom: "automations" },
  { key: "webhooks", icon: Plug, accent: FAMILY.amber, href: "/admin/settings/webhooks", badgeLabel: "Sortants + entrants debug" },
  { key: "system", icon: Server, accent: FAMILY.amber, href: "/admin/settings/maintenance", badgeLabel: "Maintenance · Incidents · Annonce" },
  { key: "diagnostics", icon: Activity, accent: FAMILY.amber, href: "/admin/settings/diagnostics", badgeLabel: "Santé · DB · Intégrations" },
  { key: "backup", icon: Database, accent: FAMILY.amber, href: "/admin/settings/backup", badgeLabel: "Export · Import JSON" },
  { key: "seo", icon: Search, accent: FAMILY.blue },
  { key: "analytics", icon: BarChart3, accent: FAMILY.green },
];

// ═══════════════════════════════════════════════════════════

export type OverviewMetrics = {
  adminsActive: number;
  roles: number;
  positions: number;
  catalogItems: number;
  contentPublished: number;
  posts: number;
  faqs: number;
  testimonials: number;
  emailTpl: number;
  pdfTpl: number;
  services: number;
  promos: number;
  logosUploaded: number;
  fiscalDone: boolean;
  rprpDone: boolean;
  integrationsEnabled: number;
};

export function SettingsView({
  settingsByCategory,
  overview,
}: {
  settingsByCategory: Record<string, Setting[]>;
  overview?: OverviewMetrics;
}) {
  const t = useTranslations("settings");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Sticky scroll detection (pattern dashboard finance)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Filtrer categories par recherche
  const filteredCategories = searchQuery
    ? CATEGORIES.filter((cat) => {
        const q = searchQuery.toLowerCase();
        // Chercher dans le nom de la categorie
        const catName = t(`categories.${cat.key}`).toLowerCase();
        if (catName.includes(q)) return true;
        // Chercher dans les labels/descriptions des parametres
        const settings = settingsByCategory[cat.key] ?? [];
        return settings.some(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            s.key.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q)
        );
      })
    : CATEGORIES;

  if (activeCategory) {
    const meta = CATEGORIES.find((c) => c.key === activeCategory)!;
    // Catégories à rendu personnalisé (composants spécialisés au lieu du formulaire générique)
    if (meta.custom) {
      return <CustomCategoryView meta={meta} onBack={() => setActiveCategory(null)} />;
    }
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
    <div className="space-y-5">
      {/* ── Hero navy gradient ───────────────────────────── */}
      <div className="relative bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-5 text-white overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4) 0%, transparent 50%)",
          }}
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center shrink-0 shadow-lg ring-2 ring-white/15">
              <SettingsIcon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t("page_title")}</h1>
              <p className="text-white/75 text-sm mt-1">{t("page_subtitle")}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Link
              href="/admin/settings/activity"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium transition-colors"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Activité</span>
            </Link>
            <Link
              href="/admin/settings/onboarding"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white text-[#0F2D52] text-sm font-semibold hover:bg-white/95 shadow-sm transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M11.9 7.6c-.4 0-.8.3-.9.7l-.6 2.4-2.4.6c-.4.1-.7.5-.7.9s.3.8.7.9l2.4.6.6 2.4c.1.4.5.7.9.7s.8-.3.9-.7l.6-2.4 2.4-.6c.4-.1.7-.5.7-.9s-.3-.8-.7-.9l-2.4-.6-.6-2.4c-.1-.4-.5-.7-.9-.7Z" />
              </svg>
              <span className="hidden sm:inline">Configuration guidée</span>
              <span className="sm:hidden">Setup</span>
            </Link>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="pl-9 bg-white/10 backdrop-blur border-white/20 text-white placeholder:text-white/50 hover:bg-white/15 hover:border-white/30 focus-visible:bg-white/20 focus-visible:border-white/40 focus-visible:ring-white/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Overview cockpit no-code ──────────────────────── */}
      {overview && !searchQuery && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <OverviewCard
            href="/admin/settings/team"
            icon={Users}
            label="Équipe"
            value={overview.adminsActive}
            hint={`${overview.roles} rôle${overview.roles > 1 ? "s" : ""} · ${overview.positions} poste${overview.positions > 1 ? "s" : ""}`}
          />
          <OverviewCard
            href="/admin/settings/branding"
            icon={Palette}
            label="Branding"
            value={`${overview.logosUploaded}/6`}
            hint="logos téléversés"
          />
          <OverviewCard
            href="/admin/settings/catalogs"
            icon={LayoutGrid}
            label="Catalogues"
            value={overview.catalogItems}
            hint={`${overview.services} service${overview.services > 1 ? "s" : ""} · ${overview.promos} promo${overview.promos > 1 ? "s" : ""}`}
          />
          <OverviewCard
            href="/admin/settings/content"
            icon={Newspaper}
            label="Contenu"
            value={overview.contentPublished}
            hint={`${overview.posts} blog · ${overview.faqs} FAQ · ${overview.testimonials} avis`}
          />
          <OverviewCard
            href="/admin/settings/templates"
            icon={FileText}
            label="Modèles"
            value={overview.emailTpl + overview.pdfTpl}
            hint={`${overview.emailTpl} email · ${overview.pdfTpl} PDF`}
          />
          <OverviewCard
            href="/admin/settings/finance"
            icon={Receipt}
            label="Conformité"
            value={`${(overview.fiscalDone ? 1 : 0) + (overview.rprpDone ? 1 : 0)}/2`}
            hint={`${overview.fiscalDone ? "✓" : "○"} fiscal · ${overview.rprpDone ? "✓" : "○"} Loi 25`}
          />
        </div>
      )}

      {/* Sentinel + Sticky compact bar (pattern dashboard finance) */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <SettingsIcon className="h-4 w-4" />
              {t("page_title")}
            </span>
            <span className="text-muted-foreground">{filteredCategories.length} catégorie{filteredCategories.length > 1 ? "s" : ""}</span>
            {searchQuery && <span className="text-muted-foreground">Recherche : <span className="font-semibold">«&nbsp;{searchQuery}&nbsp;»</span></span>}
          </div>
        </div>
      )}

      {/* ── Grille de catégories ──────────────────────────── */}
      {filteredCategories.length === 0 && searchQuery ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Aucun parametre correspondant a &quot;{searchQuery}&quot;
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filteredCategories.map((cat) => {
          const Icon = cat.icon;
          const count = settingsByCategory[cat.key]?.length ?? 0;
          const isCustom = !!cat.custom;
          const hasHref = !!cat.href;

          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center text-white shadow-sm",
                    cat.accent
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all mt-1" />
              </div>

              <h3 className="mt-3 font-semibold text-sm leading-tight text-foreground group-hover:text-[#0F2D52] transition-colors">
                {t(`categories.${cat.key}`)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">
                {t(`categories.${cat.key}_desc`)}
              </p>

              <div className="mt-3 pt-3 border-t border-border/50">
                {hasHref ? (
                  <span className="text-[10px] font-medium text-[#0F2D52]/80 inline-flex items-center gap-1">
                    {cat.badgeLabel ?? "Module avancé"}
                  </span>
                ) : isCustom ? (
                  <span className="text-[10px] font-medium text-[#0F2D52]/80">
                    Module avancé
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {count} {count > 1 ? "paramètres" : "paramètre"}
                  </span>
                )}
              </div>
            </>
          );

          const sharedClass = cn(
            "group text-left block",
            "rounded-xl border bg-card p-4",
            "transition-all duration-200",
            "hover:shadow-md hover:-translate-y-0.5 hover:border-[#0F2D52]/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2D52]/30 focus-visible:ring-offset-2"
          );

          if (hasHref) {
            return (
              <Link key={cat.key} href={cat.href!} className={sharedClass} aria-label={t(`categories.${cat.key}`)}>
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={sharedClass}
              aria-label={t(`categories.${cat.key}`)}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {/* ── Info footer ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#0F2D52]/15 bg-[#0F2D52]/[0.03] px-4 py-3 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-[#0F2D52]/60 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-[#0F2D52]">Configuration du portail · </span>
          Toutes les modifications sont appliquées immédiatement et enregistrées dans l&apos;historique d&apos;activité.
        </div>
      </div>
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

// ═══════════════════════════════════════════════════════════
// CUSTOM CATEGORY — rend un composant spécialisé au lieu du
// formulaire générique (Intégrations, Automatisations, etc.)
// ═══════════════════════════════════════════════════════════

function CustomCategoryView({
  meta,
  onBack,
}: {
  meta: CategoryMetaExtended;
  onBack: () => void;
}) {
  const t = useTranslations("settings");
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-1 text-muted-foreground hover:text-foreground"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
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

      {/* Contenu spécialisé selon le type */}
      {meta.custom === "integrations" && <TabIntegrations />}
      {meta.custom === "automations" && <TabAutomatisations />}
      {meta.custom === "notifications" && <NotificationsWrapper />}
      {meta.custom === "email_templates" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold mb-1">Personnalisation des courriels</p>
              <p className="text-xs">
                Modifiez le contenu des courriels envoyés automatiquement à vos clients
                (devis, factures, rappels, confirmations de signature, etc.). Vous pouvez
                utiliser des variables dynamiques comme <code className="bg-blue-100 px-1 rounded">{`{{nom_client}}`}</code> ou <code className="bg-blue-100 px-1 rounded">{`{{montant}}`}</code>.
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/message-templates" className="flex items-center gap-2">
                Ouvrir l&apos;éditeur de modèles
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Wrapper qui charge l'admin courant pour TabNotifications ──
function NotificationsWrapper() {
  const [admin, setAdmin] = useState<Parameters<typeof TabNotifications>[0]["admin"] | null>(null);
  useEffect(() => {
    fetch("/api/profile/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAdmin(d?.admin ?? null))
      .catch(() => setAdmin(null));
  }, []);
  if (!admin) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Save className="h-5 w-5 animate-pulse" />
      </div>
    );
  }
  return <TabNotifications admin={admin} />;
}

// ─── Carte KPI overview cockpit (style sobre navy) ─────────
function OverviewCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border bg-card p-3 transition-all hover:shadow-md hover:border-[#0F2D52]/30 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-6 w-6 rounded-md bg-[#0F2D52]/8 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-[#0F2D52]" />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground group-hover:text-[#0F2D52] transition-colors">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-[#0F2D52] tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </Link>
  );
}
