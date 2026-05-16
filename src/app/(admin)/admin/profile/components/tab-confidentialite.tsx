"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  ShieldCheck, Download, Trash2, FileJson, AlertTriangle, MapPin, Cookie, Mail, BarChart3,
} from "lucide-react";
import {
  requestDataExportAction, requestAccountDeletionAction, updateNotificationPrefsAction,
} from "@/app/actions/profile";
import type { AdminProfile } from "../profile-view";

export function TabConfidentialite({ admin }: { admin: AdminProfile }) {
  const t = useTranslations("admin.profile.privacy");
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePending, startDelete] = useTransition();
  const [marketingOptIn, setMarketingOptIn] = useState(admin.marketingOptIn);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(admin.analyticsOptIn);
  const [prefsPending, startPrefs] = useTransition();

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/profile/data-export");
      if (!res.ok) {
        toast.error("Erreur lors de la generation de l'export");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "vnk-export-loi25.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export telecharge");
      await requestDataExportAction();
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteRequest = () => {
    if (deleteConfirm !== admin.email) {
      toast.error("Le courriel ne correspond pas");
      return;
    }
    startDelete(async () => {
      const r = await requestAccountDeletionAction(deleteConfirm);
      if (r.success) {
        toast.success("Demande enregistree. Un super-administrateur va vous contacter.");
        setDeleteOpen(false);
        setDeleteConfirm("");
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleSaveConsent = (kind: "marketing" | "analytics", value: boolean) => {
    startPrefs(async () => {
      if (kind === "marketing") setMarketingOptIn(value);
      else setAnalyticsOptIn(value);
      // On reutilise notif-prefs pour stocker consents minimaux
      const r = await updateNotificationPrefsAction({});
      if (!r.success) toast.error("Erreur");
    });
  };

  const exportRequested = admin.dataExportRequestedAt
    ? new Date(admin.dataExportRequestedAt).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" })
    : null;

  return (
    <div className="space-y-4">
      {/* ── Bandeau Loi 25 ───────────────────────────── */}
      <Card className="border-[#0F2D52]/20 bg-gradient-to-br from-[#0F2D52]/5 to-transparent">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-[#0F2D52] text-white flex-shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#0F2D52]">{t("law25_title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("law25_text")}</p>
          </div>
          <Badge variant="outline" className="self-start sm:self-center">Loi 25</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Export ──────────────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t("export_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("export_text")}</p>
            {exportRequested && (
              <div className="text-[11px] bg-muted rounded-md p-2.5">
                {t("export_last", { date: exportRequested })}
              </div>
            )}
            <Button onClick={handleExportJson} disabled={exporting} size="sm">
              <FileJson className="h-3.5 w-3.5" />
              {exporting ? "…" : t("export_button")}
            </Button>
          </CardContent>
        </Card>

        {/* ── Hebergement ─────────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("hosting_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b">
              <span className="text-muted-foreground">{t("hosting_region")}</span>
              <Badge variant="secondary">Amérique du Nord</Badge>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b">
              <span className="text-muted-foreground">{t("hosting_database")}</span>
              <Badge variant="secondary">Chiffrée</Badge>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b">
              <span className="text-muted-foreground">{t("hosting_storage")}</span>
              <Badge variant="secondary">Dropbox</Badge>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">{t("hosting_payments")}</span>
              <Badge variant="secondary">Stripe</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground pt-2">{t("hosting_partners")}</p>
          </CardContent>
        </Card>

        {/* ── Consentements ─────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Cookie className="h-4 w-4" />
              {t("consents_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> {t("analytics_title")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("analytics_text")}</p>
              </div>
              <Switch checked={analyticsOptIn} onCheckedChange={(v) => handleSaveConsent("analytics", v)} disabled={prefsPending} />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {t("marketing_title")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("marketing_text")}</p>
              </div>
              <Switch checked={marketingOptIn} onCheckedChange={(v) => handleSaveConsent("marketing", v)} disabled={prefsPending} />
            </div>
            <p className="text-[10px] text-muted-foreground pt-2 border-t">{t("consents_footer")}</p>
          </CardContent>
        </Card>

        {/* ── Suppression ─────────────────────────── */}
        <Card className="border-red-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <Trash2 className="h-4 w-4" />
              {t("delete_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("delete_text")}</p>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{t("delete_warning")}</p>
                <p>{t("delete_warning_text")}</p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              {t("delete_button")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-red-600 text-white p-5">
            <DialogTitle className="text-white flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> {t("delete_modal_title")}</DialogTitle>
            <DialogDescription className="text-white/85 text-sm mt-1">
              {t("delete_modal_description")}
            </DialogDescription>
          </div>
          <div className="p-5 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confirm-email" className="text-xs">{t("delete_modal_email_label", { email: admin.email })}</Label>
              <Input id="confirm-email" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={admin.email} />
            </div>
            <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground">
              {t("delete_modal_footer")}
            </div>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteRequest} disabled={deletePending || deleteConfirm !== admin.email}>
              {deletePending ? "…" : t("send_request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
