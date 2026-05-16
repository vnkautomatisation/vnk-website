"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Zap, Bell, Receipt, MessageSquare } from "lucide-react";

type AutomationToggle = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const AUTOMATIONS: AutomationToggle[] = [
  {
    key: "auto_invoice",
    title: "Générer la facture après signature",
    description: "Crée automatiquement une facture lorsque le contrat est signé",
    icon: Receipt,
  },
  {
    key: "auto_notify",
    title: "Notifier le client à chaque étape",
    description: "Messages automatiques dans la messagerie du portail",
    icon: MessageSquare,
  },
  {
    key: "auto_reminder",
    title: "Rappels des factures en retard",
    description: "Rappel automatique après la date d'échéance",
    icon: Bell,
  },
];

export function TabAutomatisations() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    auto_invoice: true,
    auto_notify: true,
    auto_reminder: true,
  });

  const handleToggle = (key: string, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
    toast.success(value ? "Automatisation activée" : "Automatisation désactivée");
  };

  const handleSendReminders = () => {
    toast.success("Rappels envoyés aux clients avec factures en retard");
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Automatisations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {AUTOMATIONS.map((auto, i) => {
          const Icon = auto.icon;
          return (
            <div key={auto.key}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{auto.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{auto.description}</p>
                  </div>
                </div>
                <Switch
                  checked={toggles[auto.key]}
                  onCheckedChange={(v) => handleToggle(auto.key, v)}
                />
              </div>
            </div>
          );
        })}

        <Separator />

        <Button variant="outline" size="sm" onClick={handleSendReminders} className="gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          Envoyer rappels maintenant
        </Button>
      </CardContent>
    </Card>
  );
}
