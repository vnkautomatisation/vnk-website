"use client";
// Vue Mode démo — active/désactive + génère ou purge data fictive.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FlaskConical, ChevronLeft, Play, Trash2, AlertTriangle,
  Users, FileText, Receipt, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  enableDemoModeAction, disableDemoModeAction, purgeDemoDataAction,
} from "@/app/actions/demo-mode";

export function DemoView({
  enabled, counts, isSuperAdmin,
}: {
  enabled: boolean;
  counts: { clients: number; quotes: number; invoices: number };
  isSuperAdmin: boolean;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const handleEnable = () => {
    startTransition(async () => {
      const r = await enableDemoModeAction();
      if (r.success && "data" in r) {
        toast.success(`Mode démo activé · ${r.data.created.clients} clients, ${r.data.created.quotes} devis, ${r.data.created.invoices} factures`);
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
    });
  };

  const handleDisable = () => {
    startTransition(async () => {
      const r = await disableDemoModeAction();
      if (r.success) { toast.success("Mode démo désactivé"); router.refresh(); }
      else toast.error(r.error || "Erreur");
      setConfirmDisable(false);
    });
  };

  const handlePurge = () => {
    startTransition(async () => {
      const r = await purgeDemoDataAction();
      if (r.success && "data" in r) {
        toast.success(`${r.data.deleted.clients + r.data.deleted.quotes + r.data.deleted.invoices} entrées démo supprimées`);
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
      setConfirmPurge(false);
    });
  };

  const hasDemoData = counts.clients > 0 || counts.quotes > 0 || counts.invoices > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-fuchsia-500 to-violet-500 shrink-0">
          <FlaskConical className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Mode démonstration</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Génère un jeu de données fictives pour les démonstrations et formations
          </p>
        </div>
        {enabled && <Badge className="text-[10px] bg-violet-600 hover:bg-violet-600">{tc("active")}</Badge>}
      </div>

      {/* Statut */}
      <Card className={enabled ? "border-violet-300 bg-violet-50" : ""}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${enabled ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`}>
              {enabled ? <CheckCircle2 className="h-6 w-6" /> : <FlaskConical className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">
                {enabled ? "Mode démo activé" : "Mode démo désactivé"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {enabled
                  ? "Les données démo sont actives. Un bandeau peut être ajouté dans Maintenance pour signaler ce mode."
                  : "Activez pour créer des clients, devis et factures fictifs marqués [DEMO]."}
              </p>
              {!isSuperAdmin && (
                <p className="text-xs text-amber-700 mt-2">Réservé au super-administrateur</p>
              )}
              {isSuperAdmin && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {!enabled ? (
                    <Button onClick={handleEnable} disabled={pending} className="bg-violet-600 hover:bg-violet-700">
                      <Play className="h-4 w-4 mr-1.5" />
                      {pending ? "..." : "Activer le mode démo"}
                    </Button>
                  ) : (
                    <Button onClick={() => setConfirmDisable(true)} variant="outline" disabled={pending}>
                      Désactiver
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques data démo */}
      {hasDemoData && (
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Données démo actuelles</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <Users className="h-4 w-4 text-blue-500 mb-1" />
                <p className="text-xl font-bold">{counts.clients}</p>
                <p className="text-[10px] text-muted-foreground">client{counts.clients > 1 ? "s" : ""} démo</p>
              </div>
              <div className="rounded-lg border p-3">
                <FileText className="h-4 w-4 text-amber-500 mb-1" />
                <p className="text-xl font-bold">{counts.quotes}</p>
                <p className="text-[10px] text-muted-foreground">devis démo</p>
              </div>
              <div className="rounded-lg border p-3">
                <Receipt className="h-4 w-4 text-emerald-500 mb-1" />
                <p className="text-xl font-bold">{counts.invoices}</p>
                <p className="text-[10px] text-muted-foreground">facture{counts.invoices > 1 ? "s" : ""} démo</p>
              </div>
            </div>
            {isSuperAdmin && (
              <Button onClick={() => setConfirmPurge(true)} variant="destructive" size="sm" className="mt-4" disabled={pending}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Supprimer toutes les données démo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Avertissement */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold mb-1">À retenir</p>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li>Toutes les données démo ont un préfixe <code className="bg-white px-1 rounded font-mono">[DEMO]</code> ou <code className="bg-white px-1 rounded font-mono">DEV-DEMO-</code> / <code className="bg-white px-1 rounded font-mono">FAC-DEMO-</code></li>
              <li>Le bouton purge supprime <strong>uniquement</strong> ces entrées, jamais vos données réelles</li>
              <li>Activer plusieurs fois ne duplique pas les données (idempotent)</li>
              <li>Pensez à activer un bandeau d&apos;annonce « Mode démo » dans /admin/settings/maintenance</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title="Désactiver le mode démo ?"
        description="Les données démo existantes ne sont pas supprimées (utilisez le bouton de purge pour ça)."
        confirmLabel="Désactiver"
        variant="default"
        onConfirm={handleDisable}
      />
      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        title="Supprimer toutes les données démo ?"
        description={`${counts.clients} clients, ${counts.quotes} devis et ${counts.invoices} factures seront supprimés définitivement. Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        variant="destructive"
        onConfirm={handlePurge}
      />
    </div>
  );
}
