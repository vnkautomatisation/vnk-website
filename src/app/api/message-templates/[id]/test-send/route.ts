// POST /api/message-templates/[id]/test-send — envoie un email test au admin courant
// Body : { sampleClient?: { name?, company?, email? } } pour personnaliser les variables
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/services/email";
import { renderChatEmail } from "@/lib/services/email-message-template";
import { expandTemplateVariables, markdownToHtml } from "@/lib/template-variables";

const schema = z.object({
  sampleClient: z.object({
    name: z.string().optional(),
    company: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin" || !session.user.email) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const tpl = await prisma.messageTemplate.findUnique({ where: { id: Number(id) } });
  if (!tpl) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });

  const sample = parsed.data.sampleClient ?? {};
  const expanded = expandTemplateVariables(tpl.body, {
    clientName: sample.name ?? "Jean Tremblay",
    clientCompany: sample.company ?? "ACME Inc.",
    clientEmail: sample.email ?? "jean@acme.com",
    adminName: session.user.name ?? session.user.email,
    adminEmail: session.user.email,
  });

  const subject = tpl.emailSubject
    ? expandTemplateVariables(tpl.emailSubject, {
        clientName: sample.name ?? "Jean Tremblay",
        clientCompany: sample.company ?? "ACME Inc.",
      })
    : `[TEST] ${tpl.title}`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://vnkautomatisation.ca";
  const rendered = renderChatEmail({
    clientName: sample.name ?? "Jean Tremblay",
    content: markdownToHtml(expanded),
    portalUrl: `${baseUrl}/portail`,
  });

  // Pour le test on bypass le markdown -> HTML inject directement
  const customHtml = rendered.html.replace(/(<div>)([\s\S]*?)(<\/div>)/, (_m, open, _content, close) => `${open}${markdownToHtml(expanded)}${close}`);

  const result = await sendEmail({
    to: session.user.email,
    subject: `[TEST] ${subject}`,
    html: customHtml,
    text: expanded,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Envoi SMTP échoué" }, { status: 500 });
  }
  return NextResponse.json({ success: true, sentTo: session.user.email });
}
