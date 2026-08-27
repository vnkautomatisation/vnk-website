"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  UserPlus,
  FileText,
  Receipt,
  Briefcase,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { key: "client", labelKey: "qa_client", icon: UserPlus },
  { key: "devis", labelKey: "qa_devis", icon: FileText },
  { key: "facture", labelKey: "qa_facture", icon: Receipt },
  { key: "mandat", labelKey: "qa_mandat", icon: Briefcase },
  { key: "rdv", labelKey: "qa_rdv", icon: Calendar },
] as const;

export function QuickActions() {
  const t = useTranslations("admin.ui");
  // Les modales seront branchees dans les phases suivantes
  const [, setActiveModal] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.key}
            variant="outline"
            size="sm"
            onClick={() => setActiveModal(a.key)}
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">+</span> {t(a.labelKey)}
          </Button>
        );
      })}
    </div>
  );
}
