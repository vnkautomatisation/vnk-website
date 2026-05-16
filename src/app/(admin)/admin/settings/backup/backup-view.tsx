"use client";
// Vue Sauvegarde — export/import de la configuration au format JSON.
import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Database, ChevronLeft, Download, Upload, FileJson,
  AlertTriangle, CheckCircle2, ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ImportStats = {
  settings: number; roles: number; positions: number;
  catalogItems: number; emailTemplates: number; pdfTemplates: number;
  services: number; promos: number;
};

export function BackupView() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [importPayload, setImportPayload] = useState<Record<string, unknown> | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [confirmImport, setConfirmImport] = useState(false);
  const [lastResult, setLastResult] = useState<ImportStats | null>(null);

  const handleExport = () => {
    // Le browser télécharge directement depuis l'endpoint
    window.location.href = "/api/admin/config/export";
    toast.success("Export en cours...");
  };

  const handleFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json.version !== 1) {
        toast.error("Version de configuration non supportée");
        return;
      }
      setImportPayload(json);
      setConfirmImport(true);
    } catch {
      toast.error("Fichier JSON invalide");
    }
  };

  const handleConfirmImport = () => {
    if (!importPayload) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/config/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: importPayload, mode: importMode }),
        });
        const json = await res.json();
        if (res.ok) {
          toast.success("Configuration importée");
          setLastResult(json.stats);
          setImportPayload(null);
          router.refresh();
        } else {
          toast.error(json.error || "Erreur d'import");
        }
      } catch {
        toast.error("Erreur réseau");
      } finally {
        setConfirmImport(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Retour"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-cyan-600 shrink-0">
          <Database className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Sauvegarde & Restauration</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Exporter ou importer la configuration complète du portail au format JSON
          </p>
        </div>
      </div>

      {/* EXPORT */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Exporter la configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Télécharge un fichier JSON contenant tous les paramètres, rôles custom, postes, catalogues, modèles emails/PDF, services et codes promo. <strong>N&apos;inclut pas</strong> les utilisateurs, clients ou données métier (factures, devis...).
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge variant="outline" className="text-[10px]">Paramètres</Badge>
                <Badge variant="outline" className="text-[10px]">Rôles custom</Badge>
                <Badge variant="outline" className="text-[10px]">Postes custom</Badge>
                <Badge variant="outline" className="text-[10px]">Catalogues</Badge>
                <Badge variant="outline" className="text-[10px]">Modèles emails</Badge>
                <Badge variant="outline" className="text-[10px]">Modèles PDF</Badge>
                <Badge variant="outline" className="text-[10px]">Services</Badge>
                <Badge variant="outline" className="text-[10px]">Codes promo</Badge>
              </div>
              <Button onClick={handleExport} className="mt-4 bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                <Download className="h-4 w-4 mr-1.5" />
                Télécharger l&apos;export JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IMPORT */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Upload className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Importer une configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Charge un fichier JSON exporté précédemment. Choisissez le mode avant de téléverser le fichier.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => setImportMode("merge")}
                  className={`text-left rounded-lg border-2 p-3 transition-colors ${importMode === "merge" ? "border-[#0F2D52] bg-blue-50" : "border-border hover:border-muted-foreground"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="font-semibold text-sm">Mode fusion (recommandé)</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Met à jour ou ajoute les éléments du fichier. Les éléments existants non listés sont conservés.
                  </p>
                </button>
                <button
                  onClick={() => setImportMode("replace")}
                  className={`text-left rounded-lg border-2 p-3 transition-colors ${importMode === "replace" ? "border-red-500 bg-red-50" : "border-border hover:border-muted-foreground"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    <p className="font-semibold text-sm">Mode remplacement</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supprime tous les rôles, postes et catalogues custom existants avant l&apos;import. <strong>Super-admin uniquement.</strong>
                  </p>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = "";
                }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={pending}
                variant={importMode === "replace" ? "destructive" : "default"}
                className={importMode === "merge" ? "mt-4 bg-[#0F2D52] hover:bg-[#0F2D52]/90" : "mt-4"}
              >
                <FileJson className="h-4 w-4 mr-1.5" />
                Choisir un fichier JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RÉSULTAT */}
      {lastResult && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-emerald-900">Import réussi</h3>
                <p className="text-xs text-emerald-800 mt-1 mb-3">Éléments traités :</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(lastResult).map(([key, count]) => (
                    <div key={key} className="bg-white rounded-md border border-emerald-200 px-2.5 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{key}</p>
                      <p className="text-sm font-bold">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* INFO BOX */}
      <Card>
        <CardContent className="p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">Conseils d&apos;utilisation</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Exportez régulièrement votre configuration avant des changements majeurs</li>
              <li>Conservez les exports dans un emplacement sécurisé (les paramètres incluent des clés API marquées comme secrètes)</li>
              <li>Le mode fusion est sans risque, idéal pour synchroniser plusieurs environnements</li>
              <li>Le mode remplacement supprime les éléments custom : utilisez-le uniquement pour des resets propres</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmImport}
        onOpenChange={setConfirmImport}
        title={importMode === "replace" ? "Confirmer le remplacement ?" : "Confirmer l'import ?"}
        description={
          importMode === "replace"
            ? "Cette opération supprimera TOUS les rôles, postes et catalogues custom existants avant d'importer ceux du fichier. Les éléments système restent intacts. Cette action est irréversible."
            : "L'import va ajouter ou mettre à jour les éléments présents dans le fichier. Les éléments existants non listés restent inchangés."
        }
        confirmLabel={importMode === "replace" ? "Remplacer (irréversible)" : "Importer"}
        variant={importMode === "replace" ? "destructive" : "default"}
        loading={pending}
        onConfirm={handleConfirmImport}
      />
    </div>
  );
}
