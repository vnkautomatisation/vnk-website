"use client";
import { useState } from "react";
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
  { value: "QC", label: "Quebec" }, { value: "ON", label: "Ontario" },
  { value: "BC", label: "Colombie-Britannique" }, { value: "AB", label: "Alberta" },
  { value: "MB", label: "Manitoba" }, { value: "SK", label: "Saskatchewan" },
  { value: "NS", label: "Nouvelle-Ecosse" }, { value: "NB", label: "Nouveau-Brunswick" },
  { value: "PE", label: "Ile-du-Prince-Edouard" }, { value: "NL", label: "Terre-Neuve" },
];

const SECTORS = [
  "Manufacturier", "Agroalimentaire", "Minier", "Energie", "Petrochimie",
  "Pharmaceutique", "Papetier", "Metallurgie", "Eau / Environnement",
  "Batiment / CVC", "Autre",
];

export function ProfileForm({ client, stats }: { client: ClientData; stats: Stats }) {
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
      if (res.ok) { toast.success("Profil mis a jour"); router.refresh(); }
      else toast.error("Erreur lors de la sauvegarde");
    } catch { toast.error("Erreur de connexion"); }
    finally { setSaving(false); }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image trop lourde (max 2 Mo)"); return; }
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
          <h1 className="portal-title">Profil</h1>
          <p className="text-sm text-muted-foreground">Vos informations personnelles</p>
        </div>
      </div>

      {/* ── Avatar + Resume ── */}
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
                { icon: Briefcase, val: stats.mandates, label: "Mandats" },
                { icon: FileText, val: stats.invoices, label: "Factures" },
                { icon: FileSignature, val: stats.contracts, label: "Contrats" },
                { icon: FolderOpen, val: stats.documents, label: "Docs" },
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

      {/* ── Informations personnelles ── */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-[#0F2D52]" />
            Informations personnelles
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Nom complet</Label><Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} /></div>
            <div><Label className="text-xs">Courriel</Label><Input value={form.email} disabled className="bg-muted" /></div>
            <div><Label className="text-xs">Telephone</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(514) 000-0000" /></div>
            <div><Label className="text-xs">Entreprise</Label><Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* ── Adresse ── */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#0F2D52]" />
            Adresse
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label className="text-xs">Adresse</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="123 rue Example" /></div>
            <div><Label className="text-xs">Ville</Label><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Province</Label>
                <select value={form.province} onChange={(e) => update("province", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {PROVINCES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Code postal</Label><Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} placeholder="G1A 1A1" /></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Profil industriel ── */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#0F2D52]" />
            Profil industriel
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Secteur</Label>
              <select value={form.sector} onChange={(e) => update("sector", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selectionnez...</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Technologies / PLC</Label><Input value={form.technologies} onChange={(e) => update("technologies", e.target.value)} placeholder="Siemens, Allen-Bradley..." /></div>
          </div>
        </CardContent>
      </Card>

      {/* ── Compte ── */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-[#0F2D52]" />
            Compte
          </h3>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">Membre depuis</p><p className="font-medium">{formatDate(client.createdAt)}</p></div></div>
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">Derniere connexion</p><p className="font-medium">{client.lastLogin ? formatDate(client.lastLogin) : "—"}</p></div></div>
            <div className="flex items-center gap-2"><HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><div><p className="text-xs text-muted-foreground">Stockage</p><p className="font-medium">{(client.storageQuotaMb / 1024).toFixed(1)} Go</p></div></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} className="bg-[#0F2D52] hover:bg-[#1a3a66]">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
