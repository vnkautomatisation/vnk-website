// HTML template branded VNK pour les messages chat envoyes par email
import "server-only";
import { getTranslations } from "next-intl/server";

export async function renderChatEmail(opts: {
  clientName: string;
  content: string;
  attachmentNames?: string[];
  trackingPixelUrl?: string;
  portalUrl: string;
  locale?: string;
}): Promise<{ html: string; text: string }> {
  // Langue du destinataire, pas celle de l'expediteur.
  const locale = opts.locale?.split("-")[0] ?? "fr";
  const t = await getTranslations({ locale, namespace: "admin.emails" });
  const safeContent = (opts.content ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const attLines = (opts.attachmentNames ?? []).filter(Boolean);
  const attHtml = attLines.length > 0
    ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-left:3px solid #0F2D52;border-radius:4px"><p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;font-weight:600">${t("chat_pieces_jointes")}</p>${attLines.map((n) => `<p style="margin:2px 0;font-size:13px;color:#1e293b">📎 ${n}</p>`).join("")}<p style="margin:8px 0 0;font-size:11px;color:#64748b">${t("chat_connectez_vous_portail")}</p></div>`
    : "";

  const pixel = opts.trackingPixelUrl
    ? `<img src="${opts.trackingPixelUrl}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0" />`
    : "";

  const html = `<!DOCTYPE html> <html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VNK Automatisation</title></head> <body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1e293b"> <div style="max-width:600px;margin:0 auto;background:#ffffff"> <div style="background:linear-gradient(135deg,#0F2D52 0%,#15406d 50%,#0F2D52 100%);padding:24px;color:#ffffff"> <table style="width:100%"><tr> <td><h1 style="margin:0;font-size:20px;font-weight:700">VNK Automatisation</h1> <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">${t("chat_bonjour", { name: opts.clientName ?? t("chat_cher_client") })}</p></td> </tr></table> </div> <div style="padding:24px;font-size:15px;line-height:1.6"> <div>${safeContent}</div> ${attHtml} <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center"> <a href="${opts.portalUrl}" style="display:inline-block;background:#0F2D52;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600">${t("chat_ouvrir_le_portail")}</a> </div> </div> <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center"> <p style="margin:0">VNK Automatisation Inc. · automatisation industrielle B&amp;R, Allen-Bradley, Siemens</p> <p style="margin:4px 0 0">${t("chat_pour_repondre")}</p> </div> </div> ${pixel} </body></html>`;

  const text = [
    t("chat_bonjour", { name: opts.clientName ?? "" }),
    "",
    opts.content,
    attLines.length > 0 ? t("email_message_template_npieces_jointes_n_p0_nconnectez_vous_au_portail", { p0: attLines.map((n) => `  - ${n}`).join("\n") }) : "",
    "",
    t("chat_portail", { url: opts.portalUrl }),
    "",
    "—",
    "VNK Automatisation Inc.",
  ].filter(Boolean).join("\n");

  return { html, text };
}
