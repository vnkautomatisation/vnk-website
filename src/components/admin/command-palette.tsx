"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  FileText,
  Briefcase,
  Receipt,
  Calendar,
  MessageSquare,
  Settings,
  LayoutDashboard,
  Scale,
  BarChart3,
  CreditCard,
  FolderOpen,
  ArrowRight,
  Shield,
  LayoutGrid,
  Palette,
  Newspaper,
  Wrench,
  Database,
  Activity,
  Sparkles,
  Wallet,
  Zap,
  Mail,
  Webhook,
  Key,
  Bell,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ResultItem = {
  id: string;
  label?: string;
  labelKey?: string;
  description?: string;
  descriptionKey?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  group?: string;
  groupKey?: string;
};

// Pages admin statiques
const ADMIN_PAGES: ResultItem[] = [
  // Pages métier principales
  { id: "p-dashboard", labelKey: "tableau_bord", icon: LayoutDashboard, href: "/admin", groupKey: "grp_pages" },
  { id: "p-clients", labelKey: "clients", icon: Users, href: "/admin/clients", groupKey: "grp_pages" },
  { id: "p-mandates", labelKey: "mandats", icon: Briefcase, href: "/admin/mandates", groupKey: "grp_pages" },
  { id: "p-quotes", labelKey: "devis", icon: FileText, href: "/admin/quotes", groupKey: "grp_pages" },
  { id: "p-invoices", labelKey: "factures", icon: Receipt, href: "/admin/invoices", groupKey: "grp_pages" },
  { id: "p-contracts", labelKey: "contrats", icon: Scale, href: "/admin/contracts", groupKey: "grp_pages" },
  { id: "p-calendar", labelKey: "calendrier", icon: Calendar, href: "/admin/calendar", groupKey: "grp_pages" },
  { id: "p-messages", labelKey: "messages", icon: MessageSquare, href: "/admin/messages", groupKey: "grp_pages" },
  { id: "p-documents", labelKey: "documents", icon: FolderOpen, href: "/admin/documents", groupKey: "grp_pages" },
  { id: "p-finance", labelKey: "finance", icon: BarChart3, href: "/admin/finance", groupKey: "grp_pages" },
  { id: "p-statistics", labelKey: "statistiques", descriptionKey: "kpis_graphiques_top_clients", icon: BarChart3, href: "/admin/statistics", groupKey: "grp_pages" },
  { id: "p-transactions", labelKey: "transactions", icon: CreditCard, href: "/admin/transactions", groupKey: "grp_pages" },
  { id: "p-profile", labelKey: "mon_profil", icon: Users, href: "/admin/profile", groupKey: "grp_pages" },
  // Paramètres no-code
  { id: "s-settings", labelKey: "parametres", icon: Settings, href: "/admin/settings", groupKey: "grp_parametres" },
  { id: "s-onboarding", labelKey: "configuration_guidee", descriptionKey: "assistant_6_etapes", icon: Sparkles, href: "/admin/settings/onboarding", groupKey: "grp_parametres" },
  { id: "s-team", labelKey: "utilisateurs_roles_postes", descriptionKey: "gerer_equipe_permissions", icon: Users, href: "/admin/settings/team", groupKey: "grp_parametres" },
  { id: "s-branding", labelKey: "charte_graphique", descriptionKey: "logos_couleurs_polices", icon: Palette, href: "/admin/settings/branding", groupKey: "grp_parametres" },
  { id: "s-catalogs", labelKey: "catalogues", descriptionKey: "services_codes_promo_etiquettes", icon: LayoutGrid, href: "/admin/settings/catalogs", groupKey: "grp_parametres" },
  { id: "s-content", labelKey: "contenu_public", descriptionKey: "blog_faq_temoignages", icon: Newspaper, href: "/admin/settings/content", groupKey: "grp_parametres" },
  { id: "s-templates", labelKey: "modeles_emails_pdf", descriptionKey: "templates_transactionnels", icon: Mail, href: "/admin/settings/templates", groupKey: "grp_parametres" },
  { id: "s-finance", labelKey: "finance_loi_25", descriptionKey: "banque_taxes_rprp", icon: Wallet, href: "/admin/settings/finance", groupKey: "grp_parametres" },
  { id: "s-maintenance", labelKey: "maintenance_annonces", descriptionKey: "bandeau_global_incidents", icon: Wrench, href: "/admin/settings/maintenance", groupKey: "grp_parametres" },
  { id: "s-backup", labelKey: "sauvegarde", descriptionKey: "export_import_json", icon: Database, href: "/admin/settings/backup", groupKey: "grp_parametres" },
  { id: "s-diagnostics", labelKey: "diagnostics", descriptionKey: "sante_portail", icon: Activity, href: "/admin/settings/diagnostics", groupKey: "grp_parametres" },
  { id: "s-activity", labelKey: "activite_equipe", descriptionKey: "journal_actions_admin", icon: Users, href: "/admin/settings/activity", groupKey: "grp_parametres" },
  { id: "s-webhooks", labelKey: "webhooks", descriptionKey: "sortants_entrants_debug", icon: Webhook, href: "/admin/settings/webhooks", groupKey: "grp_parametres" },
  { id: "s-security", labelKey: "securite_avancee", descriptionKey: "politique_2fa_ip_whitelist", icon: Shield, href: "/admin/settings/security", groupKey: "grp_parametres" },
  { id: "s-api", labelKey: "tokens_api", descriptionKey: "tokens_personnels_acces_rest", icon: Key, href: "/admin/settings/api", groupKey: "grp_parametres" },
  { id: "s-push", labelKey: "notifications_push", descriptionKey: "alertes_navigateur", icon: Bell, href: "/admin/settings/push", groupKey: "grp_parametres" },
  { id: "s-demo", labelKey: "mode_demo", descriptionKey: "generer_purger_data_fictive", icon: FlaskConical, href: "/admin/settings/demo", groupKey: "grp_parametres" },
  // Actions rapides (créer)
  { id: "a-new-client", labelKey: "nouveau_client", icon: Users, href: "/admin/clients?action=new", groupKey: "grp_actions" },
  { id: "a-new-quote", labelKey: "nouveau_devis", icon: FileText, href: "/admin/quotes?action=new", groupKey: "grp_actions" },
  { id: "a-new-invoice", labelKey: "nouvelle_facture", icon: Receipt, href: "/admin/invoices?action=new", groupKey: "grp_actions" },
  { id: "a-new-user", labelKey: "nouvel_utilisateur", icon: Shield, href: "/admin/settings/team", groupKey: "grp_actions" },
  { id: "a-new-promo", labelKey: "nouveau_code_promo", icon: Zap, href: "/admin/settings/catalogs", groupKey: "grp_actions" },
  { id: "a-new-post", labelKey: "nouvel_article_blog", icon: Newspaper, href: "/admin/settings/content", groupKey: "grp_actions" },
];

export function CommandPalette() {
  const t = useTranslations("admin.command_palette");
  // Les entrees statiques portent une cle, les resultats dynamiques du texte.
  const itemLabel = (i: ResultItem) => (i.labelKey ? t(i.labelKey) : i.label ?? "");
  const itemDescription = (i: ResultItem) => (i.descriptionKey ? t(i.descriptionKey) : i.description ?? "");
  const itemGroup = (i: ResultItem) => (i.groupKey ? t(i.groupKey) : i.group ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<ResultItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();


  useEffect(() => {
    const getSearchKey = (): string => {
      try {
        return (localStorage.getItem("vnk-admin-shortcut-search") || "k").toLowerCase();
      } catch {
        return "k";
      }
    };
    const handler = (e: KeyboardEvent) => {
      const searchKey = getSearchKey();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === searchKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);


  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);


  const search = useCallback(
    async (q: string) => {
      const lower = q.toLowerCase();
      if (!lower) {
        setSearchResults([]);
        return;
      }


      const pageResults = ADMIN_PAGES.filter(
        (p) =>
          itemLabel(p).toLowerCase().includes(lower) ||
          p.id.includes(lower)
      );


      let clientResults: ResultItem[] = [];
      if (lower.length >= 2) {
        try {
          const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=5`);
          if (res.ok) {
            const data = await res.json();
            clientResults = (data.clients ?? data).slice(0, 5).map(
              (c: { id: number; fullName: string; companyName?: string; email: string }) => ({
                id: `c-${c.id}`,
                label: c.fullName,
                description: c.companyName || c.email,
                icon: Users,
                href: `/admin/clients?open=${c.id}`,
                group: t("clients"),
              })
            );
          }
        } catch {

        }
      }

      setSearchResults([...clientResults, ...pageResults]);
      setActiveIndex(0);
    },
    []
  );

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 150);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const allResults = query ? searchResults : ADMIN_PAGES.slice(0, 6);

  const navigate = (item: ResultItem) => {
    setOpen(false);
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allResults[activeIndex]) {
      e.preventDefault();
      navigate(allResults[activeIndex]);
    }
  };

  if (!open) return null;


  const groups: Record<string, ResultItem[]> = {};
  for (const item of allResults) {
    (groups[itemGroup(item)] ??= []).push(item);
  }

  return (
    <>

      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150"
        onClick={() => setOpen(false)}
      />


      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 animate-in fade-in-0 slide-in-from-top-4 duration-200">
        <div className="bg-background border rounded-xl shadow-2xl overflow-hidden">

          <div className="flex items-center gap-3 px-4 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("rechercher_client_page")}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
              ESC
            </kbd>
          </div>


          <div className="max-h-[320px] overflow-y-auto p-2">
            {allResults.length === 0 && query ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t("aucun_resultat_pour", { query })}
              </div>
            ) : (
              Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </div>
                  {items.map((item) => {
                    const idx = allResults.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          idx === activeIndex ? "bg-muted" : "hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 text-left min-w-0">
                          <span className="font-medium">{itemLabel(item)}</span>
                          {itemDescription(item) && (
                            <span className="text-muted-foreground ml-2 text-xs truncate">
                              {itemDescription(item)}
                            </span>
                          )}
                        </div>
                        {idx === activeIndex && (
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>


          <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="bg-muted px-1 py-0.5 rounded font-mono">↑↓</kbd> naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-muted px-1 py-0.5 rounded font-mono">↵</kbd> ouvrir
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-muted px-1 py-0.5 rounded font-mono">esc</kbd> fermer
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
