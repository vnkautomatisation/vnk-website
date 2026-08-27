"use client";
// Vue Templates — Emails et PDF avec éditeur visuel + variables.
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText, ChevronLeft, Plus, MoreHorizontal, Edit, Trash2,
  Mail, FileSignature, Power,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmailTemplateDialog } from "./email-template-dialog";
import { PdfTemplateDialog } from "./pdf-template-dialog";
import {
  deleteEmailTemplateAction, deletePdfTemplateAction, upsertEmailTemplateAction, upsertPdfTemplateAction,
} from "@/app/actions/templates";

export type EmailTemplateRow = {
  id: number; key: string; locale: string; subject: string;
  bodyHtml: string; bodyText: string | null;
  variables: Record<string, string> | null;
  isEnabled: boolean; updatedBy: number | null; updatedAt: string;
};
export type PdfTemplateRow = {
  id: number; key: string; locale: string;
  content: {
    headerHtml?: string; bodyHtml: string; footerHtml?: string;
    pageSize: string;
    margins: { top: number; right: number; bottom: number; left: number };
    accentColor: string;
  };
  variables: Record<string, string> | null;
  isEnabled: boolean; updatedAt: string;
};

type Tab = "email" | "pdf";

// Templates système suggérés (créés automatiquement si absents)
const EMAIL_TEMPLATE_DEFINITIONS: { key: string; labelKey: string; descriptionKey: string }[] = [
  { key: "tpl_welcome", labelKey: "tpl_tpl_welcome", descriptionKey: "tpld_tpl_welcome" },
  { key: "tpl_new_quote", labelKey: "tpl_tpl_new_quote", descriptionKey: "tpld_tpl_new_quote" },
  { key: "tpl_invoice_sent", labelKey: "tpl_tpl_invoice_sent", descriptionKey: "tpld_tpl_invoice_sent" },
  { key: "tpl_invoice_paid", labelKey: "tpl_tpl_invoice_paid", descriptionKey: "tpld_tpl_invoice_paid" },
  { key: "tpl_invoice_reminder", labelKey: "tpl_tpl_invoice_reminder", descriptionKey: "tpld_tpl_invoice_reminder" },
  { key: "tpl_contract_to_sign", labelKey: "tpl_tpl_contract_to_sign", descriptionKey: "tpld_tpl_contract_to_sign" },
  { key: "tpl_contract_signed", labelKey: "tpl_tpl_contract_signed", descriptionKey: "tpld_tpl_contract_signed" },
  { key: "tpl_appointment_confirmed", labelKey: "tpl_tpl_appointment_confirmed", descriptionKey: "tpld_tpl_appointment_confirmed" },
  { key: "tpl_appointment_reminder", labelKey: "tpl_tpl_appointment_reminder", descriptionKey: "tpld_tpl_appointment_reminder" },
  { key: "tpl_password_reset", labelKey: "tpl_tpl_password_reset", descriptionKey: "tpld_tpl_password_reset" },
];

const PDF_TEMPLATE_DEFINITIONS: { key: string; labelKey: string; descriptionKey: string }[] = [
  { key: "pdf_quote", labelKey: "tpl_pdf_quote", descriptionKey: "tpld_pdf_quote" },
  { key: "pdf_invoice", labelKey: "tpl_pdf_invoice", descriptionKey: "tpld_pdf_invoice" },
  { key: "pdf_contract", labelKey: "tpl_pdf_contract", descriptionKey: "tpld_pdf_contract" },
  { key: "pdf_receipt", labelKey: "tpl_pdf_receipt", descriptionKey: "tpld_pdf_receipt" },
  { key: "pdf_report", labelKey: "tpl_pdf_report", descriptionKey: "tpld_pdf_report" },
];

// Les cles sont resolues au rendu : ce catalogue vit hors composant.
const COMMON_EMAIL_VAR_KEYS: Record<string, string> = {
  client_name: "var_client_name",
  client_company: "var_client_company",
  invoice_number: "var_invoice_number",
  invoice_amount: "var_invoice_amount",
  invoice_due_date: "var_invoice_due_date",
  quote_number: "var_quote_number",
  quote_amount: "var_quote_amount",
  payment_url: "var_payment_url",
  signature_url: "var_signature_url",
  appointment_date: "var_appointment_date",
  appointment_time: "var_appointment_time",
  company_name: "var_company_name",
  company_phone: "var_company_phone",
  company_email: "var_company_email",
  current_year: "var_current_year",
};

export function TemplatesView({
  emailTemplates, pdfTemplates,
}: {
  emailTemplates: EmailTemplateRow[];
  pdfTemplates: PdfTemplateRow[];
}) {
  const t = useTranslations("admin.email_templates");
  const commonVars = Object.fromEntries(
    Object.entries(COMMON_EMAIL_VAR_KEYS).map(([name, key]) => [name, t(key)]),
  );
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("email");

  const [emailDialog, setEmailDialog] = useState<{ open: boolean; template: EmailTemplateRow | null; defaultKey?: string; defaultLabel?: string }>({ open: false, template: null });
  const [pdfDialog, setPdfDialog] = useState<{ open: boolean; template: PdfTemplateRow | null; defaultKey?: string; defaultLabel?: string }>({ open: false, template: null });
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "email" | "pdf"; id: number; label: string } | null>(null);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const r = confirmDelete.kind === "email"
      ? await deleteEmailTemplateAction({ id: confirmDelete.id })
      : await deletePdfTemplateAction({ id: confirmDelete.id });
    if (r.success) { toast.success(t("supprime")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
    setConfirmDelete(null);
  };

  const toggleEmailEnabled = async (tpl: EmailTemplateRow) => {
    const r = await upsertEmailTemplateAction({
      id: tpl.id, key: tpl.key, locale: tpl.locale as "fr" | "en",
      subject: tpl.subject, bodyHtml: tpl.bodyHtml, bodyText: tpl.bodyText,
      variables: tpl.variables ?? {},
      isEnabled: !tpl.isEnabled,
    });
    if (r.success) { toast.success(tpl.isEnabled ? t("desactive") : t("active")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const togglePdfEnabled = async (tpl: PdfTemplateRow) => {
    const r = await upsertPdfTemplateAction({
      id: tpl.id, key: tpl.key, locale: tpl.locale as "fr" | "en",
      content: tpl.content as Parameters<typeof upsertPdfTemplateAction>[0]["content"],
      variables: tpl.variables ?? {},
      isEnabled: !tpl.isEnabled,
    });
    if (r.success) { toast.success(tpl.isEnabled ? t("desactive") : t("active")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const handleCreateMissing = (def: { key: string; labelKey: string }) => {
    if (tab === "email") {
      setEmailDialog({ open: true, template: null, defaultKey: def.key, defaultLabel: t(def.labelKey) });
    } else {
      setPdfDialog({ open: true, template: null, defaultKey: def.key, defaultLabel: t(def.labelKey) });
    }
  };

  const existingEmailKeys = new Set(emailTemplates.map((t) => t.key));
  const missingEmailDefs = EMAIL_TEMPLATE_DEFINITIONS.filter((d) => !existingEmailKeys.has(d.key));
  const existingPdfKeys = new Set(pdfTemplates.map((t) => t.key));
  const missingPdfDefs = PDF_TEMPLATE_DEFINITIONS.filter((d) => !existingPdfKeys.has(d.key));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-sky-500 shrink-0">
          <FileText className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("modeles")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("courriels_transactionnels_documents_pdf_factures")}</p>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("email")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2",
              tab === "email" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Mail className="h-4 w-4" />Courriels
            <Badge variant="secondary" className="text-[10px] ml-1">{emailTemplates.length}</Badge>
          </button>
          <button
            onClick={() => setTab("pdf")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2",
              tab === "pdf" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <FileSignature className="h-4 w-4" />PDF
            <Badge variant="secondary" className="text-[10px] ml-1">{pdfTemplates.length}</Badge>
          </button>
        </div>
      </div>


      {tab === "email" && (
        <div className="space-y-4">

          {emailTemplates.length > 0 && (
            <Card>
              <div className="divide-y">
                {emailTemplates.map((tpl) => {
                  const def = EMAIL_TEMPLATE_DEFINITIONS.find((d) => d.key === tpl.key);
                  return (
                    <div key={tpl.id} className={cn("flex items-start gap-4 p-4 hover:bg-muted/40", !tpl.isEnabled && "opacity-60")}>
                      <div className="h-9 w-9 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{def ? t(def.labelKey) : tpl.key}</p>
                          <Badge variant="outline" className="text-[10px] uppercase">{tpl.locale}</Badge>
                          {!tpl.isEnabled && <Badge variant="secondary" className="text-[10px]">{tc("disabled")}</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{tpl.key}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          <span className="font-medium">{t("objet")}</span> {tpl.subject}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEmailDialog({ open: true, template: tpl })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleEmailEnabled(tpl)}><Power className="h-4 w-4 mr-2" />{tpl.isEnabled ? t("desactiver") : t("activer")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "email", id: tpl.id, label: def ? t(def.labelKey) : tpl.key })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}


          {missingEmailDefs.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {t("modeles_suggeres_creer", { count: missingEmailDefs.length })}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {missingEmailDefs.map((def) => (
                  <button
                    key={def.key}
                    onClick={() => handleCreateMissing(def)}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card text-left vnk-card-hover"
                  >
                    <div className="h-8 w-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{t(def.labelKey)}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{t(def.descriptionKey)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}


          <Button onClick={() => setEmailDialog({ open: true, template: null })} variant="outline">
            <Plus className="h-4 w-4 mr-1.5" />{t("creer_modele_personnalise")}
          </Button>
        </div>
      )}


      {tab === "pdf" && (
        <div className="space-y-4">
          {pdfTemplates.length > 0 && (
            <Card>
              <div className="divide-y">
                {pdfTemplates.map((tpl) => {
                  const def = PDF_TEMPLATE_DEFINITIONS.find((d) => d.key === tpl.key);
                  return (
                    <div key={tpl.id} className={cn("flex items-start gap-4 p-4 hover:bg-muted/40", !tpl.isEnabled && "opacity-60")}>
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: tpl.content.accentColor || "#0F2D52" }}>
                        <FileSignature className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{def ? t(def.labelKey) : tpl.key}</p>
                          <Badge variant="outline" className="text-[10px] uppercase">{tpl.locale}</Badge>
                          <Badge variant="outline" className="text-[10px]">{tpl.content.pageSize}</Badge>
                          {!tpl.isEnabled && <Badge variant="secondary" className="text-[10px]">{tc("disabled")}</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{tpl.key}</p>
                        {def && <p className="text-xs text-muted-foreground mt-1">{t(def.descriptionKey)}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPdfDialog({ open: true, template: tpl })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => togglePdfEnabled(tpl)}><Power className="h-4 w-4 mr-2" />{tpl.isEnabled ? t("desactiver") : t("activer")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "pdf", id: tpl.id, label: def ? t(def.labelKey) : tpl.key })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {missingPdfDefs.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {t("modeles_suggeres_creer", { count: missingPdfDefs.length })}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {missingPdfDefs.map((def) => (
                  <button
                    key={def.key}
                    onClick={() => handleCreateMissing(def)}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card text-left vnk-card-hover"
                  >
                    <div className="h-8 w-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{t(def.labelKey)}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{t(def.descriptionKey)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button onClick={() => setPdfDialog({ open: true, template: null })} variant="outline">
            <Plus className="h-4 w-4 mr-1.5" />{t("creer_modele_personnalise")}
          </Button>
        </div>
      )}


      <EmailTemplateDialog
        open={emailDialog.open}
        onOpenChange={(open) => setEmailDialog({ open, template: open ? emailDialog.template : null, defaultKey: open ? emailDialog.defaultKey : undefined, defaultLabel: open ? emailDialog.defaultLabel : undefined })}
        template={emailDialog.template}
        defaultKey={emailDialog.defaultKey}
        defaultLabel={emailDialog.defaultLabel}
        commonVars={commonVars}
        onSaved={() => router.refresh()}
      />
      <PdfTemplateDialog
        open={pdfDialog.open}
        onOpenChange={(open) => setPdfDialog({ open, template: open ? pdfDialog.template : null, defaultKey: open ? pdfDialog.defaultKey : undefined, defaultLabel: open ? pdfDialog.defaultLabel : undefined })}
        template={pdfDialog.template}
        defaultKey={pdfDialog.defaultKey}
        defaultLabel={pdfDialog.defaultLabel}
        commonVars={commonVars}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Supprimer ${confirmDelete?.label} ?`}
        description={t("action_irreversible_modele_defaut_sera")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
