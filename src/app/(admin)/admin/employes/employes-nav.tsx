"use client";
// Navigation latérale du module Employés.
// Délègue à ModuleSidebarNav (scroll + collapse + a11y + mobile drawer).
import {
  Users, Network, Shield, ShieldCheck, Briefcase, FileText, FileSignature,
  Clock, Calculator, CalendarDays, GitBranch, BadgeCheck, AlertTriangle,
  GraduationCap, BarChart, Award, MessageSquare, Megaphone, Cake,
  LogOut, FileBarChart, ScrollText, Laptop, CalendarRange,
  UsersRound, FolderOpen, Timer, Wrench, HeartPulse, Radio, Archive,
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
      { href: "/admin/employes/documents", label: "Documents légaux", icon: FileText },
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

export function EmployesNav() {
  return (
    <ModuleSidebarNav
      moduleLabel="Employés"
      moduleIcon={Users}
      moduleTagline="VNK · Module RH"
      sections={SECTIONS}
      storageKey="employes-nav-collapsed"
    />
  );
}
