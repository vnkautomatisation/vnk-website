"use client";
import { useState, useEffect, useCallback, useRef } from "react";
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
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  group: string;
};

// Pages admin statiques
const ADMIN_PAGES: ResultItem[] = [
  // Pages métier principales
  { id: "p-dashboard", label: "Tableau de bord", icon: LayoutDashboard, href: "/admin", group: "Pages" },
  { id: "p-clients", label: "Clients", icon: Users, href: "/admin/clients", group: "Pages" },
  { id: "p-mandates", label: "Mandats", icon: Briefcase, href: "/admin/mandates", group: "Pages" },
  { id: "p-quotes", label: "Devis", icon: FileText, href: "/admin/quotes", group: "Pages" },
  { id: "p-invoices", label: "Factures", icon: Receipt, href: "/admin/invoices", group: "Pages" },
  { id: "p-contracts", label: "Contrats", icon: Scale, href: "/admin/contracts", group: "Pages" },
  { id: "p-calendar", label: "Calendrier", icon: Calendar, href: "/admin/calendar", group: "Pages" },
  { id: "p-messages", label: "Messages", icon: MessageSquare, href: "/admin/messages", group: "Pages" },
  { id: "p-documents", label: "Documents", icon: FolderOpen, href: "/admin/documents", group: "Pages" },
  { id: "p-finance", label: "Finance", icon: BarChart3, href: "/admin/finance", group: "Pages" },
  { id: "p-statistics", label: "Statistiques", description: "KPIs, graphiques, top clients", icon: BarChart3, href: "/admin/statistics", group: "Pages" },
  { id: "p-transactions", label: "Transactions", icon: CreditCard, href: "/admin/transactions", group: "Pages" },
  { id: "p-profile", label: "Mon profil", icon: Users, href: "/admin/profile", group: "Pages" },
  // Paramètres no-code
  { id: "s-settings", label: "Paramètres", icon: Settings, href: "/admin/settings", group: "Paramètres" },
  { id: "s-onboarding", label: "Configuration guidée", description: "Assistant 6 étapes", icon: Sparkles, href: "/admin/settings/onboarding", group: "Paramètres" },
  { id: "s-team", label: "Utilisateurs · Rôles · Postes", description: "Gérer l'équipe et permissions", icon: Users, href: "/admin/settings/team", group: "Paramètres" },
  { id: "s-branding", label: "Charte graphique", description: "Logos, couleurs, polices", icon: Palette, href: "/admin/settings/branding", group: "Paramètres" },
  { id: "s-catalogs", label: "Catalogues", description: "Services, codes promo, étiquettes...", icon: LayoutGrid, href: "/admin/settings/catalogs", group: "Paramètres" },
  { id: "s-content", label: "Contenu public", description: "Blog, FAQ, témoignages", icon: Newspaper, href: "/admin/settings/content", group: "Paramètres" },
  { id: "s-templates", label: "Modèles emails & PDF", description: "Templates transactionnels", icon: Mail, href: "/admin/settings/templates", group: "Paramètres" },
  { id: "s-finance", label: "Finance & Loi 25", description: "Banque, taxes, RPRP", icon: Wallet, href: "/admin/settings/finance", group: "Paramètres" },
  { id: "s-maintenance", label: "Maintenance & Annonces", description: "Bandeau global, incidents", icon: Wrench, href: "/admin/settings/maintenance", group: "Paramètres" },
  { id: "s-backup", label: "Sauvegarde", description: "Export / import JSON", icon: Database, href: "/admin/settings/backup", group: "Paramètres" },
  { id: "s-diagnostics", label: "Diagnostics", description: "Santé du portail", icon: Activity, href: "/admin/settings/diagnostics", group: "Paramètres" },
  { id: "s-activity", label: "Activité de l'équipe", description: "Journal des actions admin", icon: Users, href: "/admin/settings/activity", group: "Paramètres" },
  { id: "s-webhooks", label: "Webhooks", description: "Sortants + entrants debug", icon: Webhook, href: "/admin/settings/webhooks", group: "Paramètres" },
  { id: "s-security", label: "Sécurité avancée", description: "Politique, 2FA, IP whitelist", icon: Shield, href: "/admin/settings/security", group: "Paramètres" },
  { id: "s-api", label: "Tokens API", description: "Tokens personnels d'accès REST", icon: Key, href: "/admin/settings/api", group: "Paramètres" },
  { id: "s-push", label: "Notifications push", description: "Alertes navigateur", icon: Bell, href: "/admin/settings/push", group: "Paramètres" },
  { id: "s-demo", label: "Mode démo", description: "Générer/purger data fictive", icon: FlaskConical, href: "/admin/settings/demo", group: "Paramètres" },
  // Actions rapides (créer)
  { id: "a-new-client", label: "Nouveau client", icon: Users, href: "/admin/clients?action=new", group: "Actions" },
  { id: "a-new-quote", label: "Nouveau devis", icon: FileText, href: "/admin/quotes?action=new", group: "Actions" },
  { id: "a-new-invoice", label: "Nouvelle facture", icon: Receipt, href: "/admin/invoices?action=new", group: "Actions" },
  { id: "a-new-user", label: "Nouvel utilisateur", icon: Shield, href: "/admin/settings/team", group: "Actions" },
  { id: "a-new-promo", label: "Nouveau code promo", icon: Zap, href: "/admin/settings/catalogs", group: "Actions" },
  { id: "a-new-post", label: "Nouvel article blog", icon: Newspaper, href: "/admin/settings/content", group: "Actions" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<ResultItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Raccourci clavier personnalisable via préférences admin (défaut Cmd/Ctrl + K)
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

  // Focus l'input quand on ouvre
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Recherche dans les pages statiques + fetch API
  const search = useCallback(
    async (q: string) => {
      const lower = q.toLowerCase();
      if (!lower) {
        setSearchResults([]);
        return;
      }

      // Filtre pages statiques
      const pageResults = ADMIN_PAGES.filter(
        (p) =>
          p.label.toLowerCase().includes(lower) ||
          p.id.includes(lower)
      );

      // Recherche API clients
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
                group: "Clients",
              })
            );
          }
        } catch {
          // silently fail
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

  // Grouper les resultats
  const groups: Record<string, ResultItem[]> = {};
  for (const item of allResults) {
    (groups[item.group] ??= []).push(item);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150"
        onClick={() => setOpen(false)}
      />

      {/* Modale */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 animate-in fade-in-0 slide-in-from-top-4 duration-200">
        <div className="bg-background border rounded-xl shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un client, une page..."
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
              ESC
            </kbd>
          </div>

          {/* Resultats */}
          <div className="max-h-[320px] overflow-y-auto p-2">
            {allResults.length === 0 && query ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucun resultat pour &quot;{query}&quot;
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
                          <span className="font-medium">{item.label}</span>
                          {item.description && (
                            <span className="text-muted-foreground ml-2 text-xs truncate">
                              {item.description}
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

          {/* Footer */}
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
