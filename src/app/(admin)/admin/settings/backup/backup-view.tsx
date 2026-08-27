"use client";
// Vue Sauvegarde — export/import de la configuration au format JSON.
import { useState, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.backup");
  const tc = useTranslations("common");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [importPayload, setImportPayload] = useState<Record<string, unknown> | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [confirmImport, setConfirmImport] = useState(false);
  const [lastResult, setLastResult] = useState<ImportStats | null>(null);

  const handleExport = () => {

    window.location.href = "/api/admin/config/export";
    toast.success(t("export_cours"));
  };

  const handleFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json.version !== 1) {
        toast.error(t("version_configuration_non_supportee"));
        return;
      }
      setImportPayload(json);
      setConfirmImport(true);
    } catch {
      toast.error(t("fichier_json_invalide"));
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
          toast.success(t("configuration_importee"));
          setLastResult(json.stats);
          setImportPayload(null);
          router.refresh();
        } else {
          toast.error(json.error || t("erreur_import"));
        }
      } catch {
        toast.error(t("erreur_reseau"));
      } finally {
        setConfirmImport(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-cyan-600 shrink-0">
          <Database className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("sauvegarde_restauration")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("exporter_importer_configuration_complete_portail")}
          </p>
        </div>
      </div>


      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">{t("exporter_configuration")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("backup_view_telecharge_un_fichier_json_contenant_tous_les")}<strong>{t("n_apos_inclut_pas")}</strong>{t("backup_view_les_utilisateurs_clients_ou_donnees_metier_factures")}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{t("parametres")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t("roles_custom")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t("postes_custom")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t("catalogues")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t("modeles_emails")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t("modeles_pdf")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t("services")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t("codes_promo")}</Badge>
              </div>
              <Button onClick={handleExport} className="mt-4 bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                <Download className="h-4 w-4 mr-1.5" />
                {t("telecharger_export_json")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Upload className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">{t("importer_configuration")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("charge_fichier_json_exporte_precedemment")}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => setImportMode("merge")}
                  className={`text-left rounded-lg border-2 p-3 transition-colors ${importMode === "merge" ? "border-[#0F2D52] bg-blue-50" : "border-border hover:border-muted-foreground"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="font-semibold text-sm">{t("mode_fusion_recommande")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("met_jour_ajoute_elements_fichier")}
                  </p>
                </button>
                <button
                  onClick={() => setImportMode("replace")}
                  className={`text-left rounded-lg border-2 p-3 transition-colors ${importMode === "replace" ? "border-red-500 bg-red-50" : "border-border hover:border-muted-foreground"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    <p className="font-semibold text-sm">{t("mode_remplacement")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("backup_view_supprime_tous_les_roles_postes_et_catalogues")}<strong>{t("super_admin_uniquement")}</strong>
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
                {t("choisir_fichier_json")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {lastResult && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-emerald-900">{t("import_reussi")}</h3>
                <p className="text-xs text-emerald-800 mt-1 mb-3">{t("elements_traites")}</p>
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


      <Card>
        <CardContent className="p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">{t("conseils_apos_utilisation")}</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>{t("exportez_regulierement_configuration_avant_changements")}</li>
              <li>{t("conservez_exports_emplacement_securise_parametres")}</li>
              <li>{t("mode_fusion_sans_risque_ideal")}</li>
              <li>{t("mode_remplacement_supprime_elements_custom")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmImport}
        onOpenChange={setConfirmImport}
        title={importMode === "replace" ? t("confirmer_remplacement") : t("confirmer_import")}
        description={
          importMode === "replace"
            ? t("operation_supprimera_tous_roles_postes")
            : t("import_ajouter_mettre_jour_elements")
        }
        confirmLabel={importMode === "replace" ? t("remplacer_irreversible") : t("importer")}
        variant={importMode === "replace" ? "destructive" : "default"}
        loading={pending}
        onConfirm={handleConfirmImport}
      />
    </div>
  );
}
