"use client";
// Navigation latérale Mon espace (self-service employé).
// Délègue à ModuleSidebarNav (scroll + collapse + a11y + mobile drawer).
import {
  Home, FileText, Clock, Calculator, CalendarDays, Briefcase, GraduationCap,
  Heart, CreditCard, Users, FileSignature, Megaphone, UserCircle, ScrollText,
} from "lucide-react";
import { ModuleSidebarNav, type NavSection } from "@/components/admin/module-sidebar-nav";

const SECTIONS: NavSection[] = [
  {
    group: "Mon quotidien",
    items: [
      { href: "/admin/mon-espace", label: "Tableau de bord", icon: Home },
      { href: "/admin/mon-espace/pointage", label: "Mon pointage", icon: Clock },
      { href: "/admin/mon-espace/conges", label: "Mes congés", icon: CalendarDays },
    ],
  },
  {
    group: "Mes documents",
    items: [
      { href: "/admin/mon-espace/documents", label: "Documents", icon: FileText },
      { href: "/admin/mon-espace/contrats", label: "Mes contrats", icon: FileSignature },
      { href: "/admin/mon-espace/politiques", label: "Politiques RH", icon: ScrollText },
    ],
  },
  {
    group: "Ma rémunération",
    items: [
      { href: "/admin/mon-espace/paie", label: "Mes bulletins", icon: Calculator },
    ],
  },
  {
    group: "Mon dossier",
    items: [
      { href: "/admin/mon-espace/equipement", label: "Mon équipement", icon: Briefcase },
      { href: "/admin/mon-espace/formations", label: "Formations & permis", icon: GraduationCap },
      { href: "/admin/mon-espace/urgence", label: "Contacts d'urgence", icon: Heart },
      { href: "/admin/mon-espace/bancaire", label: "Info bancaire", icon: CreditCard },
      { href: "/admin/mon-espace/famille", label: "Famille / dépendants", icon: Users },
    ],
  },
  {
    group: "Mon équipe",
    items: [
      { href: "/admin/mon-espace/equipe", label: "Annuaire", icon: UserCircle },
      { href: "/admin/mon-espace/annonces", label: "Annonces", icon: Megaphone },
    ],
  },
];

export function MonEspaceNav() {
  return (
    <ModuleSidebarNav
      moduleLabel="Mon espace"
      moduleIcon={Home}
      moduleTagline="VNK · Self-service"
      sections={SECTIONS}
      storageKey="mon-espace-nav-collapsed"
    />
  );
}
