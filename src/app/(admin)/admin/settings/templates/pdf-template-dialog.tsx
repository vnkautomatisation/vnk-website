"use client";
// Dialog création/édition d'un PdfTemplate avec sections header/body/footer +
// configuration page (taille, marges, couleur d'accent).
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileSignature, Variable, Palette, Ruler, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RichEditor } from "@/components/admin/rich-editor";
import { upsertPdfTemplateAction } from "@/app/actions/templates";
import type { PdfTemplateRow } from "./templates-view";

type Section = "header" | "body" | "footer" | "page" | "vars" | "preview";

export function PdfTemplateDialog({
  open, onOpenChange, template, defaultKey, defaultLabel, commonVars, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PdfTemplateRow | null;
  defaultKey?: string;
  defaultLabel?: string;
  commonVars: Record<string, string>;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.email_templates");
  const tc = useTranslations("common");
  const mode = template ? "edit" : "create";
  const [pending, startTransition] = useTransition();
  const [section, setSection] = useState<Section>("body");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const [key, setKey] = useState("");
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [isEnabled, setIsEnabled] = useState(true);
  const [headerHtml, setHeaderHtml] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [pageSize, setPageSize] = useState<"A4" | "Letter" | "Legal">("A4");
  const [marginTop, setMarginTop] = useState(40);
  const [marginRight, setMarginRight] = useState(40);
  const [marginBottom, setMarginBottom] = useState(40);
  const [marginLeft, setMarginLeft] = useState(40);
  const [accentColor, setAccentColor] = useState("#0F2D52");

  useEffect(() => {
    if (!open) return;
    setSection("body");
    if (template) {
      setKey(template.key); setLocale(template.locale as "fr" | "en");
      setIsEnabled(template.isEnabled);
      const c = template.content;
      setHeaderHtml(c.headerHtml ?? "");
      setBodyHtml(c.bodyHtml ?? "");
      setFooterHtml(c.footerHtml ?? "");
      setPageSize(c.pageSize as "A4" | "Letter" | "Legal");
      setMarginTop(c.margins.top); setMarginRight(c.margins.right);
      setMarginBottom(c.margins.bottom); setMarginLeft(c.margins.left);
      setAccentColor(c.accentColor || "#0F2D52");
    } else {
      setKey(defaultKey ?? "");
      setLocale("fr"); setIsEnabled(true);
      setHeaderHtml('<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid {{accent}};padding-bottom:8px"><img src="{{company_logo}}" style="height:48px" /><div style="text-align:right"><h1 style="color:{{accent}};margin:0">{{document_title}}</h1><p style="margin:4px 0 0;color:#666">{{document_number}}</p></div></div>');
      setBodyHtml('<p>Bonjour {{client_name}},</p>\n<p></p>\n<table style="width:100%;border-collapse:collapse;margin-top:16px">\n  <thead style="background:{{accent}};color:white"><tr><th style="padding:8px;text-align:left">{t("description")}</th><th style="padding:8px;text-align:right">{tc("amount")}</th></tr></thead>\n  <tbody><tr><td style="padding:8px;border-bottom:1px solid #eee">{{item_description}}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee">{{item_amount}}</td></tr></tbody>\n</table>');
      setFooterHtml('<p style="text-align:center;color:#666;font-size:10px">{{company_name}} · {{company_phone}} · {{company_email}} · © {{current_year}}</p>');
      setPageSize("A4"); setMarginTop(40); setMarginRight(40);
      setMarginBottom(40); setMarginLeft(40); setAccentColor("#0F2D52");
    }
  }, [open, template, defaultKey]);

  const handleSave = () => {
    startTransition(async () => {
      const r = await upsertPdfTemplateAction({
        ...(template?.id ? { id: template.id } : {}),
        key, locale,
        content: {
          headerHtml: headerHtml || undefined,
          bodyHtml,
          footerHtml: footerHtml || undefined,
          pageSize,
          margins: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
          accentColor,
        },
        variables: commonVars,
        isEnabled,
      });
      if (r.success) {
        toast.success(t("modele_pdf_enregistre"));
        onSaved(); onOpenChange(false);
      } else {
        toast.error(r.error);
      }
    });
  };

  const insertVar = (v: string) => {
    if (section === "header") setHeaderHtml((h) => h + `{{${v}}}`);
    else if (section === "footer") setFooterHtml((h) => h + `{{${v}}}`);
    else setBodyHtml((h) => h + `{{${v}}}`);
  };


  useEffect(() => {
    if (section !== "preview" || !open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/templates/pdf/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headerHtml, bodyHtml, footerHtml,
            pageSize, accentColor,
            margins: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
            variables: commonVars,
          }),
        });
        if (!res.ok) {
          toast.error(t("erreur_previsualisation"));
          return;
        }
        const html = await res.text();
        if (cancelled) return;
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        if (!cancelled) toast.error(t("erreur_reseau"));
      }
    })();
    return () => { cancelled = true; };
  }, [section, open, headerHtml, bodyHtml, footerHtml, pageSize, accentColor, marginTop, marginRight, marginBottom, marginLeft, commonVars]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor }}>
            <FileSignature className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-white text-base">
              {defaultLabel ?? (mode === "create" ? t("nouveau_modele_pdf") : template?.key)}
            </DialogTitle>
            <p className="text-xs text-white/70">{t("document_pdf_sections_tete_corps")}</p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} aria-label={tc("enabled")} />
        </div>


        <div className="border-b bg-muted/30 px-6 py-3 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("cle")}</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, "_"))} disabled={mode === "edit"} className="mt-1 font-mono text-sm h-8" />
          </div>
          <div className="w-32">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("langue")}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as "fr" | "en")}>
              <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">{t("francais")}</SelectItem>
                <SelectItem value="en">{t("english")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>


        <div className="border-b px-6">
          <div className="flex gap-1 overflow-x-auto">
            {(["header", "body", "footer", "page", "vars", "preview"] as Section[]).map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${section === s ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}
              >
                {s === "header" && t("tete")}
                {s === "body" && t("corps")}
                {s === "footer" && t("pied_page")}
                {s === "page" && (<><Ruler className="h-3.5 w-3.5 inline mr-1" />{t("format")}</>)}
                {s === "vars" && (<><Variable className="h-3.5 w-3.5 inline mr-1" />{t("variables")}</>)}
                {s === "preview" && (<><Eye className="h-3.5 w-3.5 inline mr-1" />{t("apercu")}</>)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {section === "header" && (
            <RichEditor value={headerHtml} onChange={setHeaderHtml} rows={10} placeholder={t("html_pour_en_tete")} />
          )}
          {section === "body" && (
            <RichEditor value={bodyHtml} onChange={setBodyHtml} rows={16} placeholder={t("html_corps_principal")} />
          )}
          {section === "footer" && (
            <RichEditor value={footerHtml} onChange={setFooterHtml} rows={6} placeholder={t("html_pied_page_mentions_legales")} />
          )}

          {section === "page" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("format_papier")}</Label>
                  <Select value={pageSize} onValueChange={(v) => setPageSize(v as "A4" | "Letter" | "Legal")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">{t("a4_210_297_mm")}</SelectItem>
                      <SelectItem value="Letter">{t("letter_8_5_11_po")}</SelectItem>
                      <SelectItem value="Legal">{t("legal_8_5_14_po")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <Palette className="h-3 w-3 inline mr-1" />{t("pdf_template_dialog_couleur_d_accent")}</Label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-12 rounded-md border cursor-pointer" />
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="font-mono text-xs flex-1" />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("marges_pixels")}</Label>
                <div className="grid grid-cols-4 gap-2 mt-1.5">
                  {[
                    { label: t("haut"), value: marginTop, set: setMarginTop },
                    { label: t("droite"), value: marginRight, set: setMarginRight },
                    { label: t("bas"), value: marginBottom, set: setMarginBottom },
                    { label: t("gauche"), value: marginLeft, set: setMarginLeft },
                  ].map((m) => (
                    <div key={m.label}>
                      <Label className="text-[9px] text-muted-foreground">{m.label}</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={m.value}
                        onChange={(e) => m.set(Number(e.target.value))}
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === "preview" && (
            <div className="space-y-2">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900">
                <Eye className="h-3.5 w-3.5 inline mr-1.5" />{t("pdf_template_dialog_apercu_html_a_l_echelle_96_dpi")}</div>
              <iframe
                src={previewUrl}
                sandbox="allow-same-origin"
                className="w-full h-[600px] rounded-md border bg-muted"
                title={t("apercu_pdf")}
              />
            </div>
          )}

          {section === "vars" && (
            <>
              <p className="text-xs text-muted-foreground">
                {t("cliquez_inserer_variable_section_editee")} <code className="bg-muted px-1 rounded">{`{{accent}}`}</code> {t("pour_couleur")} <code className="bg-muted px-1 rounded">{`{{company_logo}}`}</code> {t("pour_logo")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(commonVars).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => insertVar(k)}
                    className="flex items-center justify-between p-2.5 rounded-md border bg-card hover:bg-muted/40 text-left"
                  >
                    <div>
                      <code className="text-xs font-mono font-semibold text-[#0F2D52]">{`{{${k}}}`}</code>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{t("inserer")}</Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={handleSave} disabled={pending || !key.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : t("enregistrer")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
