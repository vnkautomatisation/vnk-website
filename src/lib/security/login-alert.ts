// New-login alert email, sent when an unknown fingerprint signs in.
// Carries a one-click link to revoke the session and raise the alarm.
import "server-only";
import { sendEmail } from "@/lib/services/email";
import { buildNotMeToken } from "@/lib/security/not-me-token";

export type LoginAlertInput = {
  adminId: number;
  adminEmail: string;
  adminName: string | null;
  sessionId: string;
  browser: string;
  os: string;
  deviceType: string;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  loginAt: Date;
  appUrl?: string;
};

export async function sendLoginAlertEmail(input: LoginAlertInput): Promise<{ ok: boolean }> {
  const baseUrl = input.appUrl ?? process.env.NEXTAUTH_URL ?? "https://vnkautomatisation.ca";
  const notMeToken = buildNotMeToken(input.sessionId, input.adminId);
  const notMeUrl = `${baseUrl.replace(/\/$/, "")}/api/auth/not-me/${notMeToken}`;
  const sessionsUrl = `${baseUrl.replace(/\/$/, "")}/admin/profile?tab=sessions`;
  const security = `${baseUrl.replace(/\/$/, "")}/admin/profile?tab=securite`;

  const location = [input.city, input.country].filter(Boolean).join(", ") || "Localisation inconnue";
  const ipDisplay = input.ipAddress ?? "Adresse IP masquée";
  const dateLocal = input.loginAt.toLocaleString("fr-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;background:#f5f5f7;padding:24px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header navy VNK -->
        <div style="background:linear-gradient(135deg,#0F2D52,#1A5FB4);color:#ffffff;padding:24px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">🔐</div>
          <h1 style="margin:0;font-size:20px;font-weight:700;">Nouvelle connexion détectée</h1>
          <p style="margin:8px 0 0;opacity:.85;font-size:14px;">VNK Automatisation — Sécurité du compte</p>
        </div>

        <!-- Corps -->
        <div style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;color:#333;">
            Bonjour ${input.adminName ?? input.adminEmail.split("@")[0]},
          </p>
          <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.5;">
            Nous avons détecté une nouvelle connexion à votre compte d'administration depuis un appareil non reconnu. Si c'est bien vous, aucune action n'est nécessaire.
          </p>

          <!-- Détails de la connexion -->
          <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
            <div style="display:table;width:100%;">
              <div style="display:table-row;">
                <div style="display:table-cell;padding:6px 0;font-size:12px;color:#6b7280;width:40%;">Appareil</div>
                <div style="display:table-cell;padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${input.browser} sur ${input.os}</div>
              </div>
              <div style="display:table-row;">
                <div style="display:table-cell;padding:6px 0;font-size:12px;color:#6b7280;">Type</div>
                <div style="display:table-cell;padding:6px 0;font-size:13px;color:#111827;text-transform:capitalize;">${input.deviceType}</div>
              </div>
              <div style="display:table-row;">
                <div style="display:table-cell;padding:6px 0;font-size:12px;color:#6b7280;">Adresse IP</div>
                <div style="display:table-cell;padding:6px 0;font-size:13px;color:#111827;font-family:monospace;">${ipDisplay}</div>
              </div>
              <div style="display:table-row;">
                <div style="display:table-cell;padding:6px 0;font-size:12px;color:#6b7280;">Localisation</div>
                <div style="display:table-cell;padding:6px 0;font-size:13px;color:#111827;">${location}</div>
              </div>
              <div style="display:table-row;">
                <div style="display:table-cell;padding:6px 0;font-size:12px;color:#6b7280;">Date et heure</div>
                <div style="display:table-cell;padding:6px 0;font-size:13px;color:#111827;">${dateLocal}</div>
              </div>
            </div>
          </div>

          <!-- Action principale : signaler -->
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 12px;font-size:14px;color:#991b1b;font-weight:600;">
              ⚠ Vous ne reconnaissez pas cette connexion ?
            </p>
            <p style="margin:0 0 16px;font-size:13px;color:#7f1d1d;line-height:1.4;">
              Cliquez sur le bouton ci-dessous pour révoquer immédiatement cette session et signaler la tentative comme suspecte.
            </p>
            <a href="${notMeUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
              Ce n'était pas moi
            </a>
          </div>

          <!-- Si c'est moi -->
          <p style="margin:20px 0 0;font-size:12px;color:#6b7280;text-align:center;line-height:1.4;">
            Si c'est bien vous, vous pouvez marquer cet appareil comme « de confiance » depuis votre
            <a href="${sessionsUrl}" style="color:#0F2D52;">profil &gt; Sessions</a> pour éviter de futures alertes.
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

          <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.5;">
            Cet email a été envoyé automatiquement par le portail VNK pour vous tenir informé des activités de votre compte.
            Pour désactiver ces alertes, ouvrez <a href="${security}" style="color:#6b7280;">Profil &gt; Sécurité</a>.
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `Nouvelle connexion détectée sur votre compte VNK Automatisation

Appareil : ${input.browser} sur ${input.os}
IP : ${ipDisplay}
Localisation : ${location}
Date : ${dateLocal}

Si ce n'était pas vous, révoquez cette session immédiatement :
${notMeUrl}

Si c'était vous, ignorez ce message ou ajoutez l'appareil aux appareils de confiance depuis ${sessionsUrl}.`;

  return sendEmail({
    to: input.adminEmail,
    subject: `Nouvelle connexion détectée — ${input.browser} sur ${input.os}`,
    html,
    text,
  });
}
