"use client";
// Navigation latérale du module Employés.
// Délègue à ModuleSidebarNav (scroll + collapse + a11y + mobile drawer).
import {
  Users, Network, Shield, ShieldCheck, Briefcase, FileText, FileSignature,
  Clock, Calculator, CalendarDays, GitBranch, BadgeCheck, AlertTriangle,
  GraduationCap, BarChart, Award, MessageSquare, Megaphone, Cake,
  LogOut, FileBarChart, ScrollText, Laptop, CalendarRange,
  UsersRound, FolderOpen, Timer, Wrench, HeartPulse, Radio, Archive, BookOpen,
  SlidersHorizontal,
} from "lucide-react";
import { ModuleSidebarNav, type NavSection } from "@/components/admin/module-sidebar-nav";
import { useTranslations } from "next-intl";

const SECTION_KEYS: Array<{ groupKey: string; groupIcon?: React.ComponentType<{ className?: string }>; items: Array<{ href: string; labelKey: string; icon: React.ComponentType<{ className?: string }> }> }> = [
  {
    groupKey: "grp_personnes",
    groupIcon: UsersRound,
    items: [
      { href: "/admin/employes", labelKey: "liste", icon: Users },
      { href: "/admin/employes/equipes", labelKey: "equipes", icon: Network },
      { href: "/admin/employes/organigramme", labelKey: "organigramme", icon: GitBranch },
      { href: "/admin/employes/roles", labelKey: "roles", icon: Shield },
      { href: "/admin/employes/postes", labelKey: "postes", icon: Briefcase },
    ],
  },
  {
    groupKey: "grp_documents",
    groupIcon: FolderOpen,
    items: [
      { href: "/admin/employes/contrats", labelKey: "contrats", icon: FileSignature },
      { href: "/admin/employes/documents", labelKey: "documents", icon: FileText },
      { href: "/admin/employes/documents/cahiers", labelKey: "cahiers", icon: BookOpen },
      { href: "/admin/employes/documents/bibliotheque", labelKey: "bibliotheque", icon: BookOpen },
      { href: "/admin/employes/politiques", labelKey: "politiques", icon: ScrollText },
    ],
  },
  {
    groupKey: "grp_temps_paie",
    groupIcon: Timer,
    items: [
      { href: "/admin/employes/pointage", labelKey: "pointage", icon: Clock },
      { href: "/admin/employes/pointage/parametres", labelKey: "parametres_pointage", icon: SlidersHorizontal },
      { href: "/admin/employes/codes-taches", labelKey: "codes_tache", icon: Briefcase },
      { href: "/admin/employes/conges", labelKey: "conges", icon: CalendarDays },
      { href: "/admin/employes/conges/fenetres", labelKey: "fenetres_selection", icon: CalendarRange },
      { href: "/admin/employes/conges/politiques", labelKey: "politiques_conges", icon: ShieldCheck },
      { href: "/admin/employes/calendrier", labelKey: "calendrier_rh", icon: CalendarDays },
      { href: "/admin/employes/paie", labelKey: "paie", icon: Calculator },
      { href: "/admin/employes/compensation", labelKey: "salaires_bonus", icon: BarChart },
    ],
  },
  {
    groupKey: "grp_qualifications",
    groupIcon: Wrench,
    items: [
      { href: "/admin/employes/permis", labelKey: "permis", icon: BadgeCheck },
      { href: "/admin/employes/formations", labelKey: "formations", icon: GraduationCap },
      { href: "/admin/employes/equipement", labelKey: "equipement", icon: Laptop },
      { href: "/admin/employes/onboarding", labelKey: "onboarding", icon: ScrollText },
    ],
  },
  {
    groupKey: "grp_suivi_rh",
    groupIcon: HeartPulse,
    items: [
      { href: "/admin/employes/evaluations", labelKey: "evaluations", icon: Award },
      { href: "/admin/employes/one-on-ones", labelKey: "1_on_1", icon: MessageSquare },
      { href: "/admin/employes/cnesst", labelKey: "cnesst", icon: AlertTriangle },
    ],
  },
  {
    groupKey: "grp_communications",
    groupIcon: Radio,
    items: [
      { href: "/admin/employes/annonces", labelKey: "annonces", icon: Megaphone },
      { href: "/admin/employes/anniversaires", labelKey: "anniversaires", icon: Cake },
    ],
  },
  {
    groupKey: "grp_fiscal_sortie",
    groupIcon: Archive,
    items: [
      { href: "/admin/employes/docs-fiscaux", labelKey: "docs_fiscaux", icon: FileText },
      { href: "/admin/employes/lettres", labelKey: "lettres_emploi", icon: FileSignature },
      { href: "/admin/employes/offboarding", labelKey: "offboarding", icon: LogOut },
      { href: "/admin/employes/rapports", labelKey: "rapports", icon: FileBarChart },
    ],
  },
];

// Visibilite des pages restreintes du module, par domaine RH fin.
// Valeur = domaine requis en ecriture ("hr" = passe-partout uniquement).
// Les hrefs ABSENTS de cette map restent visibles pour tous : Organigramme,
// Contrats (vue "Mes contrats"), Pointage + Conges (scope hierarchique),
// Calendrier, Equipement (lecture), Evaluations + 1-on-1 (auto-filtres),
// Anniversaires. Chaque page reste gated cote serveur — le menu n'est que
// cosmetique.
const HREF_DOMAIN: Record<string, string> = {
  "/admin/employes": "hr",
  "/admin/employes/equipes": "hr",
  "/admin/employes/roles": "hr",
  "/admin/employes/postes": "hr",
  "/admin/employes/documents": "hr_documents",
  "/admin/employes/documents/cahiers": "hr_documents",
  "/admin/employes/documents/bibliotheque": "hr_documents",
  "/admin/employes/politiques": "hr_documents",
  "/admin/employes/pointage/parametres": "timeclock",
  "/admin/employes/codes-taches": "timeclock",
  "/admin/employes/conges/fenetres": "leaves",
  "/admin/employes/conges/politiques": "leaves",
  "/admin/employes/paie": "payroll",
  "/admin/employes/compensation": "payroll",
  "/admin/employes/docs-fiscaux": "payroll",
  "/admin/employes/permis": "safety",
  "/admin/employes/formations": "safety",
  "/admin/employes/cnesst": "safety",
  "/admin/employes/onboarding": "hr",
  "/admin/employes/annonces": "hr_comms",
  "/admin/employes/lettres": "hr",
  "/admin/employes/offboarding": "hr",
  "/admin/employes/rapports": "hr",
};

export function EmployesNav({
  isHr = true,
  domains = [],
}: {
  isHr?: boolean;
  domains?: string[];
}) {
  const t = useTranslations("admin.hr_nav");
  const granted = new Set(domains);
  const visible = (href: string): boolean => {
    const req = HREF_DOMAIN[href];
    if (!req) return true; // page ouverte a tous
    if (isHr) return true; // passe-partout RH
    return req !== "hr" && granted.has(req);
  };
  const translated: NavSection[] = SECTION_KEYS.map((s) => ({
    group: t(s.groupKey),
    groupIcon: s.groupIcon,
    items: s.items.map((i) => ({ href: i.href, label: t(i.labelKey), icon: i.icon })),
  }));
  const sections = isHr
    ? translated
    : SECTION_KEYS
        .map((s, idx) => ({ ...translated[idx], items: translated[idx].items.filter((_, k) => visible(s.items[k].href)) }))
        .filter((s) => s.items.length > 0);
  return (
    <ModuleSidebarNav
      moduleLabel="RH"
      moduleIcon={Users}
      moduleTagline={t("vnk_module_rh")}
      sections={sections}
      storageKey="employes-nav-collapsed"
    />
  );
}
