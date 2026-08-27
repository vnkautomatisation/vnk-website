"use client";
// Vue Charte graphique — upload des 6 logos, palette de couleurs, polices.
// Live preview des éléments d'interface (header, login, email).
import { useState, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Palette, ChevronLeft, Upload, Trash2, Image as ImageIcon,
  Mail, FileText, Type, Save, RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { updateSettingsAction } from "@/app/actions/settings";

type LogoSlot = "primary" | "dark" | "favicon" | "login" | "email" | "pdf";

const LOGO_SLOTS: { key: LogoSlot; labelKey: string; descriptionKey: string; previewBg: string; recommendedKey: string }[] = [
  { key: "primary", labelKey: "logo_principal", descriptionKey: "header_clair_pages_publiques", previewBg: "#ffffff", recommendedKey: "png_svg_240_60" },
  { key: "dark", labelKey: "logo_blanc_inverse", descriptionKey: "header_sombre_footer", previewBg: "#0F2D52", recommendedKey: "png_svg_transparent_240_60" },
  { key: "login", labelKey: "ecran_connexion", descriptionKey: "affiche_admin_login_portail_login", previewBg: "#f8fafc", recommendedKey: "png_svg_jusqu_320_80" },
  { key: "email", labelKey: "entete_courriel", descriptionKey: "templates_emails_transactionnels", previewBg: "#ffffff", recommendedKey: "png_600_120_max" },
  { key: "pdf", labelKey: "entete_pdf", descriptionKey: "factures_devis_contrats", previewBg: "#ffffff", recommendedKey: "png_800_200_max" },
  { key: "favicon", labelKey: "favicon", descriptionKey: "onglet_navigateur_raccourcis", previewBg: "#f8fafc", recommendedKey: "png_carre_512_512_ico" },
];

export function BrandingView({ initial }: { initial: Record<string, string | null> }) {
  const t = useTranslations("admin.branding");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logos, setLogos] = useState<Record<LogoSlot, string | null>>(() => ({
    primary: initial.logo_primary ?? null,
    dark: initial.logo_dark ?? null,
    favicon: initial.logo_favicon ?? null,
    login: initial.logo_login ?? null,
    email: initial.logo_email ?? null,
    pdf: initial.logo_pdf ?? null,
  }));


  const [primaryColor, setPrimaryColor] = useState(initial.color_primary ?? "#0F2D52");
  const [secondaryColor, setSecondaryColor] = useState(initial.color_secondary ?? "#1A5FB4");
  const [accentColor, setAccentColor] = useState(initial.color_accent ?? "#E5A50A");
  const [successColor, setSuccessColor] = useState(initial.color_success ?? "#26A269");
  const [errorColor, setErrorColor] = useState(initial.color_error ?? "#C01C28");


  const [fontHeading, setFontHeading] = useState(initial.font_heading ?? t("inter"));
  const [fontBody, setFontBody] = useState(initial.font_body ?? t("inter"));


  const [customCss, setCustomCss] = useState(initial.custom_css ?? "");

  const [colorsDirty, setColorsDirty] = useState(false);

  const handleColorChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setColorsDirty(true);
  };

  const handleSaveColors = () => {
    startTransition(async () => {
      const result = await updateSettingsAction({
        category: "appearance",
        updates: [
          { key: "color_primary", value: primaryColor },
          { key: "color_secondary", value: secondaryColor },
          { key: "color_accent", value: accentColor },
          { key: "color_success", value: successColor },
          { key: "color_error", value: errorColor },
          { key: "font_heading", value: fontHeading },
          { key: "font_body", value: fontBody },
          { key: "custom_css", value: customCss },
        ],
      });
      if (result.success) {
        toast.success(t("charte_graphique_enregistree"));
        setColorsDirty(false);
        router.refresh();
      } else {
        toast.error(result.error || t("erreur"));
      }
    });
  };

  const handleResetColors = () => {
    setPrimaryColor("#0F2D52");
    setSecondaryColor("#1A5FB4");
    setAccentColor("#E5A50A");
    setSuccessColor("#26A269");
    setErrorColor("#C01C28");
    setColorsDirty(true);
  };

  return (
    <div className="space-y-6">

      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-pink-500 shrink-0">
          <Palette className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("charte_graphique")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("logos_palette_couleurs_typographie_appliques")}
          </p>
        </div>
      </div>


      <section>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">{t("logos")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {LOGO_SLOTS.map((slot) => (
            <LogoSlotCard
              key={slot.key}
              slot={slot}
              currentValue={logos[slot.key]}
              onUploaded={(v) => setLogos((prev) => ({ ...prev, [slot.key]: v }))}
              onDeleted={() => setLogos((prev) => ({ ...prev, [slot.key]: null }))}
            />
          ))}
        </div>
      </section>


      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-[#0F2D52]" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">{t("palette_couleurs")}</h2>
          </div>
          {colorsDirty && (
            <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">{t("modifications_non_enregistrees")}</Badge>
          )}
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <ColorPicker label={t("primaire")} value={primaryColor} onChange={(v) => handleColorChange(setPrimaryColor, v)} />
              <ColorPicker label={t("secondaire")} value={secondaryColor} onChange={(v) => handleColorChange(setSecondaryColor, v)} />
              <ColorPicker label={t("accent")} value={accentColor} onChange={(v) => handleColorChange(setAccentColor, v)} />
              <ColorPicker label={t("succes")} value={successColor} onChange={(v) => handleColorChange(setSuccessColor, v)} />
              <ColorPicker label={t("erreur")} value={errorColor} onChange={(v) => handleColorChange(setErrorColor, v)} />
            </div>


            <div className="mt-5 rounded-lg border overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                {t("apercu")}
              </div>
              <div className="p-4 flex flex-wrap items-center gap-2">
                <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                  {t("bouton_primaire")}
                </button>
                <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: secondaryColor }}>
                  {t("bouton_secondaire")}
                </button>
                <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
                  {t("accent")}
                </button>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: successColor }}>{t("succes")}</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: errorColor }}>{t("erreur")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>


      <section>
        <div className="flex items-center gap-2 mb-3">
          <Type className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">{t("typographie")}</h2>
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("police_titres")}</Label>
                <Input
                  value={fontHeading}
                  onChange={(e) => { setFontHeading(e.target.value); setColorsDirty(true); }}
                  placeholder={t("inter_roboto_plus_jakarta_sans")}
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{t("nom_google_fonts_nom_systeme")}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("police_corps_texte")}</Label>
                <Input
                  value={fontBody}
                  onChange={(e) => { setFontBody(e.target.value); setColorsDirty(true); }}
                  placeholder={t("inter")}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mt-4 rounded-lg border p-4 bg-muted/20">
              <p className="text-2xl font-bold" style={{ fontFamily: fontHeading }}>{t("vnk_automatisation")}</p>
              <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: fontBody }}>
                {t("apercu_typographie_quick_brown_fox")}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>


      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">{t("css_personnalise_avance")}</h2>
        </div>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-2">
              {t("regles_css_appliquees_globalement_apres")}
            </p>
            <textarea
              value={customCss}
              onChange={(e) => { setCustomCss(e.target.value); setColorsDirty(true); }}
              rows={6}
              className="w-full font-mono text-xs rounded-md border border-input bg-background px-3 py-2"
              placeholder=":root { --my-var: red; }"
            />
          </CardContent>
        </Card>
      </section>


      {colorsDirty && (
        <div className="sticky bottom-4 z-30">
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-900 font-medium">{t("modifications_attente")}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleResetColors} disabled={pending}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {t("valeurs_defaut")}
                </Button>
                <Button size="sm" onClick={handleSaveColors} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {pending ? "..." : t("enregistrer")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      <section>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">{t("apercus_contextuels")}</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-2 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                {t("header_site_public")}
              </p>
              <div className="p-4 bg-white">
                <div className="flex items-center justify-between border-b pb-3">
                  {logos.primary ? (

                    <img src={logos.primary} alt="" className="h-10 object-contain" />
                  ) : (
                    <div className="h-10 flex items-center text-sm text-muted-foreground italic">{t("aucun_logo")}</div>
                  )}
                  <div className="flex gap-4 text-sm font-medium text-gray-700">
                    <span>{t("services")}</span>
                    <span>{t("propos")}</span>
                    <span>{t("contact")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-2 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                {t("ecran_connexion")}
              </p>
              <div className="p-6 bg-slate-50 flex flex-col items-center">
                {logos.login ? (

                  <img src={logos.login} alt="" className="h-12 object-contain mb-4" />
                ) : logos.primary ? (

                  <img src={logos.primary} alt="" className="h-10 object-contain mb-4" />
                ) : (
                  <div className="h-12 flex items-center text-sm text-muted-foreground italic mb-4">{t("aucun_logo")}</div>
                )}
                <button className="px-6 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                  {t("se_connecter")}
                </button>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-2 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                <Mail className="h-3 w-3 inline mr-1" />Courriel transactionnel
              </p>
              <div className="bg-white">
                <div className="p-4 border-b" style={{ backgroundColor: primaryColor }}>
                  {logos.email ? (

                    <img src={logos.email} alt="" className="h-8 object-contain" />
                  ) : logos.dark ? (

                    <img src={logos.dark} alt="" className="h-8 object-contain" />
                  ) : (
                    <p className="text-white font-bold">{t("vnk_automatisation")}</p>
                  )}
                </div>
                <div className="p-4 text-sm">
                  <p>{t("bonjour")}</p>
                  <p className="mt-2 text-muted-foreground">{t("apercu_apos_courriel_transactionnel")}</p>
                </div>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-2 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                <FileText className="h-3 w-3 inline mr-1" />{t("branding_view_entete_pdf_facture_devis")}</p>
              <div className="p-5 bg-white">
                <div className="flex items-start justify-between border-b-2 pb-3" style={{ borderColor: primaryColor }}>
                  {logos.pdf ? (

                    <img src={logos.pdf} alt="" className="h-12 object-contain" />
                  ) : logos.primary ? (

                    <img src={logos.primary} alt="" className="h-12 object-contain" />
                  ) : (
                    <div className="h-12 flex items-center text-sm text-muted-foreground italic">{t("aucun_logo")}</div>
                  )}
                  <div className="text-right text-xs">
                    <p className="font-bold text-base" style={{ color: primaryColor }}>FACTURE</p>
                    <p className="text-muted-foreground">{t("fac_2026_001")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// ─── Composants helper ────────────────────────────────────

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      <div className="flex gap-2 mt-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded-md border cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs flex-1"
          placeholder="#0F2D52"
        />
      </div>
    </div>
  );
}

function LogoSlotCard({
  slot, currentValue, onUploaded, onDeleted,
}: {
  slot: { key: LogoSlot; labelKey: string; descriptionKey: string; previewBg: string; recommendedKey: string };
  currentValue: string | null;
  onUploaded: (v: string) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("admin.branding");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slot", slot.key);
      const res = await fetch("/api/admin/branding", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        toast.success(t("logo_televerse", { slot: t(slot.labelKey).toLowerCase() }));
        onUploaded(json.value);
      } else {
        toast.error(json.error || t("erreur"));
      }
    } catch {
      toast.error(t("erreur_reseau"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/admin/branding?slot=${slot.key}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("logo_retire"));
      onDeleted();
    } else {
      toast.error(t("erreur"));
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="font-semibold text-sm">{t(slot.labelKey)}</p>
            <p className="text-[10px] text-muted-foreground">{t(slot.descriptionKey)}</p>
          </div>
          {currentValue && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={handleDelete} title={t("retirer")}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>


        <div
          className="rounded-md border h-24 flex items-center justify-center mb-2 overflow-hidden"
          style={{ backgroundColor: slot.previewBg }}
        >
          {currentValue ? (

            <img src={currentValue} alt={t(slot.labelKey)} className="max-h-20 max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {uploading ? t("televersement_cours") : currentValue ? t("remplacer") : t("televerser")}
        </Button>
        <p className="text-[9px] text-muted-foreground mt-1.5 text-center">{t(slot.recommendedKey)}</p>
      </CardContent>
    </Card>
  );
}
