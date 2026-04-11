"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

export function ProfileForm({
  admin,
}: {
  admin: { id: number; email: string; fullName: string | null; role: string };
}) {
  const [fullName, setFullName] = useState(admin.fullName ?? "");
  const [email, setEmail] = useState(admin.email);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="vnk-gradient text-white text-lg">
                {initials(fullName || email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm">Changer l&apos;avatar</Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Nom complet</Label>
              <Input id="admin-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Courriel</Label>
              <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <Button onClick={() => toast.success("Profil mis à jour")}>Enregistrer</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer le mot de passe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old-pw">Mot de passe actuel</Label>
            <Input id="old-pw" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-pw">Nouveau mot de passe</Label>
              <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirmer</Label>
              <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" onClick={() => {
            if (newPw !== confirmPw) { toast.error("Les mots de passe ne correspondent pas"); return; }
            if (newPw.length < 12) { toast.error("Minimum 12 caractères"); return; }
            toast.success("Mot de passe changé");
          }}>
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentification 2FA</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Protégez votre compte avec un second facteur (application TOTP).
          </p>
          <Button variant="outline">Activer 2FA</Button>
        </CardContent>
      </Card>
    </div>
  );
}
