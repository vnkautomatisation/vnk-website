"use client";
import { Inbox, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/utils";

type R = {
  id: number;
  title: string;
  description: string;
  serviceType: string | null;
  urgency: string;
  status: string;
  createdAt: Date;
};

export function PortalRequestsList({ requests }: { requests: R[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Mes demandes</h1>
            <p className="text-sm text-muted-foreground">Suivi de vos demandes de projet</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nouvelle demande
        </Button>
      </div>

      <div className="space-y-3">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">Aucune demande pour l&apos;instant</p>
              <Button className="mt-4">
                <Plus className="h-4 w-4" />
                Démarrer un projet
              </Button>
            </CardContent>
          </Card>
        ) : (
          requests.map((r) => (
            <Card key={r.id} className="vnk-card-hover">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={r.urgency} />
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {r.description}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {formatDate(r.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
