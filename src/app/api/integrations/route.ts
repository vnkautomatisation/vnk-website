// API · Liste des intégrations configurées (admin)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const integrations = await prisma.integration.findMany({
    orderBy: { provider: "asc" },
  });

  // Masquer TOUS les credentials (qu'ils soient chiffrés ou non).
  // L'UI affiche uniquement "•••••••• (Défini)" pour les champs configurés.
  // Pour révéler une valeur, il faut passer par /api/integrations/[provider]/reveal (2FA requis).
  const safe = integrations.map((i) => {
    const creds = i.credentials as Record<string, string> | null;
    const maskedCredentials = creds
      ? Object.fromEntries(Object.entries(creds).map(([k, v]) => [k, v ? "••••••••••••" : ""]))
      : null;
    return {
      id: i.id,
      provider: i.provider,
      name: i.name,
      isEnabled: i.isEnabled,
      credentials: maskedCredentials,
      config: i.config,
      lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
      lastError: i.lastError,
      updatedAt: i.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ integrations: safe });
}
