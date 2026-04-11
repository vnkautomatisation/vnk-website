// Email service — SMTP via nodemailer, config depuis Settings
import "server-only";
import { getSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

type EmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  bcc?: string;
};

export async function sendEmail(params: EmailParams) {
  const host = await getSetting<string>("emails", "smtp_host");
  if (!host) {
    console.warn("[email] SMTP non configuré — email ignoré");
    return { ok: false, error: "SMTP non configuré" };
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
