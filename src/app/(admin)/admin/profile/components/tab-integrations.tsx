"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plug, CreditCard, FileSignature, Calendar, Mail, ExternalLink } from "lucide-react";

type Integration = {
  key: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  status: "connected" | "not_configured";
  url?: string;
};

const INTEGRATIONS: Integration[] = [
  { key: "stripe", name: "Stripe", icon: CreditCard, color: "text-[#635BFF]", status: "connected", url: "https://dashboard.stripe.com" },
  { key: "dropbox_sign", name: "Dropbox Sign", icon: FileSignature, color: "text-[#0061FF]", status: "not_configured", url: "https://app.hellosign.com" },
  { key: "calendly", name: "Calendly", icon: Calendar, color: "text-[#006BFF]", status: "not_configured" },
  { key: "smtp", name: "Courriel SMTP", icon: Mail, color: "text-[#34A853]", status: "not_configured" },
];

export function TabIntegrations() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="h-4 w-4" />
          Integrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {INTEGRATIONS.map((integ) => {
          const Icon = integ.icon;
          return (
            <div
              key={integ.key}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${integ.color}`} />
                <span className="text-sm font-semibold">{integ.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    integ.status === "connected"
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-100"
                  }
                >
                  {integ.status === "connected" ? "Connecte" : "Non configure"}
                </Badge>
                {integ.url && (
                  <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                    <a href={integ.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
