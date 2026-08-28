"use client";
// Vue Finance · Fiscalité · Loi 25 — paramètres regroupés en sections.
// Utilise updateSettingsAction (catégorie par catégorie).
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
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
  const t = useTranslations("admin.finance_settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [section, setSection] = useState<Section>("bank");
  const dateTag = useDateLocale();
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
      toast.success(t("parametres_enregistres"));
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
    { key: "bank", label: t("banque_paiements"), icon: Building2 },
    { key: "fiscal", label: t("identifiants_fiscaux"), icon: Receipt },
    { key: "taxes", label: t("taux_taxes"), icon: Receipt },
    { key: "invoice", label: t("facturation_mentions"), icon: FileWarning },
    { key: "law25", label: t("loi_25_confidentialite"), icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-emerald-500 shrink-0">
          <Wallet className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("finance_fiscalite")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("banque_taxes_mentions_legales_conformite")}
          </p>
        </div>
      </div>


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


      {section === "bank" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <Section icon={Building2} title={t("compte_bancaire_principal")}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label={t("nom_institution")}>
                  <Input value={v("finance.bank_name")} onChange={(e) => set("finance.bank_name", e.target.value)} placeholder={t("desjardins_rbc_td")} />
                </Field>
                <Field label={t("n_institution_3_chiffres")}>
                  <Input value={v("finance.bank_institution")} onChange={(e) => set("finance.bank_institution", e.target.value)} maxLength={3} placeholder="815" className="font-mono" />
                </Field>
                <Field label={t("n_transit_5_chiffres")}>
                  <Input value={v("finance.bank_transit")} onChange={(e) => set("finance.bank_transit", e.target.value)} maxLength={5} placeholder="30000" className="font-mono" />
                </Field>
                <Field label={t("n_folio_7_12_chiffres")}>
                  <Input value={v("finance.bank_account")} onChange={(e) => set("finance.bank_account", e.target.value)} maxLength={12} placeholder="1234567" className="font-mono" />
                </Field>
                <Field label={t("devise_compte")}>
                  <Select value={v("finance.bank_currency") || "CAD"} onValueChange={(val) => set("finance.bank_currency", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAD">{t("cad_dollar_canadien")}</SelectItem>
                      <SelectItem value="USD">{t("usd_dollar_americain")}</SelectItem>
                      <SelectItem value="EUR">{t("eur_euro")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("type_compte")}>
                  <Select value={v("finance.bank_account_type") || "checking"} onValueChange={(val) => set("finance.bank_account_type", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">{t("cheques_operations")}</SelectItem>
                      <SelectItem value="savings">{t("epargne")}</SelectItem>
                      <SelectItem value="usd">{t("devises_etrangeres")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertCircle className="h-4 w-4 inline mr-1.5" />
                {t("informations_utilisees_generer_modeles_virement")}
              </div>
            </Section>

            <Section icon={Receipt} title={t("stripe_paiements_ligne")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t("stripe_account_id_acct")}>
                  <Input value={v("finance.stripe_account_id")} onChange={(e) => set("finance.stripe_account_id", e.target.value)} placeholder={t("acct_1abcd")} className="font-mono text-xs" />
                </Field>
                <Field label={t("mode")}>
                  <Select value={v("finance.stripe_mode") || "test"} onValueChange={(val) => set("finance.stripe_mode", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">{t("test_sandbox")}</SelectItem>
                      <SelectItem value="live">{t("production_live")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">{t("finance_view_les_cles_api_stripe_se_configurent_dans")}<Link href="/admin/settings/integrations" className="text-[#0F2D52] underline">{t("integrations")}</Link>.
              </p>
            </Section>
          </CardContent>
        </Card>
      )}


      {section === "fiscal" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <Section icon={Receipt} title={t("numeros_enregistrement_fiscaux")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t("neq_numero_entreprise_quebec")}>
                  <Input value={v("fiscal.neq")} onChange={(e) => set("fiscal.neq", e.target.value)} placeholder="1234567890" maxLength={10} className="font-mono" />
                </Field>
                <Field label={t("numero_entreprise_federal_bn")}>
                  <Input value={v("fiscal.business_number")} onChange={(e) => set("fiscal.business_number", e.target.value)} placeholder="123456789RC0001" className="font-mono" />
                </Field>
                <Field label={t("n_tps_gst")}>
                  <Input value={v("fiscal.gst_number")} onChange={(e) => set("fiscal.gst_number", e.target.value)} placeholder={t("123456789_rt0001")} className="font-mono" />
                </Field>
                <Field label={t("n_tvq_qst")}>
                  <Input value={v("fiscal.qst_number")} onChange={(e) => set("fiscal.qst_number", e.target.value)} placeholder={t("1234567890_tq0001")} className="font-mono" />
                </Field>
                <Field label={t("n_employeur_das")}>
                  <Input value={v("fiscal.employer_number")} onChange={(e) => set("fiscal.employer_number", e.target.value)} placeholder={t("123456789_rp0001")} className="font-mono" />
                </Field>
                <Field label={t("n_ccq_si_applicable")}>
                  <Input value={v("fiscal.ccq_number")} onChange={(e) => set("fiscal.ccq_number", e.target.value)} placeholder={t("facultatif")} className="font-mono" />
                </Field>
              </div>
            </Section>

            <Section icon={Receipt} title={t("annee_fiscale_methode_comptable")}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label={t("debut_annee_fiscale")}>
                  <Select value={v("fiscal.fy_start_month") || "1"} onValueChange={(val) => set("fiscal.fy_start_month", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Date(2026, i, 1).toLocaleString(dateTag, { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("frequence_declaration_tps_tvq")}>
                  <Select value={v("fiscal.tax_filing_freq") || "quarterly"} onValueChange={(val) => set("fiscal.tax_filing_freq", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{t("mensuelle")}</SelectItem>
                      <SelectItem value="quarterly">{t("trimestrielle")}</SelectItem>
                      <SelectItem value="annually">{t("annuelle")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("methode_comptable")}>
                  <Select value={v("fiscal.accounting_method") || "accrual"} onValueChange={(val) => set("fiscal.accounting_method", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("caisse")}</SelectItem>
                      <SelectItem value="accrual">{t("exercice_recommande")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            <Section icon={Receipt} title={t("petit_fournisseur_regime_simplifie")}>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{t("mode_petit_fournisseur")}</p>
                  <p className="text-xs text-muted-foreground">{t("pas_tps_tvq_facturer_si")}</p>
                </div>
                <Switch checked={v("fiscal.small_supplier") === "true"} onCheckedChange={(c) => set("fiscal.small_supplier", c ? "true" : "false")} />
              </div>
            </Section>
          </CardContent>
        </Card>
      )}


      {section === "taxes" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <Section icon={Receipt} title={t("taux_province_etat")}>
              <p className="text-xs text-muted-foreground mb-3">
                {t("taux_affiches_vigueur_2026_personnalisez")}
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


      {section === "invoice" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <Section icon={FileWarning} title={t("modalites_paiement")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t("delai_paiement_jours")}>
                  <Select value={v("billing.payment_terms_days") || "30"} onValueChange={(val) => set("billing.payment_terms_days", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t("comptant_reception")}</SelectItem>
                      <SelectItem value="7">{t("net_7_jours")}</SelectItem>
                      <SelectItem value="15">{t("net_15_jours")}</SelectItem>
                      <SelectItem value="30">{t("net_30_jours_standard")}</SelectItem>
                      <SelectItem value="60">{t("net_60_jours")}</SelectItem>
                      <SelectItem value="90">{t("net_90_jours")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("interets_retard_mois")}>
                  <Input type="number" step="0.1" min="0" max="10" value={v("billing.late_interest_rate") || "1.5"} onChange={(e) => set("billing.late_interest_rate", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section icon={FileWarning} title={t("mentions_legales_pied_facture")}>
              <Field label={t("texte_affiche_bas_chaque_facture")}>
                <Textarea
                  value={v("billing.invoice_footer_text")}
                  onChange={(e) => set("billing.invoice_footer_text", e.target.value)}
                  rows={4}
                  placeholder={t("conditions_paiement_exemple")}
                  className="text-sm"
                />
              </Field>
              <Field label={t("conditions_service_url")}>
                <Input value={v("billing.terms_of_service_url")} onChange={(e) => set("billing.terms_of_service_url", e.target.value)} placeholder="https://vnkautomatisation.ca/conditions" />
              </Field>
            </Section>

            <Section icon={Receipt} title={t("numerotation")}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label={t("prefixe_factures")}>
                  <Input value={v("billing.invoice_prefix") || "FAC"} onChange={(e) => set("billing.invoice_prefix", e.target.value)} placeholder="FAC" className="font-mono" />
                </Field>
                <Field label={t("prefixe_devis")}>
                  <Input value={v("billing.quote_prefix") || "DEV"} onChange={(e) => set("billing.quote_prefix", e.target.value)} placeholder="DEV" className="font-mono" />
                </Field>
                <Field label={t("numero_depart")}>
                  <Input type="number" min="1" value={v("billing.starting_number") || "1"} onChange={(e) => set("billing.starting_number", e.target.value)} />
                </Field>
              </div>
            </Section>
          </CardContent>
        </Card>
      )}


      {section === "law25" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <Shield className="h-4 w-4 inline mr-1.5" />
              <strong>{t("loi_25_quebec")}</strong>{t("finance_view_loi_modernisant_des_dispositions_legislatives_en_matiere")}</div>

            <Section icon={Shield} title={t("responsable_protection_renseignements_personnels_rprp")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t("nom_rprp")}>
                  <Input value={v("legal.rprp_name")} onChange={(e) => set("legal.rprp_name", e.target.value)} placeholder={t("yan_verone")} />
                </Field>
                <Field label={t("titre_fonction")}>
                  <Input value={v("legal.rprp_title")} onChange={(e) => set("legal.rprp_title", e.target.value)} placeholder={t("president")} />
                </Field>
                <Field label={t("courriel_dedie")}>
                  <Input type="email" value={v("legal.rprp_email")} onChange={(e) => set("legal.rprp_email", e.target.value)} placeholder="confidentialite@vnkautomatisation.ca" />
                </Field>
                <Field label={t("telephone")}>
                  <Input value={v("legal.rprp_phone")} onChange={(e) => set("legal.rprp_phone", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section icon={Shield} title={t("politique_confidentialite")}>
              <Field label={t("url_publique_politique")}>
                <Input value={v("legal.privacy_policy_url")} onChange={(e) => set("legal.privacy_policy_url", e.target.value)} placeholder="https://vnkautomatisation.ca/confidentialite" />
              </Field>
              <Field label={t("date_derniere_mise_jour")}>
                <Input type="date" value={v("legal.privacy_policy_updated_at")} onChange={(e) => set("legal.privacy_policy_updated_at", e.target.value)} />
              </Field>
            </Section>

            <Section icon={Shield} title={t("delais_reponse")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t("demande_acces_jours")}>
                  <Input type="number" min="1" max="90" value={v("legal.access_request_days") || "30"} onChange={(e) => set("legal.access_request_days", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">{t("loi_25_exige_30_jours")}</p>
                </Field>
                <Field label={t("notification_incident_heures")}>
                  <Input type="number" min="1" max="168" value={v("legal.incident_notification_hours") || "72"} onChange={(e) => set("legal.incident_notification_hours", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">{t("recommandation_72h_apres_detection")}</p>
                </Field>
              </div>
            </Section>

            <Section icon={Shield} title={t("conservation_donnees")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t("conservation_donnees_client_annees")}>
                  <Input type="number" min="1" max="50" value={v("legal.client_data_retention_years") || "7"} onChange={(e) => set("legal.client_data_retention_years", e.target.value)} />
                </Field>
                <Field label={t("conservation_factures_annees")}>
                  <Input type="number" min="6" max="50" value={v("legal.invoice_retention_years") || "6"} onChange={(e) => set("legal.invoice_retention_years", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">{t("arc_exige_minimum_6_ans")}</p>
                </Field>
              </div>
            </Section>

            <Section icon={Shield} title={t("consentement_droits")}>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("banniere_consentement_cookies")}</p>
                    <p className="text-xs text-muted-foreground">{t("affichage_premiere_visite")}</p>
                  </div>
                  <Switch checked={v("legal.cookie_banner_enabled") !== "false"} onCheckedChange={(c) => set("legal.cookie_banner_enabled", c ? "true" : "false")} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("permettre_demande_portabilite")}</p>
                    <p className="text-xs text-muted-foreground">{t("export_complet_donnees_via_admin")}</p>
                  </div>
                  <Switch checked={v("legal.data_portability_enabled") !== "false"} onCheckedChange={(c) => set("legal.data_portability_enabled", c ? "true" : "false")} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("permettre_demande_suppression")}</p>
                    <p className="text-xs text-muted-foreground">{t("soumis_obligations_legales_conservation")}</p>
                  </div>
                  <Switch checked={v("legal.data_deletion_enabled") !== "false"} onCheckedChange={(c) => set("legal.data_deletion_enabled", c ? "true" : "false")} />
                </div>
              </div>
            </Section>
          </CardContent>
        </Card>
      )}


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
                  <Save className="h-3.5 w-3.5 mr-1.5" />{pending ? "..." : t("enregistrer")}
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
