"use client";
import { useState } from "react";
import {
  UserPlus,
  FileText,
  Receipt,
  Briefcase,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { key: "client", label: "Client", icon: UserPlus },
  { key: "devis", label: "Devis", icon: FileText },
  { key: "facture", label: "Facture", icon: Receipt },
  { key: "mandat", label: "Mandat", icon: Briefcase },
  { key: "rdv", label: "Rendez-vous", icon: Calendar },
] as const;

export function QuickActions() {
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
            <span className="hidden sm:inline">+</span> {a.label}
          </Button>
        );
      })}
    </div>
  );
}
