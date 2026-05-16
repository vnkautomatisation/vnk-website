// POST /api/integrations/calendly/register-webhook
// Enregistre automatiquement le webhook entrant Calendly via leur API
// afin que le portail reçoive les évènements invitee.created/canceled
// sans intervention manuelle.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getIntegrationCredentials } from "@/lib/integrations/credentials";
import { encryptCredentials } from "@/lib/security/crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const creds = await getIntegrationCredentials("calendly");
  if (!creds?.api_key) {
    return NextResponse.json({ error: "Token Calendly manquant" }, { status: 400 });
  }

  try {
    // 1. Récupérer l'utilisateur Calendly
    const meRes = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${creds.api_key}` },
    });
    if (!meRes.ok) {
      return NextResponse.json({ error: "Token Calendly invalide" }, { status: 400 });
    }
    const me = await meRes.json();
    const userUri: string = me.resource.uri;
    const organizationUri: string = me.resource.current_organization;

    // 2. Construire l'URL publique du webhook
    const url = new URL(req.url);
    const callbackUrl = `${url.protocol}//${url.host}/api/webhooks/calendly`;

    // 3. Créer le webhook subscription via API Calendly
    const sub = await fetch("https://api.calendly.com/webhook_subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: callbackUrl,
        events: ["invitee.created", "invitee.canceled"],
        organization: organizationUri,
        user: userUri,
        scope: "user",
      }),
    });

    if (!sub.ok) {
      const err = await sub.text();
      return NextResponse.json({ error: `Calendly a refusé : ${err}` }, { status: 400 });
    }

    const subData = await sub.json();
    const webhookUri: string = subData.resource.uri;
    const webhookSecret: string = subData.resource.signing_key ?? "";

    // 4. Stocker user_uri + webhook URI/secret dans l'intégration
    const updated = encryptCredentials({
      ...creds,
      user_uri: userUri,
      webhook_uri: webhookUri,
      calendly_webhook_secret: webhookSecret,
    });
    await prisma.integration.update({
      where: { provider: "calendly" },
      data: { credentials: updated as never, isEnabled: true },
    });

    return NextResponse.json({
      success: true,
      message: `Webhook enregistré pour ${me.resource.name}. Les rendez-vous Calendly apparaîtront automatiquement.`,
      webhookUri,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — désinscrire le webhook
export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const creds = await getIntegrationCredentials("calendly");
  if (!creds?.webhook_uri || !creds?.api_key) {
    return NextResponse.json({ ok: true });
  }

  await fetch(creds.webhook_uri, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${creds.api_key}` },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
