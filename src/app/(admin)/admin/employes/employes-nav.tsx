"use client";
// Navigation latérale du module Employés.
// Délègue à ModuleSidebarNav (scroll + collapse + a11y + mobile drawer).
import {
  Users, Network, Shield, ShieldCheck, Briefcase, FileText, FileSignature,
  Clock, Calculator, CalendarDays, GitBranch, BadgeCheck, AlertTriangle,
  GraduationCap, BarChart, Award, MessageSquare, Megaphone, Cake,
  LogOut, FileBarChart, ScrollText, Laptop, CalendarRange,
  UsersRound, FolderOpen, Timer, Wrench, HeartPulse, Radio, Archive, BookOpen,
} from "lucide-react";
import { ModuleSidebarNav, type NavSection } from "@/components/admin/module-sidebar-nav";

const SECTIONS: NavSection[] = [
  {
    group: "Personnes",
    groupIcon: UsersRound,
    items: [
      { href: "/admin/employes", label: "Liste", icon: Users },
      { href: "/admin/employes/equipes", label: "Équipes", icon: Network },
      { href: "/admin/employes/organigramme", label: "Organigramme", icon: GitBranch },
      { href: "/admin/employes/roles", label: "Rôles", icon: Shield },
      { href: "/admin/employes/postes", label: "Postes", icon: Briefcase },
    ],
  },
  {
    group: "Documents",
    groupIcon: FolderOpen,
    items: [
      { href: "/admin/employes/contrats", label: "Contrats", icon: FileSignature },
      { href: "/admin/employes/documents", label: "Documents", icon: FileText },
      { href: "/admin/employes/documents/cahiers", label: "Cahiers", icon: BookOpen },
      { href: "/admin/employes/documents/bibliotheque", label: "Bibliothèque", icon: BookOpen },
      { href: "/admin/employes/politiques", label: "Politiques", icon: ScrollText },
    ],
  },
  {
    group: "Temps & paie",
    groupIcon: Timer,
    items: [
      { href: "/admin/employes/pointage", label: "Pointage", icon: Clock },
      { href: "/admin/employes/codes-taches", label: "Codes de tâche", icon: Briefcase },
      { href: "/admin/employes/conges", label: "Congés", icon: CalendarDays },
      { href: "/admin/employes/conges/fenetres", label: "Fenêtres de sélection", icon: CalendarRange },
      { href: "/admin/employes/conges/politiques", label: "Politiques congés", icon: ShieldCheck },
      { href: "/admin/employes/calendrier", label: "Calendrier RH", icon: CalendarDays },
      { href: "/admin/employes/paie", label: "Paie", icon: Calculator },
      { href: "/admin/employes/compensation", label: "Salaires & bonus", icon: BarChart },
    ],
  },
  {
    group: "Qualifications",
    groupIcon: Wrench,
    items: [
      { href: "/admin/employes/permis", label: "Permis", icon: BadgeCheck },
      { href: "/admin/employes/formations", label: "Formations", icon: GraduationCap },
      { href: "/admin/employes/equipement", label: "Équipement", icon: Laptop },
      { href: "/admin/employes/onboarding", label: "Onboarding", icon: ScrollText },
    ],
  },
  {
    group: "Suivi RH",
    groupIcon: HeartPulse,
    items: [
      { href: "/admin/employes/evaluations", label: "Évaluations", icon: Award },
      { href: "/admin/employes/one-on-ones", label: "1-on-1", icon: MessageSquare },
      { href: "/admin/employes/cnesst", label: "CNESST", icon: AlertTriangle },
    ],
  },
  {
    group: "Communications",
    groupIcon: Radio,
    items: [
      { href: "/admin/employes/annonces", label: "Annonces", icon: Megaphone },
      { href: "/admin/employes/anniversaires", label: "Anniversaires", icon: Cake },
    ],
  },
  {
    group: "Fiscal & sortie",
    groupIcon: Archive,
    items: [
      { href: "/admin/employes/docs-fiscaux", label: "Docs fiscaux", icon: FileText },
      { href: "/admin/employes/lettres", label: "Lettres d'emploi", icon: FileSignature },
      { href: "/admin/employes/offboarding", label: "Offboarding", icon: LogOut },
      { href: "/admin/employes/rapports", label: "Rapports", icon: FileBarChart },
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
  const granted = new Set(domains);
  const visible = (href: string): boolean => {
    const req = HREF_DOMAIN[href];
    if (!req) return true; // page ouverte a tous
    if (isHr) return true; // passe-partout RH
    return req !== "hr" && granted.has(req);
  };
  const sections = isHr
    ? SECTIONS
    : SECTIONS
        .map((s) => ({ ...s, items: s.items.filter((i) => visible(i.href)) }))
        .filter((s) => s.items.length > 0);
  return (
    <ModuleSidebarNav
      moduleLabel="RH"
      moduleIcon={Users}
      moduleTagline="VNK · Module RH"
      sections={sections}
      storageKey="employes-nav-collapsed"
    />
  );
}
