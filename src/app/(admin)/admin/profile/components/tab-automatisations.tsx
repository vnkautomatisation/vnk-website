"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Zap, Bell, Receipt, MessageSquare } from "lucide-react";

type AutomationToggle = {
  key: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
};

const AUTOMATIONS: AutomationToggle[] = [
  {
    key: "auto_invoice",
    titleKey: "auto_invoice_title",
    descriptionKey: "auto_invoice_desc",
    icon: Receipt,
  },
  {
    key: "auto_notify",
    titleKey: "auto_notify_title",
    descriptionKey: "auto_notify_desc",
    icon: MessageSquare,
  },
  {
    key: "auto_reminder",
    titleKey: "auto_reminder_title",
    descriptionKey: "auto_reminder_desc",
    icon: Bell,
  },
];

export function TabAutomatisations() {
  const t = useTranslations("admin.profile.banner");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    auto_invoice: true,
    auto_notify: true,
    auto_reminder: true,
  });

  const handleToggle = (key: string, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
    toast.success(value ? t("automatisation_activee") : t("automatisation_desactivee"));
  };

  const handleSendReminders = () => {
    toast.success(t("rappels_envoyes_clients_factures_retard"));
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" />
          {t("automatisations")}
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
                    <p className="text-sm font-semibold">{t(auto.titleKey)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(auto.descriptionKey)}</p>
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
          {t("envoyer_rappels_maintenant")}
        </Button>
      </CardContent>
    </Card>
  );
}
