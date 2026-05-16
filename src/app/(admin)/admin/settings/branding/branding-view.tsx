"use client";
// Vue Charte graphique — upload des 6 logos, palette de couleurs, polices.
// Live preview des éléments d'interface (header, login, email).
import { useState, useRef, useTransition } from "react";
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

const LOGO_SLOTS: { key: LogoSlot; label: string; description: string; previewBg: string; recommended: string }[] = [
  { key: "primary", label: "Logo principal", description: "Header clair · pages publiques", previewBg: "#ffffff", recommended: "PNG ou SVG · 240×60 px" },
  { key: "dark", label: "Logo blanc / inversé", description: "Header sombre · footer", previewBg: "#0F2D52", recommended: "PNG ou SVG transparent · 240×60 px" },
  { key: "login", label: "Écran de connexion", description: "Affiché sur /admin/login et /portail/login", previewBg: "#f8fafc", recommended: "PNG ou SVG · jusqu'à 320×80 px" },
  { key: "email", label: "Entête courriel", description: "Templates emails transactionnels", previewBg: "#ffffff", recommended: "PNG · 600×120 px max" },
  { key: "pdf", label: "Entête PDF", description: "Factures, devis, contrats", previewBg: "#ffffff", recommended: "PNG · 800×200 px max" },
  { key: "favicon", label: "Favicon", description: "Onglet navigateur · raccourcis", previewBg: "#f8fafc", recommended: "PNG carré 512×512 px ou ICO" },
];

export function BrandingView({ initial }: { initial: Record<string, string | null> }) {
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

  // Couleurs
  const [primaryColor, setPrimaryColor] = useState(initial.color_primary ?? "#0F2D52");
  const [secondaryColor, setSecondaryColor] = useState(initial.color_secondary ?? "#1A5FB4");
  const [accentColor, setAccentColor] = useState(initial.color_accent ?? "#E5A50A");
  const [successColor, setSuccessColor] = useState(initial.color_success ?? "#26A269");
  const [errorColor, setErrorColor] = useState(initial.color_error ?? "#C01C28");

  // Polices
  const [fontHeading, setFontHeading] = useState(initial.font_heading ?? "Inter");
  const [fontBody, setFontBody] = useState(initial.font_body ?? "Inter");

  // CSS custom
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
        toast.success("Charte graphique enregistrée");
        setColorsDirty(false);
        router.refresh();
      } else {
        toast.error(result.error || "Erreur");
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
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Retour">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-pink-500 shrink-0">
          <Palette className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Charte graphique</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Logos, palette de couleurs et typographie — appliqués partout sur le portail
          </p>
        </div>
      </div>

      {/* LOGOS */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">Logos</h2>
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

      {/* COULEURS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-[#0F2D52]" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">Palette de couleurs</h2>
          </div>
          {colorsDirty && (
            <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">Modifications non enregistrées</Badge>
          )}
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <ColorPicker label="Primaire" value={primaryColor} onChange={(v) => handleColorChange(setPrimaryColor, v)} />
              <ColorPicker label="Secondaire" value={secondaryColor} onChange={(v) => handleColorChange(setSecondaryColor, v)} />
              <ColorPicker label="Accent" value={accentColor} onChange={(v) => handleColorChange(setAccentColor, v)} />
              <ColorPicker label="Succès" value={successColor} onChange={(v) => handleColorChange(setSuccessColor, v)} />
              <ColorPicker label="Erreur" value={errorColor} onChange={(v) => handleColorChange(setErrorColor, v)} />
            </div>

            {/* Preview */}
            <div className="mt-5 rounded-lg border overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                Aperçu
              </div>
              <div className="p-4 flex flex-wrap items-center gap-2">
                <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                  Bouton primaire
                </button>
                <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: secondaryColor }}>
                  Bouton secondaire
                </button>
                <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
                  Accent
                </button>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: successColor }}>Succès</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: errorColor }}>Erreur</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* POLICES */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Type className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">Typographie</h2>
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Police titres</Label>
                <Input
                  value={fontHeading}
                  onChange={(e) => { setFontHeading(e.target.value); setColorsDirty(true); }}
                  placeholder="Inter, Roboto, Plus Jakarta Sans..."
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Nom Google Fonts ou nom système</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Police corps de texte</Label>
                <Input
                  value={fontBody}
                  onChange={(e) => { setFontBody(e.target.value); setColorsDirty(true); }}
                  placeholder="Inter"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mt-4 rounded-lg border p-4 bg-muted/20">
              <p className="text-2xl font-bold" style={{ fontFamily: fontHeading }}>VNK Automatisation</p>
              <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: fontBody }}>
                Aperçu de la typographie · le quick brown fox jumps over the lazy dog
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CSS CUSTOM */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">CSS personnalisé (avancé)</h2>
        </div>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-2">
              Règles CSS appliquées globalement après la feuille de styles principale. À utiliser avec précaution.
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

      {/* Sticky save bar */}
      {colorsDirty && (
        <div className="sticky bottom-4 z-30">
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-900 font-medium">Modifications en attente</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleResetColors} disabled={pending}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Valeurs par défaut
                </Button>
                <Button size="sm" onClick={handleSaveColors} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {pending ? "..." : "Enregistrer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aperçus contextuels */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="h-4 w-4 text-[#0F2D52]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">Aperçus contextuels</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Aperçu Header */}
          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-2 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                Header — site public
              </p>
              <div className="p-4 bg-white">
                <div className="flex items-center justify-between border-b pb-3">
                  {logos.primary ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logos.primary} alt="" className="h-10 object-contain" />
                  ) : (
                    <div className="h-10 flex items-center text-sm text-muted-foreground italic">Aucun logo</div>
                  )}
                  <div className="flex gap-4 text-sm font-medium text-gray-700">
                    <span>Services</span>
                    <span>À propos</span>
                    <span>Contact</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aperçu Login */}
          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-2 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                Écran de connexion
              </p>
              <div className="p-6 bg-slate-50 flex flex-col items-center">
                {logos.login ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logos.login} alt="" className="h-12 object-contain mb-4" />
                ) : logos.primary ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logos.primary} alt="" className="h-10 object-contain mb-4" />
                ) : (
                  <div className="h-12 flex items-center text-sm text-muted-foreground italic mb-4">Aucun logo</div>
                )}
                <button className="px-6 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                  Se connecter
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Aperçu Email */}
          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-2 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                <Mail className="h-3 w-3 inline mr-1" />Courriel transactionnel
              </p>
              <div className="bg-white">
                <div className="p-4 border-b" style={{ backgroundColor: primaryColor }}>
                  {logos.email ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logos.email} alt="" className="h-8 object-contain" />
                  ) : logos.dark ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logos.dark} alt="" className="h-8 object-contain" />
                  ) : (
                    <p className="text-white font-bold">VNK Automatisation</p>
                  )}
                </div>
                <div className="p-4 text-sm">
                  <p>Bonjour,</p>
                  <p className="mt-2 text-muted-foreground">Aperçu d&apos;un courriel transactionnel...</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aperçu PDF */}
          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-2 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                <FileText className="h-3 w-3 inline mr-1" />Entête PDF (facture, devis)
              </p>
              <div className="p-5 bg-white">
                <div className="flex items-start justify-between border-b-2 pb-3" style={{ borderColor: primaryColor }}>
                  {logos.pdf ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logos.pdf} alt="" className="h-12 object-contain" />
                  ) : logos.primary ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logos.primary} alt="" className="h-12 object-contain" />
                  ) : (
                    <div className="h-12 flex items-center text-sm text-muted-foreground italic">Aucun logo</div>
                  )}
                  <div className="text-right text-xs">
                    <p className="font-bold text-base" style={{ color: primaryColor }}>FACTURE</p>
                    <p className="text-muted-foreground">FAC-2026-001</p>
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
  slot: { key: LogoSlot; label: string; description: string; previewBg: string; recommended: string };
  currentValue: string | null;
  onUploaded: (v: string) => void;
  onDeleted: () => void;
}) {
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
        toast.success(`Logo ${slot.label.toLowerCase()} téléversé`);
        onUploaded(json.value);
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/admin/branding?slot=${slot.key}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Logo retiré");
      onDeleted();
    } else {
      toast.error("Erreur");
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="font-semibold text-sm">{slot.label}</p>
            <p className="text-[10px] text-muted-foreground">{slot.description}</p>
          </div>
          {currentValue && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={handleDelete} title="Retirer">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Preview */}
        <div
          className="rounded-md border h-24 flex items-center justify-center mb-2 overflow-hidden"
          style={{ backgroundColor: slot.previewBg }}
        >
          {currentValue ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentValue} alt={slot.label} className="max-h-20 max-w-full object-contain" />
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
          {uploading ? "Téléversement..." : currentValue ? "Remplacer" : "Téléverser"}
        </Button>
        <p className="text-[9px] text-muted-foreground mt-1.5 text-center">{slot.recommended}</p>
      </CardContent>
    </Card>
  );
}
