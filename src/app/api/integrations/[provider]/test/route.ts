// API · Tester la connexion d'une intégration
// Vérifie les credentials enregistrés (déchiffrement automatique).
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIntegrationCredentials } from "@/lib/integrations/credentials";

export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  const { provider } = await params;

  // Déchiffrement AES-256-GCM via le helper unifié
  const creds = await getIntegrationCredentials(provider);
  if (!creds || Object.keys(creds).length === 0) {
    return NextResponse.json({ ok: false, error: "Intégration non configurée ou désactivée" }, { status: 404 });
  }

  try {
    if (provider === "stripe") {
      const res = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${creds.secret_key}` },
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ ok: false, error: data.error?.message ?? "Échec de connexion Stripe" }, { status: 400 });
      return NextResponse.json({ ok: true, message: `Connecté à Stripe (${data.id})`, account: data.id });
    }

    if (provider === "sendgrid") {
      const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
        headers: { Authorization: `Bearer ${creds.api_key}` },
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Clé API SendGrid invalide" }, { status: 400 });
      return NextResponse.json({ ok: true, message: "Clé API SendGrid valide" });
    }

    if (provider === "slack") {
      const res = await fetch(creds.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ":white_check_mark: Test de connexion VNK Automatisation — votre webhook Slack fonctionne." }),
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Webhook Slack invalide" }, { status: 400 });
      return NextResponse.json({ ok: true, message: "Message test envoyé dans Slack" });
    }

    if (provider === "dropbox_sign") {
      const res = await fetch("https://api.hellosign.com/v3/account", {
        headers: { Authorization: `Basic ${Buffer.from(creds.api_key + ":").toString("base64")}` },
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Clé API Dropbox Sign invalide" }, { status: 400 });
      const data = await res.json();
      return NextResponse.json({ ok: true, message: `Connecté en tant que ${data.account?.email_address ?? "compte Dropbox Sign"}` });
    }

    if (provider === "smtp") {
      // Test SMTP basique : on vérifie juste que les champs sont présents (envoi réel via nodemailer)
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: creds.host,
        port: parseInt(creds.port, 10),
        secure: creds.secure === "true",
        auth: { user: creds.username, pass: creds.password },
      });
      await transporter.verify();
      return NextResponse.json({ ok: true, message: "Serveur courriel joignable" });
    }

    if (provider === "zapier") {
      if (!creds.webhook_url) {
        return NextResponse.json({ ok: false, error: "URL du webhook Zapier manquante" }, { status: 400 });
      }
      const testPayload = {
        event: "test.ping",
        timestamp: new Date().toISOString(),
        data: { message: "Ceci est un message de test depuis le portail VNK Automatisation.", from: "vnk-portal" },
      };
      const res = await fetch(creds.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Webhook Zapier injoignable" }, { status: 400 });
      return NextResponse.json({ ok: true, message: "Évènement test envoyé à Zapier" });
    }

    if (provider === "calendly") {
      if (!creds.api_key) {
        return NextResponse.json({ ok: false, error: "Token Calendly manquant" }, { status: 400 });
      }
      const res = await fetch("https://api.calendly.com/users/me", {
        headers: { Authorization: `Bearer ${creds.api_key}` },
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Token Calendly invalide" }, { status: 400 });
      const data = await res.json();
      return NextResponse.json({ ok: true, message: `Connecté en tant que ${data.resource?.name ?? "compte Calendly"}` });
    }

    return NextResponse.json({ ok: false, error: "Test non disponible pour ce fournisseur" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await prisma.integration.update({
      where: { provider },
      data: { lastError: msg.slice(0, 500) },
    }).catch(() => null);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
