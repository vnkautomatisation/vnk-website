"use client";
// Navigation latérale Mon espace (self-service employé).
// Délègue à ModuleSidebarNav (scroll + collapse + a11y + mobile drawer).
import {
  Home, FileText, Clock, Calculator, CalendarDays, Briefcase, GraduationCap,
  Heart, CreditCard, Users, Megaphone, UserCircle,
  Sparkles, FolderClosed, Building2,
} from "lucide-react";
import { ModuleSidebarNav, type NavSection } from "@/components/admin/module-sidebar-nav";
import { useTranslations } from "next-intl";

// Refonte du menu : on consolide "Mes documents" et "Ma rémunération" dans
// les groupes existants (Mon quotidien + Mon dossier) car ils ne contenaient
// qu'un seul item chacun apres le nettoyage (Politiques RH + Mes contrats
// retires car redondants avec les tabs de /mon-espace/documents).
const SECTION_KEYS: Array<{ groupKey: string; groupIcon: React.ComponentType<{ className?: string }>; items: Array<{ href: string; labelKey: string; icon: React.ComponentType<{ className?: string }> }> }> = [
  {
    groupKey: "grp_mon_quotidien",
    groupIcon: Sparkles,
    items: [
      { href: "/admin/mon-espace", labelKey: "nav_tableau_bord", icon: Home },
      { href: "/admin/mon-espace/documents", labelKey: "nav_mes_documents", icon: FileText },
      { href: "/admin/mon-espace/pointage", labelKey: "nav_mon_pointage", icon: Clock },
      { href: "/admin/mon-espace/conges", labelKey: "nav_mes_conges", icon: CalendarDays },
    ],
  },
  {
    groupKey: "grp_mon_dossier",
    groupIcon: FolderClosed,
    items: [
      { href: "/admin/mon-espace/paie", labelKey: "nav_mes_bulletins", icon: Calculator },
      { href: "/admin/mon-espace/equipement", labelKey: "nav_mon_equipement", icon: Briefcase },
      { href: "/admin/mon-espace/formations", labelKey: "nav_formations_permis", icon: GraduationCap },
      { href: "/admin/mon-espace/urgence", labelKey: "nav_contacts_urgence", icon: Heart },
      { href: "/admin/mon-espace/bancaire", labelKey: "nav_info_bancaire", icon: CreditCard },
      { href: "/admin/mon-espace/famille", labelKey: "nav_famille_dependants", icon: Users },
    ],
  },
  {
    groupKey: "grp_mon_equipe",
    groupIcon: Building2,
    items: [
      { href: "/admin/mon-espace/equipe", labelKey: "nav_annuaire", icon: UserCircle },
      { href: "/admin/mon-espace/annonces", labelKey: "nav_annonces", icon: Megaphone },
    ],
  },
];

export function MonEspaceNav() {
  const t = useTranslations("admin.my_dashboard");
  const sections: NavSection[] = SECTION_KEYS.map((s) => ({
    group: t(s.groupKey),
    groupIcon: s.groupIcon,
    items: s.items.map((i) => ({ href: i.href, label: t(i.labelKey), icon: i.icon })),
  }));
  return (
    <ModuleSidebarNav
      moduleLabel={t("mon_espace")}
      moduleIcon={Home}
      moduleTagline={t("vnk_self_service")}
      sections={sections}
      storageKey="mon-espace-nav-collapsed"
    />
  );
}
