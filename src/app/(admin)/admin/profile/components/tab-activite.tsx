"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/admin/activity-timeline";
import { History } from "lucide-react";

type AuditEvent = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  changes: unknown;
  ipAddress: string | null;
  createdAt: string;
};

export function TabActivite({
  auditLogs,
}: {
  auditLogs: AuditEvent[];
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Historique d&apos;activite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityTimeline
          events={auditLogs.map((log) => ({
            id: log.id,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            changes: log.changes,
            ipAddress: log.ipAddress,
            createdAt: log.createdAt,
          }))}
        />
      </CardContent>
    </Card>
  );
}
