"use client";
import { FolderOpen, FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type D = {
  id: number;
  title: string;
  description: string | null;
  fileType: string | null;
  category: string | null;
  fileUrl: string | null;
  isRead: boolean;
  createdAt: Date;
};

export function PortalDocumentsList({ documents }: { documents: D[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FolderOpen className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Mes documents</h1>
          <p className="text-sm text-muted-foreground">
            Rapports, livrables et documentation
          </p>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold">Aucun document disponible pour l&apos;instant</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les rapports et livrables apparaîtront ici une fois votre mandat démarré.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((d) => (
            <Card key={d.id} className="vnk-card-hover">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{d.title}</p>
                    {d.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {d.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      {d.category && <Badge variant="secondary" className="text-[9px]">{d.category}</Badge>}
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {d.fileType ?? "pdf"}
                      </Badge>
                      {!d.isRead && <Badge variant="info" className="text-[9px]">Nouveau</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(d.createdAt)}
                  </p>
                  <Button size="sm" variant="outline">
                    <Download className="h-3 w-3" />
                    Télécharger
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
