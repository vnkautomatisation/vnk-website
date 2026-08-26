// POST /api/message-templates/seed-defaults — installe les 15 templates de base
// Idempotent : ne re-cree pas un template dont le shortcut existe deja
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const DEFAULTS: Array<{
  shortcut: string;
  title: string;
  body: string;
  category: string;
  defaultChannel?: "chat" | "email" | "both";
  emailSubject?: string;
  appendSignature?: boolean;
  tags?: string[];
}> = [
  // ─── SALUTATIONS / ACCUEIL ─────────────────────────────────
  {
    shortcut: "bienvenue",
    title: "Bienvenue (premier contact)",
    body: "Bonjour {{client_first_name}},\n\nBienvenue sur le portail VNK Automatisation !\n\nNous sommes ravis de vous compter parmi nos clients{{#if client_company}} chez {{client_company}}{{/if}}. Vous trouverez dans votre portail :\n\n- Vos devis et factures\n- Vos contrats\n- L'historique de nos échanges\n- Un calendrier pour réserver des rendez-vous\n\nN'hésitez pas à m'écrire si vous avez la moindre question.\n\nCordialement,\n{{admin_name}}",
    category: "greetings",
    defaultChannel: "both",
    emailSubject: "Bienvenue chez VNK Automatisation",
    appendSignature: true,
    tags: ["onboarding"],
  },
  {
    shortcut: "salut",
    title: "Salutation rapide",
    body: "Bonjour {{client_first_name}}, comment puis-je vous aider aujourd'hui ?",
    category: "greetings",
    defaultChannel: "chat",
  },
  {
    shortcut: "comment_aider",
    title: "Comment vous aider ?",
    body: "Bonjour {{client_first_name}},\n\nMerci de votre visite. Comment puis-je vous aider aujourd'hui ? N'hésitez pas à me décrire votre besoin et je reviendrai vers vous rapidement.",
    category: "greetings",
    defaultChannel: "chat",
  },
  // ─── DEVIS ──────────────────────────────────────────────────
  {
    shortcut: "devis_pret",
    title: "Devis prêt à signer",
    body: "Bonjour {{client_first_name}},\n\nVotre devis {{#if quote_number}}**{{quote_number}}** {{/if}}est prêt et disponible dans votre portail :\n\n{{portal_url}}/devis\n\n{{#if quote_amount}}Montant : **{{quote_amount}}**\n\n{{/if}}Vous pouvez le consulter, télécharger le PDF et le signer électroniquement directement en ligne.\n\nN'hésitez pas si vous avez des questions.",
    category: "billing",
    defaultChannel: "both",
    emailSubject: "Votre devis {{quote_number}} est prêt",
    tags: ["devis"],
  },
  {
    shortcut: "devis_relance",
    title: "Relance devis (J+7)",
    body: "Bonjour {{client_first_name}},\n\nJe me permets de revenir vers vous concernant le devis {{quote_number}} envoyé le {{date_short}}.\n\nAvez-vous eu l'occasion d'y jeter un œil ? Je reste disponible pour en discuter, répondre à vos questions ou ajuster la proposition si besoin.\n\nBonne journée.",
    category: "followup",
    defaultChannel: "both",
    emailSubject: "Relance — devis {{quote_number}}",
    tags: ["devis", "relance"],
  },
  {
    shortcut: "devis_accepte",
    title: "Merci — devis accepté",
    body: "Bonjour {{client_first_name}},\n\nMerci d'avoir accepté notre devis {{quote_number}} ! Le contrat correspondant a été généré automatiquement et est prêt à être signé dans votre portail.\n\nDès la signature complétée, nous démarrons l'exécution. Au plaisir de collaborer avec vous{{#if client_company}} chez {{client_company}}{{/if}}.",
    category: "greetings",
    defaultChannel: "both",
    emailSubject: "Merci — devis accepté",
    tags: ["devis", "remerciement"],
  },
  // ─── FACTURES ───────────────────────────────────────────────
  {
    shortcut: "facture_envoi",
    title: "Facture émise",
    body: "Bonjour {{client_first_name}},\n\nVotre facture {{invoice_number}} d'un montant de **{{invoice_amount}}** est disponible dans votre portail :\n\n{{portal_url}}/factures\n\nÉchéance de paiement : **{{invoice_due_date}}**\n\nVous pouvez régler en ligne par carte ou par virement Interac. Merci !",
    category: "billing",
    defaultChannel: "both",
    emailSubject: "Facture {{invoice_number}} disponible",
    tags: ["facture"],
  },
  {
    shortcut: "rappel_paiement",
    title: "Rappel paiement",
    body: "Bonjour {{client_first_name}},\n\nUn petit rappel amical : la facture {{invoice_number}} d'un montant de {{invoice_amount}} arrive à échéance le {{invoice_due_date}}.\n\nVous pouvez la régler facilement via votre portail :\n\n{{portal_url}}/factures\n\nMerci pour votre attention.",
    category: "followup",
    defaultChannel: "both",
    emailSubject: "Rappel — facture {{invoice_number}}",
    tags: ["facture", "rappel"],
  },
  {
    shortcut: "merci_paiement",
    title: "Merci — paiement reçu",
    body: "Bonjour {{client_first_name}},\n\nMerci ! Votre paiement de {{invoice_amount}} pour la facture {{invoice_number}} a bien été reçu.\n\nUn reçu officiel a été ajouté à vos documents.\n\nÀ bientôt !",
    category: "billing",
    defaultChannel: "both",
    emailSubject: "Paiement reçu — merci !",
    tags: ["facture", "remerciement"],
  },
  // ─── CONTRATS ───────────────────────────────────────────────
  {
    shortcut: "contrat_signer",
    title: "Contrat à signer",
    body: "Bonjour {{client_first_name}},\n\nVotre contrat {{contract_number}} est prêt à être signé électroniquement dans votre portail :\n\n{{portal_url}}/contrats\n\nLa signature est rapide et sécurisée. Une fois les deux parties signées, le projet démarre officiellement.",
    category: "billing",
    defaultChannel: "both",
    emailSubject: "Contrat à signer — {{contract_number}}",
    tags: ["contrat"],
  },
  // ─── RENDEZ-VOUS ────────────────────────────────────────────
  {
    shortcut: "rdv_confirme",
    title: "Rendez-vous confirmé",
    body: "Bonjour {{client_first_name}},\n\nVotre rendez-vous est confirmé pour le **{{appointment_date}} à {{appointment_time}}**.\n\nSi vous avez besoin de modifier l'horaire, vous pouvez le faire depuis votre portail :\n\n{{portal_url}}/rendez-vous\n\nÀ très bientôt !",
    category: "scheduling",
    defaultChannel: "both",
    emailSubject: "Rendez-vous confirmé — {{appointment_date}}",
    tags: ["rdv"],
  },
  {
    shortcut: "rdv_rappel",
    title: "Rappel rendez-vous (J-1)",
    body: "Bonjour {{client_first_name}},\n\nPetit rappel : nous avons rendez-vous **demain {{tomorrow}} à {{appointment_time}}**.\n\nÀ demain !",
    category: "scheduling",
    defaultChannel: "both",
    emailSubject: "Rappel rendez-vous demain",
    tags: ["rdv", "rappel"],
  },
  // ─── TECHNIQUE ──────────────────────────────────────────────
  {
    shortcut: "investigation",
    title: "Investigation en cours",
    body: "Bonjour {{client_first_name}},\n\nJ'ai bien reçu votre demande et je commence l'investigation. Je reviens vers vous d'ici 24h avec un diagnostic et une proposition d'action.\n\nMerci pour votre patience.",
    category: "technical",
    defaultChannel: "chat",
    tags: ["technique"],
  },
  {
    shortcut: "intervention_planifiee",
    title: "Intervention planifiée",
    body: "Bonjour {{client_first_name}},\n\nL'intervention est planifiée pour le {{appointment_date}} à {{appointment_time}}.\n\nVeuillez prévoir :\n- Accès à l'automate / à l'équipement\n- Une connexion réseau si intervention à distance\n- Un contact disponible sur place\n\nÀ bientôt !",
    category: "scheduling",
    defaultChannel: "both",
    emailSubject: "Intervention planifiée — {{appointment_date}}",
    tags: ["technique", "rdv"],
  },
  // ─── FERMETURE ──────────────────────────────────────────────
  {
    shortcut: "bonne_journee",
    title: "Bonne journée",
    body: "Bonne {{day}} {{client_first_name}} ! N'hésitez pas si vous avez besoin de quoi que ce soit.",
    category: "greetings",
    defaultChannel: "chat",
  },
];

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("message_templates", "write")) {
    return forbiddenJson();
  }

  let created = 0, skipped = 0;
  for (const tpl of DEFAULTS) {
    const exists = await prisma.messageTemplate.findUnique({ where: { shortcut: tpl.shortcut } });
    if (exists) { skipped++; continue; }
    await prisma.messageTemplate.create({
      data: {
        shortcut: tpl.shortcut,
        title: tpl.title,
        body: tpl.body,
        category: tpl.category,
        defaultChannel: tpl.defaultChannel,
        emailSubject: tpl.emailSubject,
        appendSignature: tpl.appendSignature ?? false,
        tags: tpl.tags ?? undefined,
        locale: "fr",
        isSystem: true,
      },
    });
    created++;
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "message_templates",
    changes: { seeded: created, skipped },
  });

  return NextResponse.json({ success: true, created, skipped, total: DEFAULTS.length });
}
