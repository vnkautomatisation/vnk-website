"use client";
// Vue Finance · Fiscalité · Loi 25 — paramètres regroupés en sections.
// Utilise updateSettingsAction (catégorie par catégorie).
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Wallet, ChevronLeft, Building2, Receipt, FileWarning,
  Shield, Save, RotateCcw, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { updateSettingsAction } from "@/app/actions/settings";

type Section = "bank" | "fiscal" | "taxes" | "invoice" | "law25";

const PROVINCES = [
  { code: "QC", name: "Québec", taxes: [
    { name: "TPS/GST", rate: 5, code: "gst" },
    { name: "TVQ/QST", rate: 9.975, code: "qst" },
  ] },
  { code: "ON", name: "Ontario", taxes: [{ name: "TVH/HST", rate: 13, code: "hst" }] },
  { code: "NB", name: "Nouveau-Brunswick", taxes: [{ name: "TVH/HST", rate: 15, code: "hst" }] },
  { code: "NS", name: "Nouvelle-Écosse", taxes: [{ name: "TVH/HST", rate: 15, code: "hst" }] },
  { code: "PE", name: "Île-du-Prince-Édouard", taxes: [{ name: "TVH/HST", rate: 15, code: "hst" }] },
  { code: "NL", name: "Terre-Neuve-et-Labrador", taxes: [{ name: "TVH/HST", rate: 15, code: "hst" }] },
  { code: "AB", name: "Alberta", taxes: [{ name: "TPS/GST", rate: 5, code: "gst" }] },
  { code: "BC", name: "Colombie-Britannique", taxes: [
    { name: "TPS/GST", rate: 5, code: "gst" },
    { name: "TVP/PST", rate: 7, code: "pst" },
  ] },
  { code: "SK", name: "Saskatchewan", taxes: [
    { name: "TPS/GST", rate: 5, code: "gst" },
    { name: "TVP/PST", rate: 6, code: "pst" },
  ] },
  { code: "MB", name: "Manitoba", taxes: [
    { name: "TPS/GST", rate: 5, code: "gst" },
    { name: "TVP/PST", rate: 7, code: "pst" },
  ] },
];

export function FinanceView({ initial }: { initial: Record<string, string> }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [section, setSection] = useState<Section>("bank");
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const set = (key: string, val: string) => {
    setValues((p) => ({ ...p, [key]: val }));
    setDirty((p) => new Set(p).add(key.split(".")[0]));
  };
  const v = (key: string) => values[key] ?? "";

  const handleSave = () => {
    startTransition(async () => {
      // Grouper les updates par catégorie
      const groups: Record<string, { key: string; value: string }[]> = {};
      for (const fullKey of Object.keys(values)) {
        const [category, ...rest] = fullKey.split(".");
        const key = rest.join(".");
        if (!groups[category]) groups[category] = [];
        groups[category].push({ key, value: values[fullKey] });
      }
      for (const [category, updates] of Object.entries(groups)) {
        if (updates.length === 0) continue;
        await updateSettingsAction({ category, updates });
      }
      toast.success("Paramètres enregistrés");
      setDirty(new Set());
      router.refresh();
    });
  };

  const handleDiscard = () => {
    setValues(initial);
    setDirty(new Set());
  };

  const isDirty = dirty.size > 0;

  const SECTIONS: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "bank", label: "Banque & Paiements", icon: Building2 },
    { key: "fiscal", label: "Identifiants fiscaux", icon: Receipt },
    { key: "taxes", label: "Taux de taxes", icon: Receipt },
    { key: "invoice", label: "Facturation & mentions", icon: FileWarning },
    { key: "law25", label: "Loi 25 · Confidentialité", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-emerald-500 shrink-0">
          <Wallet className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Finance & Fiscalité</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Banque, taxes, mentions légales et conformité Loi 25
          </p>
        </div>
      </div>

      {/* Sections tabs */}
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap",
                  active ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />{s.label}
                {dirty.has(s.key === "law25" ? "legal" : s.key === "invoice" ? "billing" : s.key === "taxes" ? "fiscal" : s.key) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* BANQUE & PAIEMENTS */}
      {section === "bank" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <Section icon={Building2} title="Compte bancaire principal">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Nom de l'institution">
                  <Input value={v("finance.bank_name")} onChange={(e) => set("finance.bank_name", e.target.value)} placeholder="Desjardins / RBC / TD..." />
                </Field>
                <Field label="N° institution (3 chiffres)">
                  <Input value={v("finance.bank_institution")} onChange={(e) => set("finance.bank_institution", e.target.value)} maxLength={3} placeholder="815" className="font-mono" />
                </Field>
                <Field label="N° transit (5 chiffres)">
                  <Input value={v("finance.bank_transit")} onChange={(e) => set("finance.bank_transit", e.target.value)} maxLength={5} placeholder="30000" className="font-mono" />
                </Field>
                <Field label="N° folio (7-12 chiffres)">
                  <Input value={v("finance.bank_account")} onChange={(e) => set("finance.bank_account", e.target.value)} maxLength={12} placeholder="1234567" className="font-mono" />
                </Field>
                <Field label="Devise du compte">
                  <Select value={v("finance.bank_currency") || "CAD"} onValueChange={(val) => set("finance.bank_currency", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAD">CAD — Dollar canadien</SelectItem>
                      <SelectItem value="USD">USD — Dollar américain</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Type de compte">
                  <Select value={v("finance.bank_account_type") || "checking"} onValueChange={(val) => set("finance.bank_account_type", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Chèques (opérations)</SelectItem>
                      <SelectItem value="savings">Épargne</SelectItem>
                      <SelectItem value="usd">Devises étrangères</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertCircle className="h-4 w-4 inline mr-1.5" />
                Ces informations sont utilisées pour générer les modèles de virement Interac sur vos factures.
              </div>
            </Section>

            <Section icon={Receipt} title="Stripe (paiements en ligne)">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Stripe Account ID (acct_...)">
                  <Input value={v("finance.stripe_account_id")} onChange={(e) => set("finance.stripe_account_id", e.target.value)} placeholder="acct_1AbcD..." className="font-mono text-xs" />
                </Field>
                <Field label="Mode">
                  <Select value={v("finance.stripe_mode") || "test"} onValueChange={(val) => set("finance.stripe_mode", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">Test (sandbox)</SelectItem>
                      <SelectItem value="live">Production (live)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Les clés API Stripe se configurent dans <Link href="/admin/settings/integrations" className="text-[#0F2D52] underline">Intégrations</Link>.
              </p>
            </Section>
          </CardContent>
        </Card>
      )}

      {/* IDENTIFIANTS FISCAUX */}
      {section === "fiscal" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <Section icon={Receipt} title="Numéros d'enregistrement fiscaux">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="NEQ (Numéro d'entreprise Québec)">
                  <Input value={v("fiscal.neq")} onChange={(e) => set("fiscal.neq", e.target.value)} placeholder="1234567890" maxLength={10} className="font-mono" />
                </Field>
                <Field label="Numéro d'entreprise fédéral (BN)">
                  <Input value={v("fiscal.business_number")} onChange={(e) => set("fiscal.business_number", e.target.value)} placeholder="123456789RC0001" className="font-mono" />
                </Field>
                <Field label="N° TPS/GST">
                  <Input value={v("fiscal.gst_number")} onChange={(e) => set("fiscal.gst_number", e.target.value)} placeholder="123456789 RT0001" className="font-mono" />
                </Field>
                <Field label="N° TVQ/QST">
                  <Input value={v("fiscal.qst_number")} onChange={(e) => set("fiscal.qst_number", e.target.value)} placeholder="1234567890 TQ0001" className="font-mono" />
                </Field>
                <Field label="N° d'employeur (DAS)">
                  <Input value={v("fiscal.employer_number")} onChange={(e) => set("fiscal.employer_number", e.target.value)} placeholder="123456789 RP0001" className="font-mono" />
                </Field>
                <Field label="N° CCQ (si applicable)">
                  <Input value={v("fiscal.ccq_number")} onChange={(e) => set("fiscal.ccq_number", e.target.value)} placeholder="(facultatif)" className="font-mono" />
                </Field>
              </div>
            </Section>

            <Section icon={Receipt} title="Année fiscale & méthode comptable">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Début d'année fiscale">
                  <Select value={v("fiscal.fy_start_month") || "1"} onValueChange={(val) => set("fiscal.fy_start_month", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Date(2026, i, 1).toLocaleString("fr-CA", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Fréquence déclaration TPS/TVQ">
                  <Select value={v("fiscal.tax_filing_freq") || "quarterly"} onValueChange={(val) => set("fiscal.tax_filing_freq", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensuelle</SelectItem>
                      <SelectItem value="quarterly">Trimestrielle</SelectItem>
                      <SelectItem value="annually">Annuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Méthode comptable">
                  <Select value={v("fiscal.accounting_method") || "accrual"} onValueChange={(val) => set("fiscal.accounting_method", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Caisse</SelectItem>
                      <SelectItem value="accrual">Exercice (recommandé)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            <Section icon={Receipt} title="Petit fournisseur (régime simplifié)">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Mode petit fournisseur</p>
                  <p className="text-xs text-muted-foreground">Pas de TPS/TVQ à facturer si chiffre d&apos;affaires &lt; 30 000 $/an</p>
                </div>
                <Switch checked={v("fiscal.small_supplier") === "true"} onCheckedChange={(c) => set("fiscal.small_supplier", c ? "true" : "false")} />
              </div>
            </Section>
          </CardContent>
        </Card>
      )}

      {/* TAUX DE TAXES */}
      {section === "taxes" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <Section icon={Receipt} title="Taux par province / état">
              <p className="text-xs text-muted-foreground mb-3">
                Les taux affichés sont en vigueur en 2026. Personnalisez si nécessaire (le portail utilise la province du client).
              </p>
              {PROVINCES.map((p) => (
                <div key={p.code} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{p.code}</Badge>
                    <p className="font-medium text-sm">{p.name}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {p.taxes.map((tax) => (
                      <div key={tax.code}>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {tax.name} (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          max="50"
                          value={v(`fiscal.tax_${p.code.toLowerCase()}_${tax.code}`) || tax.rate.toString()}
                          onChange={(e) => set(`fiscal.tax_${p.code.toLowerCase()}_${tax.code}`, e.target.value)}
                          className="mt-1 h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          </CardContent>
        </Card>
      )}

      {/* FACTURATION & MENTIONS LÉGALES */}
      {section === "invoice" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <Section icon={FileWarning} title="Modalités de paiement">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Délai de paiement (jours)">
                  <Select value={v("billing.payment_terms_days") || "30"} onValueChange={(val) => set("billing.payment_terms_days", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Comptant à réception</SelectItem>
                      <SelectItem value="7">Net 7 jours</SelectItem>
                      <SelectItem value="15">Net 15 jours</SelectItem>
                      <SelectItem value="30">Net 30 jours (standard)</SelectItem>
                      <SelectItem value="60">Net 60 jours</SelectItem>
                      <SelectItem value="90">Net 90 jours</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Intérêts de retard (% / mois)">
                  <Input type="number" step="0.1" min="0" max="10" value={v("billing.late_interest_rate") || "1.5"} onChange={(e) => set("billing.late_interest_rate", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section icon={FileWarning} title="Mentions légales en pied de facture">
              <Field label="Texte affiché en bas de chaque facture">
                <Textarea
                  value={v("billing.invoice_footer_text")}
                  onChange={(e) => set("billing.invoice_footer_text", e.target.value)}
                  rows={4}
                  placeholder="Paiement par virement Interac à payments@vnkautomatisation.ca. Intérêt de 1,5% par mois sur tout solde en souffrance après 30 jours. Tout différend est régi par les lois du Québec."
                  className="text-sm"
                />
              </Field>
              <Field label="Conditions de service (URL)">
                <Input value={v("billing.terms_of_service_url")} onChange={(e) => set("billing.terms_of_service_url", e.target.value)} placeholder="https://vnkautomatisation.ca/conditions" />
              </Field>
            </Section>

            <Section icon={Receipt} title="Numérotation">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Préfixe factures">
                  <Input value={v("billing.invoice_prefix") || "FAC"} onChange={(e) => set("billing.invoice_prefix", e.target.value)} placeholder="FAC" className="font-mono" />
                </Field>
                <Field label="Préfixe devis">
                  <Input value={v("billing.quote_prefix") || "DEV"} onChange={(e) => set("billing.quote_prefix", e.target.value)} placeholder="DEV" className="font-mono" />
                </Field>
                <Field label="Numéro de départ">
                  <Input type="number" min="1" value={v("billing.starting_number") || "1"} onChange={(e) => set("billing.starting_number", e.target.value)} />
                </Field>
              </div>
            </Section>
          </CardContent>
        </Card>
      )}

      {/* LOI 25 */}
      {section === "law25" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <Shield className="h-4 w-4 inline mr-1.5" />
              <strong>Loi 25 (Québec)</strong> — Loi modernisant des dispositions législatives en matière de protection des renseignements personnels. En vigueur depuis le 22 septembre 2023. Une RPRP (Responsable de la protection des renseignements personnels) doit être désignée.
            </div>

            <Section icon={Shield} title="Responsable de la protection des renseignements personnels (RPRP)">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nom du RPRP *">
                  <Input value={v("legal.rprp_name")} onChange={(e) => set("legal.rprp_name", e.target.value)} placeholder="Yan Verone" />
                </Field>
                <Field label="Titre / fonction">
                  <Input value={v("legal.rprp_title")} onChange={(e) => set("legal.rprp_title", e.target.value)} placeholder="Président" />
                </Field>
                <Field label="Courriel dédié *">
                  <Input type="email" value={v("legal.rprp_email")} onChange={(e) => set("legal.rprp_email", e.target.value)} placeholder="confidentialite@vnkautomatisation.ca" />
                </Field>
                <Field label="Téléphone">
                  <Input value={v("legal.rprp_phone")} onChange={(e) => set("legal.rprp_phone", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section icon={Shield} title="Politique de confidentialité">
              <Field label="URL publique de la politique">
                <Input value={v("legal.privacy_policy_url")} onChange={(e) => set("legal.privacy_policy_url", e.target.value)} placeholder="https://vnkautomatisation.ca/confidentialite" />
              </Field>
              <Field label="Date de la dernière mise à jour">
                <Input type="date" value={v("legal.privacy_policy_updated_at")} onChange={(e) => set("legal.privacy_policy_updated_at", e.target.value)} />
              </Field>
            </Section>

            <Section icon={Shield} title="Délais de réponse">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Demande d'accès (jours)">
                  <Input type="number" min="1" max="90" value={v("legal.access_request_days") || "30"} onChange={(e) => set("legal.access_request_days", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">Loi 25 exige 30 jours max</p>
                </Field>
                <Field label="Notification d'incident (heures)">
                  <Input type="number" min="1" max="168" value={v("legal.incident_notification_hours") || "72"} onChange={(e) => set("legal.incident_notification_hours", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">Recommandation : 72h après détection</p>
                </Field>
              </div>
            </Section>

            <Section icon={Shield} title="Conservation des données">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Conservation des données client (années)">
                  <Input type="number" min="1" max="50" value={v("legal.client_data_retention_years") || "7"} onChange={(e) => set("legal.client_data_retention_years", e.target.value)} />
                </Field>
                <Field label="Conservation des factures (années)">
                  <Input type="number" min="6" max="50" value={v("legal.invoice_retention_years") || "6"} onChange={(e) => set("legal.invoice_retention_years", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">ARC exige minimum 6 ans</p>
                </Field>
              </div>
            </Section>

            <Section icon={Shield} title="Consentement & droits">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Bannière de consentement aux cookies</p>
                    <p className="text-xs text-muted-foreground">Affichage à la première visite</p>
                  </div>
                  <Switch checked={v("legal.cookie_banner_enabled") !== "false"} onCheckedChange={(c) => set("legal.cookie_banner_enabled", c ? "true" : "false")} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Permettre demande de portabilité</p>
                    <p className="text-xs text-muted-foreground">Export complet des données via /admin/profile</p>
                  </div>
                  <Switch checked={v("legal.data_portability_enabled") !== "false"} onCheckedChange={(c) => set("legal.data_portability_enabled", c ? "true" : "false")} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Permettre demande de suppression</p>
                    <p className="text-xs text-muted-foreground">Soumis aux obligations légales de conservation</p>
                  </div>
                  <Switch checked={v("legal.data_deletion_enabled") !== "false"} onCheckedChange={(c) => set("legal.data_deletion_enabled", c ? "true" : "false")} />
                </div>
              </div>
            </Section>
          </CardContent>
        </Card>
      )}

      {/* Sticky save bar */}
      {isDirty && (
        <div className="sticky bottom-4 z-30">
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-900 font-medium">
                Modifications non enregistrées dans : {Array.from(dirty).join(", ")}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDiscard} disabled={pending}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />{tc("cancel")}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                  <Save className="h-3.5 w-3.5 mr-1.5" />{pending ? "..." : "Enregistrer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-2">
        <Icon className="h-4 w-4 text-[#0F2D52]" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
