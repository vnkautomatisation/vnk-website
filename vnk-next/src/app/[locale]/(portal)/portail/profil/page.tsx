import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate } from "@/lib/utils";
import { UserCircle } from "lucide-react";

export default async function PortalProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  const client = await prisma.client.findUnique({
    where: { id: session!.user.clientId! },
  });

  if (!client) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <UserCircle className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Mon profil</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="vnk-gradient text-white text-lg">
                {initials(client.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{client.fullName}</p>
              <p className="text-sm text-muted-foreground">{client.email}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Entreprise</p>
              <p className="text-sm">{client.companyName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Téléphone</p>
              <p className="text-sm">{client.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Secteur</p>
              <p className="text-sm">{client.sector ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Adresse</p>
              <p className="text-sm">
                {client.city}
                {client.province && `, ${client.province}`}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">Client depuis</p>
            <p className="text-sm">{formatDate(client.createdAt)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
