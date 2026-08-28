"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User, Building2, MapPin, Mail, Camera, Save, Briefcase,
  FileText, FileSignature, FolderOpen, Calendar, HardDrive,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

type ClientData = {
  id: number;
  fullName: string;
  email: string;
  companyName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  sector: string;
  technologies: string;
  avatarUrl: string;
  twoFactorEnabled: boolean;
  storageQuotaMb: number;
  createdAt: string;
  lastLogin: string | null;
};

type Stats = { mandates: number; invoices: number; contracts: number; documents: number };

const PROVINCES = [
  { value: "QC", labelKey: "prov_qc" }, { value: "ON", labelKey: "prov_on" },
  { value: "BC", labelKey: "prov_bc" }, { value: "AB", labelKey: "prov_ab" },
  { value: "MB", labelKey: "prov_mb" }, { value: "SK", labelKey: "prov_sk" },
  { value: "NS", labelKey: "prov_ns" }, { value: "NB", labelKey: "prov_nb" },
  { value: "PE", labelKey: "prov_pe" }, { value: "NL", labelKey: "prov_nl" },
];

// Le secteur est stocke en francais : seul l'affichage suit la locale.
const SECTOR_EN: Record<string, string> = {
  "Manufacturier": "Manufacturing",
  "Agroalimentaire": "Agri-food",
  "Minier": "Mining",
  "Energie": "Energy",
  "Petrochimie": "Petrochemicals",
  "Pharmaceutique": "Pharmaceuticals",
  "Papetier": "Pulp & paper",
  "Metallurgie": "Metals",
  "Eau / Environnement": "Water / environment",
  "Batiment / CVC": "Building / HVAC",
  "Autre": "Other",
};

const SECTORS = [
  "Manufacturier", "Agroalimentaire", "Minier", "Energie", "Petrochimie",
  "Pharmaceutique", "Papetier", "Metallurgie", "Eau / Environnement",
  "Batiment / CVC", "Autre",
];

export function ProfileForm({ client, stats }: { client: ClientData; stats: Stats }) {
  const t = useTranslations("portal");
  const isEn = useLocale().startsWith("en");
  const router = useRouter();
  const [form, setForm] = useState(client);
  const [saving, setSaving] = useState(false);

  const initials = form.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName, companyName: form.companyName || null,
          phone: form.phone || null, address: form.address || null,
          city: form.city || null, province: form.province,
          postalCode: form.postalCode || null, sector: form.sector || null,
          technologies: form.technologies || null, avatarUrl: form.avatarUrl || null,
        }),
      });
      if (res.ok) { toast.success(t("profil_mis_jour")); router.refresh(); }
      else toast.error(t("erreur_lors_sauvegarde"));
    } catch { toast.error(t("erreur_connexion")); }
    finally { setSaving(false); }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error(t("image_trop_lourde_max_2")); return; }
    const reader = new FileReader();
    reader.onload = () => update("avatarUrl", reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="portal-icon-lg rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
          <User className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="portal-title">{t("profil")}</h1>
          <p className="text-sm text-muted-foreground">{t("informations_personnelles")}</p>
        </div>
      </div>


      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <label className="relative group cursor-pointer shrink-0">
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-[#0F2D52]/10" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-[#0F2D52] flex items-center justify-center ring-4 ring-[#0F2D52]/10">
                  <span className="text-xl font-bold text-white">{initials}</span>
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </label>
            <div className="text-center sm:text-left flex-1 min-w-0">
              <h2 className="text-lg font-bold">{form.fullName}</h2>
              <p className="text-sm text-muted-foreground">{form.companyName || "—"}</p>
              <div className="flex items-center gap-1.5 justify-center sm:justify-start mt-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{form.email}</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center shrink-0">
              {[
                { icon: Briefcase, val: stats.mandates, label: t("mandats") },
                { icon: FileText, val: stats.invoices, label: t("factures") },
                { icon: FileSignature, val: stats.contracts, label: t("contrats") },
                { icon: FolderOpen, val: stats.documents, label: t("docs") },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-lg font-bold text-[#0F2D52]">{s.val}</p>
                  <p className="text-[0.625rem] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-[#0F2D52]" />
            {t("informations_personnelles_2")}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">{t("nom_complet")}</Label><Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} /></div>
            <div><Label className="text-xs">{t("courriel")}</Label><Input value={form.email} disabled className="bg-muted" /></div>
            <div><Label className="text-xs">{t("telephone")}</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(514) 000-0000" /></div>
            <div><Label className="text-xs">{t("entreprise")}</Label><Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#0F2D52]" />
            {t("adresse")}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label className="text-xs">{t("adresse")}</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder={t("123_rue_example")} /></div>
            <div><Label className="text-xs">{t("ville")}</Label><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("province")}</Label>
                <select value={form.province} onChange={(e) => update("province", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {PROVINCES.map((p) => <option key={p.value} value={p.value}>{t(p.labelKey)}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">{t("code_postal")}</Label><Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} placeholder="G1A 1A1" /></div>
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#0F2D52]" />
            {t("profil_industriel")}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t("secteur")}</Label>
              <select value={form.sector} onChange={(e) => update("sector", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{t("selectionnez")}</option>
                {SECTORS.map((s) => <option key={s} value={s}>{isEn ? SECTOR_EN[s] ?? s : s}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">{t("technologies_plc")}</Label><Input value={form.technologies} onChange={(e) => update("technologies", e.target.value)} placeholder={t("siemens_allen_bradley")} /></div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-[#0F2D52]" />
            {t("compte")}
          </h3>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">{t("membre_depuis")}</p><p className="font-medium">{formatDate(client.createdAt)}</p></div></div>
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">{t("derniere_connexion")}</p><p className="font-medium">{client.lastLogin ? formatDate(client.lastLogin) : "—"}</p></div></div>
            <div className="flex items-center gap-2"><HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">{t("stockage")}</p><p className="font-medium">{t("stockage_go", { size: (client.storageQuotaMb / 1024).toFixed(1) })}</p></div></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} className="bg-[#0F2D52] hover:bg-[#1a3a66]">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? t("enregistrement") : t("enregistrer")}
        </Button>
      </div>
    </div>
  );
}
