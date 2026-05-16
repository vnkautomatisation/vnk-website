// Email service — SendGrid API en priorité (si configuré), sinon SMTP via nodemailer
import "server-only";
import { getSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { getIntegrationCredentials } from "@/lib/integrations/credentials";

type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

type EmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  bcc?: string;
  attachments?: EmailAttachment[];
};

export async function sendEmail(params: EmailParams) {
  // ─── 1. Tenter SendGrid si l'intégration est activée ───
  const sgCreds = await getIntegrationCredentials("sendgrid");
  if (sgCreds?.api_key && sgCreds?.from_email) {
    return sendViaSendGrid(params, sgCreds);
  }

  // ─── 2. Fallback SMTP ───
  const host = await getSetting<string>("emails", "smtp_host");
  if (!host) {
    console.warn("[email] Aucun fournisseur courriel configuré — email ignoré");
    return { ok: false, error: "Courriel non configuré (ni SendGrid ni SMTP)" };
  }

  const port = Number((await getSetting<number>("emails", "smtp_port")) ?? 587);
  const user = await getSetting<string>("emails", "smtp_user");
  const password = await getSetting<string>("emails", "smtp_password");
  const secure = Boolean(await getSetting<boolean>("emails", "smtp_secure"));
  const from = await getSetting<string>("emails", "from_email");
  const fromName = await getSetting<string>("emails", "from_name");
  const replyTo = await getSetting<string>("emails", "reply_to");
  const bccAdmin = Boolean(
    await getSetting<boolean>("emails", "bcc_admin_on_outgoing")
  );

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
    });

    await transporter.sendMail({
      from: `"${fromName ?? "VNK"}" <${from}>`,
      to: params.to,
      bcc: bccAdmin ? replyTo ?? undefined : params.bcc,
      replyTo: replyTo ?? undefined,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments,
    });

    return { ok: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}

// ═══════════════════════════════════════════════════════════
// SendGrid v3 API
// ═══════════════════════════════════════════════════════════

async function sendViaSendGrid(
  params: EmailParams,
  creds: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const personalizations: Record<string, unknown>[] = [{
      to: [{ email: params.to }],
      ...(params.bcc ? { bcc: [{ email: params.bcc }] } : {}),
    }];

    const payload: Record<string, unknown> = {
      personalizations,
      from: { email: creds.from_email, name: creds.from_name ?? "VNK" },
      subject: params.subject,
      content: [
        ...(params.text ? [{ type: "text/plain", value: params.text }] : []),
        { type: "text/html", value: params.html },
      ],
    };

    if (params.attachments?.length) {
      payload.attachments = params.attachments.map((a) => ({
        filename: a.filename,
        type: a.contentType ?? "application/octet-stream",
        content: typeof a.content === "string"
          ? Buffer.from(a.content).toString("base64")
          : a.content.toString("base64"),
      }));
    }

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 202 || res.ok) {
      return { ok: true };
    }
    const errText = await res.text();
    return { ok: false, error: `SendGrid ${res.status} : ${errText}` };
  } catch (err) {
    console.error("[email] SendGrid send failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Erreur SendGrid" };
  }
}

// ═══════════════════════════════════════════════════════════
// Template renderer (avec variables)
// ═══════════════════════════════════════════════════════════

export async function renderEmailTemplate(
  templateKey: string,
  variables: Record<string, string>,
  locale = "fr"
) {
  const tpl = await prisma.emailTemplate.findUnique({
    where: { key_locale: { key: templateKey, locale } },
  });

  if (!tpl || !tpl.isEnabled) {
    return null;
  }

  // Remplacement simple {{varName}} → valeur
  const replace = (str: string) =>
    str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => variables[name] ?? "");

  return {
    subject: replace(tpl.subject),
    html: replace(tpl.bodyHtml),
    text: tpl.bodyText ? replace(tpl.bodyText) : undefined,
  };
}

export async function sendTemplate(
  to: string,
  templateKey: string,
  variables: Record<string, string>,
  locale = "fr"
) {
  const rendered = await renderEmailTemplate(templateKey, variables, locale);
  if (!rendered) {
    return { ok: false, error: "Template introuvable" };
  }
  return sendEmail({ to, ...rendered });
}
