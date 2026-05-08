"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, User, Info } from "lucide-react";
import { updateProfileAction } from "@/app/actions/profile";

export function TabCompte({
  admin,
}: {
  admin: {
    id: number;
    email: string;
    fullName: string | null;
    role: string;
    lastLogin: string | null;
    createdAt: string;
  };
}) {
  const [fullName, setFullName] = useState(admin.fullName ?? "");
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    if (!fullName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    startTransition(async () => {
      const result = await updateProfileAction({ fullName: fullName.trim() });
      if (result.success) {
        toast.success("Profil mis a jour");
      } else {
        toast.error(result.error);
      }
    });
  };

  const createdDate = new Date(admin.createdAt).toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lastLoginDate = admin.lastLogin
    ? new Date(admin.lastLogin).toLocaleDateString("fr-CA", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Jamais";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Informations personnelles */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Informations personnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nom complet</Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Votre nom complet"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Courriel</Label>
            <Input
              id="profile-email"
              type="email"
              value={admin.email}
              disabled
              className="bg-muted"
            />
            <p className="text-[11px] text-muted-foreground">
              Le courriel ne peut pas etre modifie depuis cette page
            </p>
          </div>
          <Button onClick={handleSave} disabled={pending} size="sm">
            <Save className="h-3.5 w-3.5" />
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </CardContent>
      </Card>

      {/* Informations du compte */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Informations du compte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant="secondary">
                {admin.role === "super_admin" ? "Super administrateur" : "Administrateur"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Statut</span>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Actif
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Compte cree le</span>
              <span className="text-sm font-medium">{createdDate}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Derniere connexion</span>
              <span className="text-sm font-medium">{lastLoginDate}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">ID</span>
              <span className="text-sm font-mono text-muted-foreground">#{admin.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
