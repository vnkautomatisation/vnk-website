/* ============================================================
   VNK Automatisation Inc. — Module Email
   Templates transactionnels professionnels
   ============================================================ */

const nodemailer = require('nodemailer');

function _getTransporter() {
    if (process.env.EMAIL_HOST) {
        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
    }
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
        });
    }
    return null;
}

const FROM = process.env.EMAIL_FROM || '"VNK Automatisation Inc." <noreply@vnk.ca>';
const PORTAL_URL = process.env.APP_URL || 'https://vnk-website-production.up.railway.app';

function _fmtCA(n) { return parseFloat(n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' }); }
function _fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }); }

function _layout(content, preheader) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#EEF2F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
.wrap{max-width:600px;margin:0 auto;padding:28px 16px}
.card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.09)}
.hdr{background:linear-gradient(135deg,#0B2545 0%,#1B4F8A 100%);padding:26px 36px}
.brand{display:flex;align-items:center;gap:12px}
.brand-box{width:38px;height:38px;background:rgba(255,255,255,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.brand-name{color:#fff;font-size:17px;font-weight:700;letter-spacing:-0.3px}
.brand-tag{color:#93C4E0;font-size:9.5px;letter-spacing:1.8px;text-transform:uppercase;margin-top:2px}
.hero{padding:30px 36px 22px;border-bottom:1px solid #F1F5F9}
.hero-icon{width:50px;height:50px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.hero h1{font-size:21px;font-weight:700;color:#0F172A;line-height:1.3;margin-bottom:7px}
.hero p{font-size:14.5px;color:#475569;line-height:1.65}
.body{padding:26px 36px}
.stitle{font-size:10.5px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:11px}
.icard{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px;margin-bottom:18px}
.irow{display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid #EEF2F7}
.irow:last-child{border-bottom:none;padding-bottom:0}
.irow:first-child{padding-top:0}
.ilbl{font-size:11.5px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.4px;padding-right:16px;padding-top:1px;flex-shrink:0}
.ival{font-size:13.5px;color:#1E293B;font-weight:500;text-align:right}
.arow{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #EEF2F7}
.arow:last-child{border-bottom:none}
.arow.tot{padding-top:13px;margin-top:2px}
.albl{font-size:13px;color:#64748B}
.aval{font-size:13px;color:#1E293B;font-weight:500}
.arow.tot .albl{font-size:15px;font-weight:700;color:#0F172A}
.arow.tot .aval{font-size:18px;font-weight:800;color:#0F2D52}
.cta{text-align:center;padding:6px 0 10px}
.btn{display:inline-block;padding:13px 30px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.2px}
.btn-blue{background:#1B4F8A;color:#fff}
.btn-green{background:#16A34A;color:#fff}
.btn-out{background:#fff;color:#1B4F8A;border:2px solid #1B4F8A}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.3px}
.b-warn{background:#FEF3C7;color:#92400E}
.b-ok{background:#DCFCE7;color:#14532D}
.b-blue{background:#DBEAFE;color:#1E3A8A}
.mbox{background:#F0F9FF;border-left:3px solid #0EA5E9;border-radius:0 8px 8px 0;padding:13px 16px;margin:14px 0;font-size:13.5px;color:#0C4A6E;line-height:1.6}
.mbox-ok{background:#F0FDF4;border-left-color:#16A34A;color:#14532D}
.sigrow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #EEF2F7}
.sigrow:last-child{border-bottom:none}
.sigbadge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:600}
.sigok{background:#DCFCE7;color:#14532D}
.sigwait{background:#FEF3C7;color:#92400E}
.ftr{padding:22px 36px;text-align:center;border-top:1px solid #F1F5F9}
.ftr-name{font-size:13px;font-weight:700;color:#CBD5E1;margin-bottom:5px}
.ftr p{font-size:11.5px;color:#94A3B8;line-height:1.7}
.ftr a{color:#64748B;text-decoration:none}
</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ''}
<div class="wrap">
<div class="card">
<div class="hdr">
  <div class="brand">
    <div class="brand-box">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7FC8F8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    </div>
    <div>
      <div class="brand-name">VNK Automatisation Inc.</div>
      <div class="brand-tag">Value · Network · Knowledge</div>
    </div>
  </div>
</div>
${content}
<div class="ftr">
  <div class="ftr-name">VNK Automatisation Inc.</div>
  <p>Questions ? <a href="mailto:${process.env.ADMIN_EMAIL || 'contact@vnk.ca'}">Contactez-nous</a> &nbsp;·&nbsp; <a href="${PORTAL_URL}">Portail client</a></p>
</div>
</div>
</div>
</body>
</html>`;
}

// ─── Templates ───────────────────────────────────────────────

function tplNewQuote(client, q) {
    return {
        subject: `Nouveau devis ${q.quote_number} — ${_fmtCA(q.amount_ttc)} | VNK Automatisation`,
        html: _layout(`
<div class="hero">
  <div class="hero-icon" style="background:#EFF6FF"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
  <h1>Nouveau devis disponible</h1>
  <p>Bonjour ${client.full_name},<br>VNK Automatisation a préparé un devis pour vous. Consultez-le et acceptez-le depuis votre portail.</p>
</div>
<div class="body">
  <p class="stitle">Devis</p>
  <div class="icard">
    <div class="irow"><span class="ilbl">Numéro</span><span class="ival">${q.quote_number}</span></div>
    <div class="irow"><span class="ilbl">Titre</span><span class="ival">${q.title}</span></div>
    <div class="irow"><span class="ilbl">Valide jusqu'au</span><span class="ival">${_fmtDate(q.expiry_date)}</span></div>
    <div class="irow"><span class="ilbl">Statut</span><span class="ival"><span class="badge b-warn">En attente</span></span></div>
  </div>
  <div class="icard">
    <div class="arow"><span class="albl">Montant HT</span><span class="aval">${_fmtCA(q.amount_ht)}</span></div>
    <div class="arow"><span class="albl">TPS (5 %)</span><span class="aval">${_fmtCA(q.tps_amount)}</span></div>
    <div class="arow"><span class="albl">TVQ (9,975 %)</span><span class="aval">${_fmtCA(q.tvq_amount)}</span></div>
    <div class="arow tot"><span class="albl">Total TTC</span><span class="aval">${_fmtCA(q.amount_ttc)}</span></div>
  </div>
  ${q.description ? `<div class="mbox">${q.description}</div>` : ''}
  <div class="cta"><a href="${PORTAL_URL}/portail.html" class="btn btn-blue">Consulter et accepter →</a></div>
</div>`, `Devis ${q.quote_number} — ${_fmtCA(q.amount_ttc)} disponible.`)
    };
}

function tplNewContract(client, ct) {
    return {
        subject: `Contrat ${ct.contract_number} — Signature requise | VNK Automatisation`,
        html: _layout(`
<div class="hero">
  <div class="hero-icon" style="background:#F5F3FF"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
  <h1>Contrat prêt à signer</h1>
  <p>Bonjour ${client.full_name},<br>Votre contrat de service est disponible dans votre portail. Votre signature électronique est requise pour démarrer les travaux.</p>
</div>
<div class="body">
  <div class="icard">
    <div class="irow"><span class="ilbl">Numéro</span><span class="ival">${ct.contract_number}</span></div>
    <div class="irow"><span class="ilbl">Titre</span><span class="ival">${ct.title}</span></div>
    <div class="irow"><span class="ilbl">Date</span><span class="ival">${_fmtDate(ct.created_at)}</span></div>
    <div class="irow"><span class="ilbl">Statut</span><span class="ival"><span class="badge b-warn">Signature requise</span></span></div>
  </div>
  <div class="icard">
    <p class="stitle">Signatures</p>
    <div class="sigrow"><span class="ilbl">VNK Automatisation</span><span class="sigbadge ${ct.admin_signed_at ? 'sigok' : 'sigwait'}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>${ct.admin_signed_at ? 'Signé' : 'En attente'}</span></div>
    <div class="sigrow"><span class="ilbl">Vous</span><span class="sigbadge sigwait"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Signature requise</span></div>
  </div>
  <div class="cta"><a href="${PORTAL_URL}/portail.html" class="btn btn-blue">Signer le contrat →</a></div>
  <div class="mbox">Une fois signé par les deux parties, votre facture sera générée automatiquement.</div>
</div>`, `Contrat ${ct.contract_number} prêt — votre signature est requise.`)
    };
}

function tplContractSigned(client, ct) {
    return {
        subject: `Contrat ${ct.contract_number} signé — Travaux confirmés | VNK Automatisation`,
        html: _layout(`
<div class="hero">
  <div class="hero-icon" style="background:#DCFCE7"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
  <h1>Contrat signé — Travaux confirmés</h1>
  <p>Bonjour ${client.full_name},<br>Votre contrat a été signé par les deux parties. Nous sommes officiellement engagés pour ce projet.</p>
</div>
<div class="body">
  <div class="icard">
    <div class="irow"><span class="ilbl">Contrat</span><span class="ival">${ct.contract_number}</span></div>
    <div class="irow"><span class="ilbl">Titre</span><span class="ival">${ct.title}</span></div>
    <div class="irow"><span class="ilbl">Signé le</span><span class="ival">${_fmtDate(ct.signed_at || new Date())}</span></div>
    <div class="irow"><span class="ilbl">Statut</span><span class="ival"><span class="badge b-ok">Signé</span></span></div>
  </div>
  <div class="icard">
    <p class="stitle">Signatures confirmées</p>
    <div class="sigrow"><span class="ilbl">VNK Automatisation</span><span class="sigbadge sigok"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Signé</span></div>
    <div class="sigrow"><span class="ilbl">Vous</span><span class="sigbadge sigok"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Signé</span></div>
  </div>
  <div class="cta"><a href="${PORTAL_URL}/portail.html" class="btn btn-green">Voir mon portail →</a></div>
  <div class="mbox mbox-ok">Votre facture est disponible dans votre portail. Réglez-la en ligne de manière sécurisée.</div>
</div>`, `Contrat ${ct.contract_number} signé par les deux parties.`)
    };
}

function tplNewInvoice(client, inv) {
    const isOverdue = inv.due_date && new Date(inv.due_date) < new Date();
    return {
        subject: `Facture ${inv.invoice_number} — ${_fmtCA(inv.amount_ttc)} à régler | VNK Automatisation`,
        html: _layout(`
<div class="hero">
  <div class="hero-icon" style="background:#FFF7ED"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
  <h1>Nouvelle facture à régler</h1>
  <p>Bonjour ${client.full_name},<br>Votre facture est disponible. Réglez-la de manière sécurisée depuis votre portail client.</p>
</div>
<div class="body">
  <div class="icard">
    <div class="irow"><span class="ilbl">Numéro</span><span class="ival">${inv.invoice_number}</span></div>
    <div class="irow"><span class="ilbl">Titre</span><span class="ival">${inv.title || 'Service VNK'}</span></div>
    <div class="irow"><span class="ilbl">Émise le</span><span class="ival">${_fmtDate(inv.created_at)}</span></div>
    <div class="irow"><span class="ilbl">Échéance</span><span class="ival" style="color:${isOverdue ? '#DC2626' : 'inherit'}">${_fmtDate(inv.due_date)}</span></div>
  </div>
  <div class="icard">
    <div class="arow"><span class="albl">Montant HT</span><span class="aval">${_fmtCA(inv.amount_ht)}</span></div>
    <div class="arow"><span class="albl">TPS (5 %)</span><span class="aval">${_fmtCA(inv.tps_amount)}</span></div>
    <div class="arow"><span class="albl">TVQ (9,975 %)</span><span class="aval">${_fmtCA(inv.tvq_amount)}</span></div>
    <div class="arow tot"><span class="albl">Total à payer</span><span class="aval">${_fmtCA(inv.amount_ttc)}</span></div>
  </div>
  <div class="cta"><a href="${PORTAL_URL}/portail.html" class="btn btn-blue">Payer maintenant →</a></div>
  <div class="mbox">Paiement sécurisé par Stripe. Visa, Mastercard acceptés.</div>
</div>`, `Facture ${inv.invoice_number} — ${_fmtCA(inv.amount_ttc)} — Échéance ${_fmtDate(inv.due_date)}`)
    };
}

function tplInvoicePaid(client, inv) {
    return {
        subject: `Paiement reçu — Facture ${inv.invoice_number} | VNK Automatisation`,
        html: _layout(`
<div class="hero">
  <div class="hero-icon" style="background:#DCFCE7"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
  <h1>Paiement reçu — Merci !</h1>
  <p>Bonjour ${client.full_name},<br>Votre paiement a bien été traité. Voici votre récapitulatif.</p>
</div>
<div class="body">
  <div class="icard">
    <div class="irow"><span class="ilbl">Facture</span><span class="ival">${inv.invoice_number}</span></div>
    <div class="irow"><span class="ilbl">Montant payé</span><span class="ival" style="font-weight:800;color:#0F2D52">${_fmtCA(inv.amount_ttc)}</span></div>
    <div class="irow"><span class="ilbl">Payée le</span><span class="ival">${_fmtDate(inv.paid_at || new Date())}</span></div>
    <div class="irow"><span class="ilbl">Statut</span><span class="ival"><span class="badge b-ok">Payée</span></span></div>
    ${inv.stripe_payment_intent_id ? `<div class="irow"><span class="ilbl">Référence</span><span class="ival" style="font-size:11px;color:#94A3B8">${inv.stripe_payment_intent_id}</span></div>` : ''}
  </div>
  <div class="cta"><a href="${PORTAL_URL}/portail.html" class="btn btn-green">Voir le reçu →</a></div>
  <div class="mbox mbox-ok">Votre reçu est disponible dans votre portail, section Factures.</div>
</div>`, `Paiement de ${_fmtCA(inv.amount_ttc)} reçu pour la facture ${inv.invoice_number}.`)
    };
}

function tplNewDocument(client, doc) {
    const iconColors = { pdf: '#DC2626', docx: '#2563EB', xlsx: '#16A34A', png: '#7C3AED', jpg: '#7C3AED' };
    const ic = iconColors[doc.file_type] || '#64748B';
    return {
        subject: `Nouveau document : ${doc.title} | VNK Automatisation`,
        html: _layout(`
<div class="hero">
  <div class="hero-icon" style="background:#F8FAFC"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ic}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg></div>
  <h1>Nouveau document disponible</h1>
  <p>Bonjour ${client.full_name},<br>VNK Automatisation a déposé un nouveau document dans votre portail client.</p>
</div>
<div class="body">
  <div class="icard">
    <div class="irow"><span class="ilbl">Document</span><span class="ival">${doc.title}</span></div>
    ${doc.category ? `<div class="irow"><span class="ilbl">Catégorie</span><span class="ival">${doc.category}</span></div>` : ''}
    ${doc.file_type ? `<div class="irow"><span class="ilbl">Format</span><span class="ival">${doc.file_type.toUpperCase()}</span></div>` : ''}
    <div class="irow"><span class="ilbl">Déposé le</span><span class="ival">${_fmtDate(new Date())}</span></div>
  </div>
  ${doc.description ? `<div class="mbox">${doc.description}</div>` : ''}
  <div class="cta"><a href="${PORTAL_URL}/portail.html" class="btn btn-blue">Consulter le document →</a></div>
</div>`, `Nouveau document disponible dans votre portail : ${doc.title}`)
    };
}

function tplNewMessage(client, msg) {
    return {
        subject: `Nouveau message de VNK Automatisation`,
        html: _layout(`
<div class="hero">
  <div class="hero-icon" style="background:#F0F9FF"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
  <h1>Nouveau message de VNK</h1>
  <p>Bonjour ${client.full_name},<br>Vous avez reçu un message de notre équipe dans votre portail.</p>
</div>
<div class="body">
  <div class="mbox">${msg.content || '—'}</div>
  <div class="cta"><a href="${PORTAL_URL}/portail.html" class="btn btn-out">Répondre depuis le portail →</a></div>
</div>`, `Nouveau message de VNK : ${(msg.content || '').substring(0, 60)}`)
    };
}

function tplMandateUpdate(client, mandate) {
    return {
        subject: `Mise à jour du mandat : ${mandate.title} | VNK Automatisation`,
        html: _layout(`
<div class="hero">
  <div class="hero-icon" style="background:#F0FDF4"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
  <h1>Mise à jour de votre mandat</h1>
  <p>Bonjour ${client.full_name},<br>L'avancement de votre mandat a été mis à jour.</p>
</div>
<div class="body">
  <div class="icard">
    <div class="irow"><span class="ilbl">Mandat</span><span class="ival">${mandate.title}</span></div>
    <div class="irow"><span class="ilbl">Progression</span><span class="ival">${mandate.progress || 0} %</span></div>
    <div class="irow"><span class="ilbl">Statut</span><span class="ival"><span class="badge b-ok">${mandate.status || 'Actif'}</span></span></div>
    ${mandate.notes ? `<div class="irow"><span class="ilbl">Notes</span><span class="ival">${mandate.notes}</span></div>` : ''}
  </div>
  <div class="cta"><a href="${PORTAL_URL}/portail.html" class="btn btn-blue">Suivre l'avancement →</a></div>
</div>`, `Mandat "${mandate.title}" — ${mandate.progress || 0}% complété.`)
    };
}

// ─── Envoi ────────────────────────────────────────────────────
async function sendEmail(to, tpl) {
    const transporter = _getTransporter();
    if (!transporter) {
        console.warn('[email] Non configuré — ajoutez EMAIL_HOST/EMAIL_USER/EMAIL_PASS dans .env');
        return false;
    }
    try {
        await transporter.sendMail({ from: FROM, to, subject: tpl.subject, html: tpl.html });
        console.log(`[email] ✓ ${to} — ${tpl.subject}`);
        return true;
    } catch (e) {
        console.error(`[email] ✗ ${to}:`, e.message);
        return false;
    }
}

async function sendEmailToClient(pool, clientId, tpl) {
    try {
        const r = await pool.query('SELECT email, full_name FROM clients WHERE id=$1', [clientId]);
        if (!r.rows.length) return false;
        return sendEmail(r.rows[0].email, tpl);
    } catch (e) { console.warn('[email] client lookup error:', e.message); return false; }
}

module.exports = { sendEmail, sendEmailToClient, tplNewQuote, tplNewContract, tplContractSigned, tplNewInvoice, tplInvoicePaid, tplNewDocument, tplNewMessage, tplMandateUpdate };