// Seed les templates emails par défaut
// À lancer depuis prisma/seed.ts OU indépendamment via tsx
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEMPLATES = [
  {
    key: "tpl_new_quote",
    subject: "Nouveau devis {{quoteNumber}} de VNK Automatisation",
    bodyHtml: `<p>Bonjour {{clientName}},</p>
<p>Nous avons le plaisir de vous transmettre un nouveau devis :</p>
<p><strong>{{quoteNumber}} — {{quoteTitle}}</strong><br>
Montant total : <strong>{{amountTtc}} $ TTC</strong></p>
<p>Ce devis est valide jusqu'au {{expiryDate}}.</p>
<p>Connectez-vous à votre portail pour le consulter et l'accepter : <a href="{{portalUrl}}">{{portalUrl}}</a></p>
<p>Cordialement,<br>L'équipe VNK Automatisation</p>`,
    variables: { clientName: "Nom du client", quoteNumber: "D-2026-001", quoteTitle: "Titre du devis", amountTtc: "4 024,13 $", expiryDate: "2026-04-30", portalUrl: "https://vnk.ca/portail" },
  },
  {
    key: "tpl_new_invoice",
    subject: "Facture {{invoiceNumber}} — VNK Automatisation",
    bodyHtml: `<p>Bonjour {{clientName}},</p>
<p>Vous trouverez ci-joint la facture <strong>{{invoiceNumber}}</strong> d'un montant de <strong>{{amountTtc}} $ TTC</strong>.</p>
<p>Date d'échéance : {{dueDate}}</p>
<p>Vous pouvez la payer directement via votre portail client.</p>`,
    variables: { clientName: "Nom", invoiceNumber: "F-2026-001", amountTtc: "2 012,06 $", dueDate: "2026-04-15" },
  },
  {
    key: "tpl_invoice_paid",
    subject: "Paiement reçu — {{invoiceNumber}}",
    bodyHtml: `<p>Bonjour {{clientName}},</p>
<p>Nous confirmons la réception du paiement de <strong>{{amountTtc}} $</strong> pour la facture {{invoiceNumber}}.</p>
<p>Merci pour votre confiance !</p>`,
    variables: { clientName: "Nom", invoiceNumber: "F-2026-001", amountTtc: "2 012,06 $" },
  },
  {
    key: "tpl_new_contract",
    subject: "Contrat à signer — {{contractNumber}}",
    bodyHtml: `<p>Bonjour {{clientName}},</p>
<p>Un nouveau contrat est prêt à être signé : <strong>{{contractTitle}}</strong>.</p>
<p>Connectez-vous à votre portail pour le consulter et le signer.</p>`,
    variables: { clientName: "Nom", contractNumber: "CT-2026-001", contractTitle: "Contrat de service" },
  },
  {
    key: "tpl_contract_signed",
    subject: "Contrat signé — {{contractNumber}}",
    bodyHtml: `<p>Bonjour {{clientName}},</p>
<p>Le contrat {{contractNumber}} a été signé par les deux parties.</p>
<p>Vous pouvez le télécharger depuis votre portail.</p>`,
    variables: { clientName: "Nom", contractNumber: "CT-2026-001" },
  },
  {
    key: "tpl_new_document",
    subject: "Nouveau document disponible — {{documentTitle}}",
    bodyHtml: `<p>Bonjour {{clientName}},</p>
<p>Un nouveau document est disponible sur votre portail : <strong>{{documentTitle}}</strong>.</p>`,
    variables: { clientName: "Nom", documentTitle: "Rapport diagnostic" },
  },
  {
    key: "tpl_new_message",
    subject: "Nouveau message de VNK Automatisation",
    bodyHtml: `<p>Bonjour {{clientName}},</p>
<p>Vous avez reçu un nouveau message sur votre portail.</p>
<blockquote>{{messageExcerpt}}</blockquote>`,
    variables: { clientName: "Nom", messageExcerpt: "Extrait du message…" },
  },
  {
    key: "tpl_mandate_update",
    subject: "Mise à jour de votre mandat {{mandateTitle}}",
    bodyHtml: `<p>Bonjour {{clientName}},</p>
<p>Votre mandat <strong>{{mandateTitle}}</strong> est maintenant à <strong>{{progress}}%</strong>.</p>
<p>{{notes}}</p>`,
    variables: { clientName: "Nom", mandateTitle: "Support PLC", progress: "65", notes: "Intervention en cours" },
  },
  {
    key: "tpl_admin_new_client",
    subject: "Nouveau client inscrit — {{clientName}}",
    bodyHtml: `<p>Un nouveau client vient de s'inscrire :</p>
<p><strong>{{clientName}}</strong><br>{{companyName}}<br>{{email}}</p>`,
    variables: { clientName: "Nom", companyName: "Entreprise", email: "email@example.com" },
  },
  {
    key: "tpl_admin_contact_form",
    subject: "Nouveau message du formulaire de contact",
    bodyHtml: `<p><strong>{{name}}</strong> ({{email}}) vient d'envoyer un message :</p>
<blockquote>{{message}}</blockquote>
<p><strong>Service :</strong> {{service}}<br>
<strong>Marque PLC :</strong> {{plcBrand}}</p>`,
    variables: { name: "Nom", email: "email", message: "Message", service: "Support PLC", plcBrand: "Siemens" },
  },
];

export async function seedEmailTemplates() {
  for (const tpl of TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key_locale: { key: tpl.key, locale: "fr" } },
      update: {},
      create: {
        key: tpl.key,
        locale: "fr",
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        variables: tpl.variables,
      },
    });
  }
  console.log(`✓ ${TEMPLATES.length} email templates seedés (fr)`);
}

// Standalone execution
if (require.main === module) {
  seedEmailTemplates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
