"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UserCircle,
  Pencil,
  Save,
  X,
  Eye,
  EyeOff,
  Lock,
  ChevronDown,
  ChevronUp,
  Building2,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

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
  createdAt: string;
};

const PROVINCES = [
  "QC", "ON", "BC", "AB", "SK", "MB", "NS", "NB", "NL", "PE", "NT", "YT", "NU",
];

const SECTORS = [
  "Fabrication industrielle",
  "Agroalimentaire",
  "Chimie",
  "Pharmaceutique",
  "Pates et papiers",
  "Energie",
  "Metallurgie",
  "Automobile",
  "Mines",
  "Transport",
  "Autres",
];

export function ProfileForm({ client }: { client: ClientData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(client);
  const [pending, startTransition] = useTransition();

  // Password section
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwPending, startPwTransition] = useTransition();

  const initials = client.fullName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSave = () => {
    startTransition(async () => {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          companyName: form.companyName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          province: form.province,
          postalCode: form.postalCode,
          sector: form.sector,
          technologies: form.technologies,
          avatarUrl: form.avatarUrl,
        }),
      });
      if (res.ok) {
        toast.success("Profil mis a jour");
        setEditing(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Erreur lors de la sauvegarde");
      }
    });
  };

  const handlePasswordChange = () => {
    if (newPw.length < 8) {
      toast.error("Le nouveau mot de passe doit faire au moins 8 caracteres");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    startPwTransition(async () => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
          confirmPassword: confirmPw,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Mot de passe modifie");
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        setPwOpen(false);
      } else {
        toast.error(data.error ?? "Erreur");
      }
    });
  };

  const handleCancel = () => {
    setForm(client);
    setEditing(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop lourde (max 2 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, avatarUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const update = (key: keyof ClientData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCircle className="h-6 w-6 text-[#0F2D52]" />
          <h1 className="text-2xl font-bold">Mon profil</h1>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-1" />
            Modifier
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              disabled={pending}
            >
              <X className="h-4 w-4 mr-1" />
              Annuler
            </Button>
            <Button onClick={handleSave} size="sm" disabled={pending}>
              <Save className="h-4 w-4 mr-1" />
              {pending ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </div>
        )}
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar + Name */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {form.avatarUrl ? (
                  <AvatarImage src={form.avatarUrl} alt={form.fullName} />
                ) : null}
                <AvatarFallback className="vnk-gradient text-white text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {editing && (
                <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#0F2D52] text-white flex items-center justify-center cursor-pointer hover:bg-[#1a3a66] transition-colors">
                  <Pencil className="h-3 w-3" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              )}
            </div>
            <div>
              {editing ? (
                <div className="space-y-1">
                  <Label htmlFor="fullName" className="text-xs">
                    Nom complet
                  </Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    className="h-9"
                  />
                </div>
              ) : (
                <>
                  <p className="font-semibold text-xl">{client.fullName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {client.email}
                  </p>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Fields grid */}
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Entreprise */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Building2 className="h-3 w-3" />
                Entreprise
              </Label>
              {editing ? (
                <Input
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                  className="h-9"
                />
              ) : (
                <p className="text-sm font-medium">
                  {client.companyName || "—"}
                </p>
              )}
            </div>

            {/* Telephone */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Phone className="h-3 w-3" />
                Telephone
              </Label>
              {editing ? (
                <Input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="418-555-1234"
                  className="h-9"
                />
              ) : (
                <p className="text-sm font-medium">{client.phone || "—"}</p>
              )}
            </div>

            {/* Secteur */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Briefcase className="h-3 w-3" />
                Secteur
              </Label>
              {editing ? (
                <select
                  value={form.sector}
                  onChange={(e) => update("sector", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Choisir...</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-medium">{client.sector || "—"}</p>
              )}
            </div>

            {/* Adresse */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <MapPin className="h-3 w-3" />
                Adresse
              </Label>
              {editing ? (
                <Input
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="123 rue Principale"
                  className="h-9"
                />
              ) : (
                <p className="text-sm font-medium">{client.address || "—"}</p>
              )}
            </div>

            {/* Ville */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">
                Ville
              </Label>
              {editing ? (
                <Input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  className="h-9"
                />
              ) : (
                <p className="text-sm font-medium">{client.city || "—"}</p>
              )}
            </div>

            {/* Province */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">
                Province
              </Label>
              {editing ? (
                <select
                  value={form.province}
                  onChange={(e) => update("province", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-medium">
                  {client.province || "—"}
                </p>
              )}
            </div>

            {/* Code postal */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">
                Code postal
              </Label>
              {editing ? (
                <Input
                  value={form.postalCode}
                  onChange={(e) => update("postalCode", e.target.value)}
                  placeholder="G1A 1A1"
                  className="h-9"
                />
              ) : (
                <p className="text-sm font-medium">
                  {client.postalCode || "—"}
                </p>
              )}
            </div>

            {/* Technologies */}
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1">
                Technologies / PLC
              </Label>
              {editing ? (
                <Input
                  value={form.technologies}
                  onChange={(e) => update("technologies", e.target.value)}
                  placeholder="Siemens S7-1500, TIA Portal, WinCC"
                  className="h-9"
                />
              ) : (
                <div className="flex flex-wrap gap-1 mt-1">
                  {client.technologies ? (
                    client.technologies.split(",").map((t) => (
                      <span
                        key={t}
                        className="text-xs px-2 py-0.5 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] font-medium"
                      >
                        {t.trim()}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Member since */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Client depuis{" "}
            {new Date(client.createdAt).toLocaleDateString("fr-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </CardContent>
      </Card>

      {/* Password section */}
      <Card>
        <CardContent className="p-0">
          <button
            type="button"
            onClick={() => setPwOpen((v) => !v)}
            className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-[#0F2D52]" />
              <span className="font-semibold">Changer le mot de passe</span>
            </div>
            {pwOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {pwOpen && (
            <div className="px-5 pb-5 space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="currentPw">Mot de passe actuel</Label>
                <div className="relative">
                  <Input
                    id="currentPw"
                    type={showPw ? "text" : "password"}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPw">Nouveau mot de passe</Label>
                  <Input
                    id="newPw"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min. 8 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPw">Confirmer</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={handlePasswordChange}
                disabled={pwPending || !currentPw || !newPw || !confirmPw}
              >
                <Lock className="h-4 w-4 mr-1" />
                {pwPending ? "Modification..." : "Modifier le mot de passe"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
