"use client";
// Vue Templates — Emails et PDF avec éditeur visuel + variables.
import { useState } from "react";
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
const EMAIL_TEMPLATE_DEFINITIONS: { key: string; label: string; description: string }[] = [
  { key: "tpl_welcome", label: "Bienvenue client", description: "Premier email après création du compte" },
  { key: "tpl_new_quote", label: "Nouveau devis", description: "Envoi d'un devis au client" },
  { key: "tpl_invoice_sent", label: "Facture envoyée", description: "Facture émise" },
  { key: "tpl_invoice_paid", label: "Facture payée", description: "Confirmation de paiement reçu" },
  { key: "tpl_invoice_reminder", label: "Rappel de facture", description: "Relance avant ou après échéance" },
  { key: "tpl_contract_to_sign", label: "Contrat à signer", description: "Demande de signature électronique" },
  { key: "tpl_contract_signed", label: "Contrat signé", description: "Confirmation après signature" },
  { key: "tpl_appointment_confirmed", label: "RDV confirmé", description: "Confirmation de rendez-vous" },
  { key: "tpl_appointment_reminder", label: "Rappel RDV", description: "Rappel 24h avant" },
  { key: "tpl_password_reset", label: "Réinitialisation mot de passe", description: "Email avec lien de réinit" },
];

const PDF_TEMPLATE_DEFINITIONS: { key: string; label: string; description: string }[] = [
  { key: "pdf_quote", label: "Devis", description: "Template pour les devis exportés" },
  { key: "pdf_invoice", label: "Facture", description: "Template pour les factures émises" },
  { key: "pdf_contract", label: "Contrat", description: "Template pour les contrats" },
  { key: "pdf_receipt", label: "Reçu", description: "Reçu de paiement" },
  { key: "pdf_report", label: "Rapport technique", description: "Rapport de mandat technique" },
];

const COMMON_EMAIL_VARS: Record<string, string> = {
  client_name: "Nom du client",
  client_company: "Entreprise du client",
  invoice_number: "Numéro de facture",
  invoice_amount: "Montant total",
  invoice_due_date: "Date d'échéance",
  quote_number: "Numéro de devis",
  quote_amount: "Montant du devis",
  payment_url: "Lien de paiement",
  signature_url: "Lien de signature",
  appointment_date: "Date du rendez-vous",
  appointment_time: "Heure du rendez-vous",
  company_name: "Nom de l'entreprise",
  company_phone: "Téléphone entreprise",
  company_email: "Courriel entreprise",
  current_year: "Année courante",
};

export function TemplatesView({
  emailTemplates, pdfTemplates,
}: {
  emailTemplates: EmailTemplateRow[];
  pdfTemplates: PdfTemplateRow[];
}) {
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
    if (r.success) { toast.success("Supprimé"); router.refresh(); }
    else toast.error(r.error || "Erreur");
    setConfirmDelete(null);
  };

  const toggleEmailEnabled = async (t: EmailTemplateRow) => {
    const r = await upsertEmailTemplateAction({
      id: t.id, key: t.key, locale: t.locale as "fr" | "en",
      subject: t.subject, bodyHtml: t.bodyHtml, bodyText: t.bodyText,
      variables: t.variables ?? {},
      isEnabled: !t.isEnabled,
    });
    if (r.success) { toast.success(t.isEnabled ? "Désactivé" : "Activé"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  const togglePdfEnabled = async (t: PdfTemplateRow) => {
    const r = await upsertPdfTemplateAction({
      id: t.id, key: t.key, locale: t.locale as "fr" | "en",
      content: t.content as Parameters<typeof upsertPdfTemplateAction>[0]["content"],
      variables: t.variables ?? {},
      isEnabled: !t.isEnabled,
    });
    if (r.success) { toast.success(t.isEnabled ? "Désactivé" : "Activé"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  const handleCreateMissing = (def: { key: string; label: string }) => {
    if (tab === "email") {
      setEmailDialog({ open: true, template: null, defaultKey: def.key, defaultLabel: def.label });
    } else {
      setPdfDialog({ open: true, template: null, defaultKey: def.key, defaultLabel: def.label });
    }
  };

  const existingEmailKeys = new Set(emailTemplates.map((t) => t.key));
  const missingEmailDefs = EMAIL_TEMPLATE_DEFINITIONS.filter((d) => !existingEmailKeys.has(d.key));
  const existingPdfKeys = new Set(pdfTemplates.map((t) => t.key));
  const missingPdfDefs = PDF_TEMPLATE_DEFINITIONS.filter((d) => !existingPdfKeys.has(d.key));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Retour"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-sky-500 shrink-0">
          <FileText className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Modèles</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Courriels transactionnels et documents PDF (factures, devis, contrats)</p>
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

      {/* EMAIL TEMPLATES */}
      {tab === "email" && (
        <div className="space-y-4">
          {/* Existants */}
          {emailTemplates.length > 0 && (
            <Card>
              <div className="divide-y">
                {emailTemplates.map((t) => {
                  const def = EMAIL_TEMPLATE_DEFINITIONS.find((d) => d.key === t.key);
                  return (
                    <div key={t.id} className={cn("flex items-start gap-4 p-4 hover:bg-muted/40", !t.isEnabled && "opacity-60")}>
                      <div className="h-9 w-9 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{def?.label ?? t.key}</p>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.locale}</Badge>
                          {!t.isEnabled && <Badge variant="secondary" className="text-[10px]">Désactivé</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{t.key}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          <span className="font-medium">Objet :</span> {t.subject}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEmailDialog({ open: true, template: t })}><Edit className="h-4 w-4 mr-2" />Modifier</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleEmailEnabled(t)}><Power className="h-4 w-4 mr-2" />{t.isEnabled ? "Désactiver" : "Activer"}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "email", id: t.id, label: def?.label ?? t.key })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Templates système manquants */}
          {missingEmailDefs.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Modèles suggérés à créer ({missingEmailDefs.length})
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
                      <p className="font-medium text-sm">{def.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{def.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bouton créer custom */}
          <Button onClick={() => setEmailDialog({ open: true, template: null })} variant="outline">
            <Plus className="h-4 w-4 mr-1.5" />Créer un modèle personnalisé
          </Button>
        </div>
      )}

      {/* PDF TEMPLATES */}
      {tab === "pdf" && (
        <div className="space-y-4">
          {pdfTemplates.length > 0 && (
            <Card>
              <div className="divide-y">
                {pdfTemplates.map((t) => {
                  const def = PDF_TEMPLATE_DEFINITIONS.find((d) => d.key === t.key);
                  return (
                    <div key={t.id} className={cn("flex items-start gap-4 p-4 hover:bg-muted/40", !t.isEnabled && "opacity-60")}>
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: t.content.accentColor || "#0F2D52" }}>
                        <FileSignature className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{def?.label ?? t.key}</p>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.locale}</Badge>
                          <Badge variant="outline" className="text-[10px]">{t.content.pageSize}</Badge>
                          {!t.isEnabled && <Badge variant="secondary" className="text-[10px]">Désactivé</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{t.key}</p>
                        {def?.description && <p className="text-xs text-muted-foreground mt-1">{def.description}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPdfDialog({ open: true, template: t })}><Edit className="h-4 w-4 mr-2" />Modifier</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => togglePdfEnabled(t)}><Power className="h-4 w-4 mr-2" />{t.isEnabled ? "Désactiver" : "Activer"}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "pdf", id: t.id, label: def?.label ?? t.key })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem>
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
                Modèles suggérés à créer ({missingPdfDefs.length})
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
                      <p className="font-medium text-sm">{def.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{def.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button onClick={() => setPdfDialog({ open: true, template: null })} variant="outline">
            <Plus className="h-4 w-4 mr-1.5" />Créer un modèle personnalisé
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <EmailTemplateDialog
        open={emailDialog.open}
        onOpenChange={(open) => setEmailDialog({ open, template: open ? emailDialog.template : null, defaultKey: open ? emailDialog.defaultKey : undefined, defaultLabel: open ? emailDialog.defaultLabel : undefined })}
        template={emailDialog.template}
        defaultKey={emailDialog.defaultKey}
        defaultLabel={emailDialog.defaultLabel}
        commonVars={COMMON_EMAIL_VARS}
        onSaved={() => router.refresh()}
      />
      <PdfTemplateDialog
        open={pdfDialog.open}
        onOpenChange={(open) => setPdfDialog({ open, template: open ? pdfDialog.template : null, defaultKey: open ? pdfDialog.defaultKey : undefined, defaultLabel: open ? pdfDialog.defaultLabel : undefined })}
        template={pdfDialog.template}
        defaultKey={pdfDialog.defaultKey}
        defaultLabel={pdfDialog.defaultLabel}
        commonVars={COMMON_EMAIL_VARS}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Supprimer ${confirmDelete?.label} ?`}
        description="Cette action est irréversible. Le modèle par défaut sera utilisé à la place."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
