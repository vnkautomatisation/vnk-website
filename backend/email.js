/* ============================================================
   VNK Automatisation Inc. — Module Email v2.0
   Design premium — Stripe/Linear inspired
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
const ADMIN_PORTAL = (process.env.APP_URL || 'http://localhost:3000') + '/admin.html';

function _fmtCA(n) { return parseFloat(n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' }); }
function _fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }); }

// ── Shared CSS ───────────────────────────────────────────────
const _CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#F4F6F9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-text-size-adjust:100%;color:#1a1a2e}
  .wrap{max-width:620px;margin:0 auto;padding:32px 20px 48px}
  .card{background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.04)}
  /* Header */
  .hdr{background:#0B1E3D;padding:24px 32px;display:flex;align-items:center;gap:14px}
  .hdr-logo{width:40px;height:40px;background:#1B4F8A;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .hdr-name{color:#fff;font-size:15px;font-weight:700;letter-spacing:-0.3px}
  .hdr-tag{color:#6B9ECC;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;margin-top:2px}
  /* Event banner */
  .banner{padding:28px 32px 20px}
  .ev-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:14px}
  .banner h1{font-size:24px;font-weight:700;color:#0B1E3D;line-height:1.25;letter-spacing:-0.5px;margin-bottom:8px}
  .banner p{font-size:14px;color:#5A6880;line-height:1.65}
  /* Divider */
  .div{height:1px;background:#F0F2F5;margin:0 32px}
  /* Body */
  .body{padding:24px 32px}
  /* Detail card */
  .dc{background:#F8FAFC;border:1px solid #E8ECF2;border-radius:12px;overflow:hidden;margin-bottom:16px}
  .dc-row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid #EEF1F6}
  .dc-row:last-child{border-bottom:none}
  .dc-lbl{font-size:11px;font-weight:600;color:#8A97AB;text-transform:uppercase;letter-spacing:0.6px}
  .dc-val{font-size:13px;font-weight:600;color:#1a1a2e;text-align:right;max-width:60%}
  /* Amount block */
  .amt-wrap{background:#F8FAFC;border:1px solid #E8ECF2;border-radius:12px;overflow:hidden;margin-bottom:16px}
  .amt-row{display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid #EEF1F6;font-size:13px;color:#5A6880}
  .amt-row:last-child{border-bottom:none;padding:13px 16px;background:#fff}
  .amt-row:last-child .amt-lbl{font-size:14px;font-weight:700;color:#0B1E3D}
  .amt-row:last-child .amt-val{font-size:18px;font-weight:800;color:#0B1E3D}
  /* Message box */
  .msgbox{background:#F0F7FF;border-left:3px solid #1B4F8A;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#2563EB;line-height:1.6}
  .msgbox.green{background:#F0FDF5;border-color:#16A34A;color:#15803D}
  .msgbox.amber{background:#FFFBEB;border-color:#D97706;color:#92400E}
  .msgbox.red{background:#FFF5F5;border-color:#DC2626;color:#991B1B}
  /* Signature status */
  .sig-grid{display:flex;gap:10px;margin-bottom:16px}
  .sig-item{flex:1;background:#F8FAFC;border:1px solid #E8ECF2;border-radius:10px;padding:12px 14px;text-align:center}
  .sig-label{font-size:10px;font-weight:700;color:#8A97AB;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
  .sig-status{font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px}
  .sig-ok{color:#16A34A}
  .sig-wait{color:#D97706}
  /* CTA */
  .cta{text-align:center;padding:8px 0 14px}
  .btn{display:inline-block;padding:13px 28px;border-radius:9px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:-0.1px}
  .btn-dark{background:#0B1E3D;color:#ffffff}
  .btn-blue{background:#1B4F8A;color:#ffffff}
  .btn-green{background:#16A34A;color:#ffffff}
  .btn-orange{background:#D97706;color:#ffffff}
  /* Badge */
  .badge{display:inline-block;padding:3px 9px;border-radius:100px;font-size:11px;font-weight:700}
  .b-amber{background:#FEF3C7;color:#92400E}
  .b-green{background:#DCFCE7;color:#15803D}
  .b-blue{background:#DBEAFE;color:#1D4ED8}
  .b-red{background:#FEE2E2;color:#991B1B}
  /* Footer */
  .ftr{padding:20px 32px;border-top:1px solid #F0F2F5;display:flex;justify-content:space-between;align-items:center}
  .ftr-left{font-size:11px;color:#8A97AB;line-height:1.6}
  .ftr-left a{color:#8A97AB;text-decoration:none}
  .ftr-left strong{color:#5A6880;font-weight:600}
  /* Steps progress */
  .steps{display:flex;margin-bottom:16px;background:#F8FAFC;border:1px solid #E8ECF2;border-radius:10px;overflow:hidden}
  .step{flex:1;padding:10px 6px;text-align:center;font-size:10px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;border-right:1px solid #E8ECF2;color:#8A97AB}
  .step:last-child{border-right:none}
  .step.done{background:#F0FDF5;color:#15803D}
  .step.current{background:#EFF6FF;color:#1D4ED8}
  @media(max-width:480px){.wrap{padding:16px 12px 32px}.banner{padding:20px 20px 14px}.body,.ftr{padding:16px 20px}.div{margin:0 20px}.hdr{padding:18px 20px}}
`;

// ── Client layout ────────────────────────────────────────────
function _layout(content, preheader = '') {
    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>VNK Automatisation Inc.</title>
<style>${_CSS}</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#F4F6F9">${preheader}&nbsp;&zwnj;</div>` : ''}
<div class="wrap">
<div class="card">
  <div class="hdr">
    <div class="hdr-logo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill="#7FC8F8"/>
      </svg>
    </div>
    <div>
      <div class="hdr-name">VNK Automatisation Inc.</div>
      <div class="hdr-tag">Value · Network · Knowledge</div>
    </div>
  </div>
  ${content}
  <div class="ftr">
    <div class="ftr-left">
      <strong>VNK Automatisation Inc.</strong><br>
      Québec, QC, Canada<br>
      <a href="mailto:${process.env.ADMIN_EMAIL || 'contact@vnk.ca'}">${process.env.ADMIN_EMAIL || 'contact@vnk.ca'}</a>
    </div>
    <div>
      <a href="${PORTAL_URL}/portail.html" style="font-size:12px;color:#1B4F8A;text-decoration:none;font-weight:600">Portail client →</a>
    </div>
  </div>
</div>
<div style="text-align:center;margin-top:16px;font-size:11px;color:#9BA8BB">
  Vous recevez cet email car vous êtes client VNK Automatisation Inc.<br>
  <a href="${PORTAL_URL}/portail.html" style="color:#9BA8BB">Se désabonner</a>
</div>
</div>
</body>
</html>`;
}

// ── Admin layout (dark pro) ──────────────────────────────────
const _ADMIN_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0D1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#E6EDF3}
  .wrap{max-width:600px;margin:0 auto;padding:28px 16px 44px}
  .card{background:#161B22;border-radius:12px;overflow:hidden;border:1px solid #30363D}
  .hdr{background:#0D1117;border-bottom:1px solid #30363D;padding:18px 28px;display:flex;align-items:center;justify-content:space-between}
  .hdr-left{display:flex;align-items:center;gap:10px}
  .hdr-dot{width:8px;height:8px;border-radius:50%;background:#58A6FF;flex-shrink:0}
  .hdr-title{font-size:12px;font-weight:700;color:#58A6FF;letter-spacing:1.5px;text-transform:uppercase}
  .hdr-sub{font-size:10px;color:#484F58;margin-top:1px}
  .hdr-link{font-size:11px;font-weight:600;color:#58A6FF;text-decoration:none;padding:5px 12px;border:1px solid #30363D;border-radius:6px}
  /* Event type banner */
  .ev-type{padding:4px 12px;background:#161B22;border-bottom:1px solid #30363D;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
  .banner{padding:22px 28px 16px}
  .banner h1{font-size:20px;font-weight:700;color:#F0F6FF;margin-bottom:6px;letter-spacing:-0.3px}
  .banner p{font-size:13px;color:#7D8590;line-height:1.6}
  .div{height:1px;background:#21262D;margin:0 28px}
  .body{padding:20px 28px}
  .dc{background:#0D1117;border:1px solid #30363D;border-radius:8px;overflow:hidden;margin-bottom:12px}
  .dc-row{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid #21262D}
  .dc-row:last-child{border-bottom:none}
  .dc-lbl{font-size:10.5px;font-weight:600;color:#484F58;text-transform:uppercase;letter-spacing:0.5px}
  .dc-val{font-size:13px;font-weight:500;color:#C9D1D9;text-align:right}
  .dc-val.hi{color:#3FB950;font-weight:700;font-size:15px}
  .dc-val.warn{color:#D29922;font-weight:700}
  .dc-val.danger{color:#F85149;font-weight:700}
  .alert{padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:12.5px;font-weight:600;line-height:1.5}
  .alert.action{background:#0D2137;border:1px solid #1B4F8A;color:#58A6FF}
  .alert.success{background:#0A2D1A;border:1px solid #1A7F37;color:#3FB950}
  .alert.warning{background:#2D1F0A;border:1px solid #7D4E0F;color:#D29922}
  .alert.danger{background:#2D0A0A;border:1px solid #7F1D1D;color:#F85149}
  .msgbox{background:#0D1117;border-left:2px solid #30363D;border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#8B949E;line-height:1.6;font-style:italic}
  .cta{text-align:center;padding:4px 0 12px}
  .btn{display:inline-block;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:-0.1px}
  .btn-blue{background:#1F6FEB;color:#fff}
  .btn-green{background:#1A7F37;color:#fff}
  .btn-red{background:#B91C1C;color:#fff}
  .badge{display:inline-block;padding:2px 8px;border-radius:100px;font-size:10.5px;font-weight:700}
  .b-green{background:#033A16;color:#3FB950;border:1px solid #1A7F37}
  .b-amber{background:#271700;color:#D29922;border:1px solid #7D4E0F}
  .b-red{background:#2D0A0A;color:#F85149;border:1px solid #7F1D1D}
  .b-blue{background:#0D2137;color:#58A6FF;border:1px solid #1B4F8A}
  .ftr{padding:14px 28px;border-top:1px solid #21262D;text-align:center;font-size:10.5px;color:#484F58}
  .ftr a{color:#484F58;text-decoration:none}
`;

function _adminLayout(content, preheader = '', eventColor = '#58A6FF') {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VNK Admin</title>
<style>${_ADMIN_CSS}</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ''}
<div class="wrap">
<div class="card">
  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-dot" style="background:${eventColor}"></div>
      <div>
        <div class="hdr-title">VNK — Notification Admin</div>
        <div class="hdr-sub">Système automatique · ${new Date().toLocaleDateString('fr-CA')}</div>
      </div>
    </div>
    <a href="${ADMIN_PORTAL}" class="hdr-link">Dashboard →</a>
  </div>
  ${content}
  <div class="ftr">
    Notification automatique · <a href="${ADMIN_PORTAL}">Tableau de bord VNK</a>
  </div>
</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════
// TEMPLATES CLIENT
// ═══════════════════════════════════════════════════════════

function tplNewQuote(client, q) {
    const body = `
  <div class="banner">
    <div class="ev-chip" style="background:#EFF6FF;color:#1D4ED8">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Nouveau devis
    </div>
    <h1>Un devis vous attend</h1>
    <p>Bonjour <strong>${client.full_name}</strong>, VNK Automatisation a préparé un devis pour vous. Consultez-le depuis votre portail et acceptez-le en un clic.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="steps">
      <div class="step current">1. Devis reçu</div>
      <div class="step">2. Acceptation</div>
      <div class="step">3. Contrat</div>
      <div class="step">4. Travaux</div>
    </div>
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">N° devis</span><span class="dc-val">${q.quote_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Objet</span><span class="dc-val">${q.title}</span></div>
      <div class="dc-row"><span class="dc-lbl">Valide jusqu'au</span><span class="dc-val">${_fmtDate(q.expiry_date)}</span></div>
      <div class="dc-row"><span class="dc-lbl">Statut</span><span class="dc-val"><span class="badge b-amber">En attente de votre réponse</span></span></div>
    </div>
    <div class="amt-wrap">
      <div class="amt-row"><span class="amt-lbl">Sous-total HT</span><span class="amt-val">${_fmtCA(q.amount_ht)}</span></div>
      <div class="amt-row"><span class="amt-lbl">TPS (5 %)</span><span class="amt-val">${_fmtCA(q.tps_amount)}</span></div>
      <div class="amt-row"><span class="amt-lbl">TVQ (9,975 %)</span><span class="amt-val">${_fmtCA(q.tvq_amount)}</span></div>
      <div class="amt-row"><span class="amt-lbl">Total TTC</span><span class="amt-val">${_fmtCA(q.amount_ttc)}</span></div>
    </div>
    ${q.description ? `<div class="msgbox">${q.description}</div>` : ''}
    <div class="cta">
      <a href="${PORTAL_URL}/portail.html#quotes" class="btn btn-dark">Consulter et accepter le devis →</a>
    </div>
  </div>`;
    return { subject: `Devis ${q.quote_number} — ${_fmtCA(q.amount_ttc)} | VNK Automatisation`, html: _layout(body, `Nouveau devis ${q.quote_number} de ${_fmtCA(q.amount_ttc)} — valide jusqu'au ${_fmtDate(q.expiry_date)}`) };
}

function tplNewContract(client, ct) {
    const body = `
  <div class="banner">
    <div class="ev-chip" style="background:#F5F3FF;color:#6D28D9">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      Signature requise
    </div>
    <h1>Votre contrat est prêt</h1>
    <p>Bonjour <strong>${client.full_name}</strong>, suite à votre devis accepté, votre contrat de service est disponible. Votre signature est requise pour démarrer les travaux.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="steps">
      <div class="step done">1. Devis</div>
      <div class="step current">2. Contrat</div>
      <div class="step">3. Facture</div>
      <div class="step">4. Travaux</div>
    </div>
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">N° contrat</span><span class="dc-val">${ct.contract_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Objet</span><span class="dc-val">${ct.title}</span></div>
      <div class="dc-row"><span class="dc-lbl">Créé le</span><span class="dc-val">${_fmtDate(ct.created_at)}</span></div>
    </div>
    <div class="sig-grid">
      <div class="sig-item">
        <div class="sig-label">VNK Automatisation</div>
        <div class="sig-status ${ct.admin_signed_at ? 'sig-ok' : 'sig-wait'}">
          ${ct.admin_signed_at ? '✓ Signé' : '⏳ En attente'}
        </div>
      </div>
      <div class="sig-item">
        <div class="sig-label">Votre signature</div>
        <div class="sig-status sig-wait">✍ Requis</div>
      </div>
    </div>
    <div class="msgbox amber">Une fois signé par les deux parties, votre facture sera générée automatiquement et les travaux pourront démarrer.</div>
    <div class="cta">
      <a href="${PORTAL_URL}/portail.html#contracts" class="btn btn-blue">Signer le contrat →</a>
    </div>
  </div>`;
    return { subject: `Signature requise — Contrat ${ct.contract_number} | VNK Automatisation`, html: _layout(body, `Contrat ${ct.contract_number} prêt — votre signature est requise pour démarrer les travaux.`) };
}

function tplContractSigned(client, ct) {
    const body = `
  <div class="banner">
    <div class="ev-chip" style="background:#DCFCE7;color:#15803D">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Contrat signé
    </div>
    <h1>Travaux officiellement confirmés</h1>
    <p>Bonjour <strong>${client.full_name}</strong>, votre contrat a été signé par les deux parties. Nous sommes pleinement engagés pour ce projet. Votre facture a été générée automatiquement.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="steps">
      <div class="step done">1. Devis</div>
      <div class="step done">2. Contrat</div>
      <div class="step current">3. Facture</div>
      <div class="step">4. Travaux</div>
    </div>
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Contrat</span><span class="dc-val">${ct.contract_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Objet</span><span class="dc-val">${ct.title}</span></div>
      <div class="dc-row"><span class="dc-lbl">Signé le</span><span class="dc-val">${_fmtDate(ct.signed_at || new Date())}</span></div>
      <div class="dc-row"><span class="dc-lbl">Statut</span><span class="dc-val"><span class="badge b-green">Signé — En vigueur</span></span></div>
    </div>
    <div class="sig-grid">
      <div class="sig-item">
        <div class="sig-label">VNK Automatisation</div>
        <div class="sig-status sig-ok">✓ Signé</div>
      </div>
      <div class="sig-item">
        <div class="sig-label">Vous</div>
        <div class="sig-status sig-ok">✓ Signé</div>
      </div>
    </div>
    <div class="msgbox green">Votre facture est maintenant disponible dans votre portail. Réglez-la en ligne de façon sécurisée pour démarrer les travaux immédiatement.</div>
    <div class="cta">
      <a href="${PORTAL_URL}/portail.html#invoices" class="btn btn-green">Voir ma facture →</a>
    </div>
  </div>`;
    return { subject: `Contrat ${ct.contract_number} signé — Travaux confirmés | VNK Automatisation`, html: _layout(body, `Contrat ${ct.contract_number} signé par les deux parties. Votre facture est disponible.`) };
}

function tplNewInvoice(client, inv) {
    const isOverdue = inv.due_date && new Date(inv.due_date) < new Date();
    const body = `
  <div class="banner">
    <div class="ev-chip" style="background:#FFF7ED;color:#C2410C">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      Nouvelle facture
    </div>
    <h1>Facture disponible</h1>
    <p>Bonjour <strong>${client.full_name}</strong>, votre facture est prête. Réglez-la facilement et de façon sécurisée depuis votre portail client.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">N° facture</span><span class="dc-val">${inv.invoice_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Objet</span><span class="dc-val">${inv.title || 'Service VNK'}</span></div>
      <div class="dc-row"><span class="dc-lbl">Émise le</span><span class="dc-val">${_fmtDate(inv.created_at)}</span></div>
      <div class="dc-row"><span class="dc-lbl">Échéance</span><span class="dc-val" style="color:${isOverdue ? '#DC2626' : 'inherit'};font-weight:${isOverdue ? '700' : '600'}">${_fmtDate(inv.due_date)}${isOverdue ? ' — EN RETARD' : ''}</span></div>
    </div>
    <div class="amt-wrap">
      <div class="amt-row"><span class="amt-lbl">Sous-total HT</span><span class="amt-val">${_fmtCA(inv.amount_ht)}</span></div>
      <div class="amt-row"><span class="amt-lbl">TPS (5 %)</span><span class="amt-val">${_fmtCA(inv.tps_amount)}</span></div>
      <div class="amt-row"><span class="amt-lbl">TVQ (9,975 %)</span><span class="amt-val">${_fmtCA(inv.tvq_amount)}</span></div>
      <div class="amt-row"><span class="amt-lbl">Total à payer</span><span class="amt-val">${_fmtCA(inv.amount_ttc)}</span></div>
    </div>
    <div class="cta">
      <a href="${PORTAL_URL}/portail.html#invoices" class="btn btn-dark">Payer ${_fmtCA(inv.amount_ttc)} →</a>
    </div>
    <p style="text-align:center;font-size:11px;color:#8A97AB;margin-top:10px">Paiement sécurisé Stripe · Visa · Mastercard · American Express</p>
  </div>`;
    return { subject: `Facture ${inv.invoice_number} — ${_fmtCA(inv.amount_ttc)} à régler | VNK Automatisation`, html: _layout(body, `Facture ${inv.invoice_number} de ${_fmtCA(inv.amount_ttc)} — Échéance ${_fmtDate(inv.due_date)}`) };
}

function tplInvoicePaid(client, inv) {
    const body = `
  <div class="banner">
    <div class="ev-chip" style="background:#DCFCE7;color:#15803D">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Paiement confirmé
    </div>
    <h1>Merci — Paiement reçu !</h1>
    <p>Bonjour <strong>${client.full_name}</strong>, votre paiement a bien été traité et confirmé. Voici votre récapitulatif de transaction.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Facture</span><span class="dc-val">${inv.invoice_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Montant payé</span><span class="dc-val" style="color:#15803D;font-weight:800;font-size:16px">${_fmtCA(inv.amount_ttc)}</span></div>
      <div class="dc-row"><span class="dc-lbl">Payée le</span><span class="dc-val">${_fmtDate(inv.paid_at || new Date())}</span></div>
      <div class="dc-row"><span class="dc-lbl">Méthode</span><span class="dc-val">Carte bancaire (Stripe)</span></div>
      ${inv.stripe_payment_intent_id ? `<div class="dc-row"><span class="dc-lbl">Réf. transaction</span><span class="dc-val" style="font-size:10px;color:#8A97AB;font-family:monospace">${inv.stripe_payment_intent_id}</span></div>` : ''}
      <div class="dc-row"><span class="dc-lbl">Statut</span><span class="dc-val"><span class="badge b-green">Payée</span></span></div>
    </div>
    <div class="msgbox green">Votre reçu et vos factures sont disponibles dans votre portail client, section Factures.</div>
    <div class="cta">
      <a href="${PORTAL_URL}/portail.html#invoices" class="btn btn-green">Voir le reçu →</a>
    </div>
  </div>`;
    return { subject: `Paiement confirmé — ${_fmtCA(inv.amount_ttc)} | VNK Automatisation`, html: _layout(body, `Votre paiement de ${_fmtCA(inv.amount_ttc)} pour la facture ${inv.invoice_number} a été reçu.`) };
}

function tplNewDocument(client, doc) {
    const typeColors = { pdf: '#C2410C', docx: '#1D4ED8', xlsx: '#15803D', png: '#6D28D9', jpg: '#6D28D9' };
    const tc = typeColors[doc.file_type] || '#5A6880';
    const body = `
  <div class="banner">
    <div class="ev-chip" style="background:#F0FDF4;color:#15803D">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Nouveau document
    </div>
    <h1>Document disponible</h1>
    <p>Bonjour <strong>${client.full_name}</strong>, VNK Automatisation a déposé un nouveau document dans votre portail client.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Document</span><span class="dc-val" style="font-weight:700">${doc.title}</span></div>
      ${doc.category ? `<div class="dc-row"><span class="dc-lbl">Catégorie</span><span class="dc-val">${doc.category}</span></div>` : ''}
      ${doc.file_type ? `<div class="dc-row"><span class="dc-lbl">Format</span><span class="dc-val"><span class="badge" style="background:${tc}15;color:${tc};border:1px solid ${tc}30">${doc.file_type.toUpperCase()}</span></span></div>` : ''}
      <div class="dc-row"><span class="dc-lbl">Disponible le</span><span class="dc-val">${_fmtDate(new Date())}</span></div>
    </div>
    ${doc.description ? `<div class="msgbox">${doc.description}</div>` : ''}
    <div class="cta">
      <a href="${PORTAL_URL}/portail.html#documents" class="btn btn-dark">Consulter le document →</a>
    </div>
  </div>`;
    return { subject: `Nouveau document : ${doc.title} | VNK Automatisation`, html: _layout(body, `Nouveau document disponible dans votre portail : ${doc.title}`) };
}

function tplNewMessage(client, msg) {
    const body = `
  <div class="banner">
    <div class="ev-chip" style="background:#EFF6FF;color:#1D4ED8">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Nouveau message
    </div>
    <h1>Message de VNK</h1>
    <p>Bonjour <strong>${client.full_name}</strong>, vous avez reçu un message de notre équipe.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div style="background:#F8FAFC;border:1px solid #E8ECF2;border-radius:12px;padding:16px 18px;margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;color:#8A97AB;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px">Message de VNK Automatisation</div>
      <div style="font-size:14px;color:#1a1a2e;line-height:1.65">${msg.content || '—'}</div>
    </div>
    <div class="cta">
      <a href="${PORTAL_URL}/portail.html#messages" class="btn btn-blue">Répondre depuis le portail →</a>
    </div>
  </div>`;
    return { subject: `Message de VNK Automatisation`, html: _layout(body, `Nouveau message de VNK : ${(msg.content || '').substring(0, 80)}`) };
}

function tplMandateUpdate(client, m) {
    const pct = Math.min(100, Math.max(0, parseInt(m.progress) || 0));
    const barW = Math.round(pct * 3.6); // 360px max
    const body = `
  <div class="banner">
    <div class="ev-chip" style="background:#FFFBEB;color:#92400E">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Mise à jour mandat
    </div>
    <h1>Avancement de votre projet</h1>
    <p>Bonjour <strong>${client.full_name}</strong>, l'avancement de votre mandat a été mis à jour.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Mandat</span><span class="dc-val" style="font-weight:700">${m.title}</span></div>
      <div class="dc-row"><span class="dc-lbl">Statut</span><span class="dc-val"><span class="badge b-green">${m.status || 'Actif'}</span></span></div>
      <div class="dc-row"><span class="dc-lbl">Progression</span><span class="dc-val" style="font-weight:800;font-size:16px;color:#15803D">${pct}%</span></div>
      ${m.notes ? `<div class="dc-row"><span class="dc-lbl">Notes</span><span class="dc-val">${m.notes}</span></div>` : ''}
    </div>
    <div style="background:#F8FAFC;border:1px solid #E8ECF2;border-radius:8px;padding:14px;margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;color:#8A97AB;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px">Progression — ${pct}% complété</div>
      <div style="height:8px;background:#E8ECF2;border-radius:100px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#16A34A,#22C55E);border-radius:100px"></div>
      </div>
    </div>
    <div class="cta">
      <a href="${PORTAL_URL}/portail.html#mandates" class="btn btn-dark">Voir l'avancement →</a>
    </div>
  </div>`;
    return { subject: `Avancement mandat : ${m.title} — ${pct}% | VNK Automatisation`, html: _layout(body, `Mandat "${m.title}" — ${pct}% complété.`) };
}

// ═══════════════════════════════════════════════════════════
// TEMPLATES ADMIN
// ═══════════════════════════════════════════════════════════

function tplAdminNewMessage(client, msg) {
    const isEmail = msg.channel === 'email_received';
    const msgLink = ADMIN_PORTAL + '#messages-' + client.id;
    const color = isEmail ? '#58A6FF' : '#3FB950';
    const body = `
  <div class="ev-type" style="color:${color}">
    ${isEmail ? 'EMAIL ENTRANT' : 'MESSAGE PORTAIL'}
  </div>
  <div class="banner">
    <h1>${isEmail ? 'Email reçu d\'un client' : 'Nouveau message client'}</h1>
    <p>${client.full_name}${client.company_name ? ' · ' + client.company_name : ''} · <a href="mailto:${client.email}" style="color:#58A6FF;text-decoration:none">${client.email}</a></p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Client</span><span class="dc-val">${client.full_name}</span></div>
      ${client.company_name ? `<div class="dc-row"><span class="dc-lbl">Entreprise</span><span class="dc-val">${client.company_name}</span></div>` : ''}
      <div class="dc-row"><span class="dc-lbl">Canal</span><span class="dc-val"><span class="badge ${isEmail ? 'b-blue' : 'b-green'}">${isEmail ? 'Email reçu' : 'Chat portail'}</span></span></div>
      <div class="dc-row"><span class="dc-lbl">Reçu le</span><span class="dc-val">${_fmtDate(new Date())}</span></div>
    </div>
    <div class="msgbox">${(msg.content || '').substring(0, 600)}${(msg.content || '').length > 600 ? '...' : ''}</div>
    <div class="cta">
      <a href="${msgLink}" class="btn btn-blue">Répondre à ${client.full_name} →</a>
    </div>
  </div>`;
    return { subject: `[VNK] ${isEmail ? 'Email' : 'Message'} de ${client.full_name}`, html: _adminLayout(body, `${client.full_name} : ${(msg.content || '').substring(0, 80)}`, color) };
}

function tplAdminNewClient(client) {
    const body = `
  <div class="ev-type" style="color:#3FB950">NOUVEAU CLIENT</div>
  <div class="banner">
    <h1>Nouveau compte client créé</h1>
    <p>Un nouveau client vient de rejoindre le portail VNK.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Nom</span><span class="dc-val" style="font-weight:700">${client.full_name}</span></div>
      <div class="dc-row"><span class="dc-lbl">Email</span><span class="dc-val">${client.email}</span></div>
      ${client.company_name ? `<div class="dc-row"><span class="dc-lbl">Entreprise</span><span class="dc-val">${client.company_name}</span></div>` : ''}
      ${client.phone ? `<div class="dc-row"><span class="dc-lbl">Téléphone</span><span class="dc-val">${client.phone}</span></div>` : ''}
      ${client.sector ? `<div class="dc-row"><span class="dc-lbl">Secteur</span><span class="dc-val">${client.sector}</span></div>` : ''}
      <div class="dc-row"><span class="dc-lbl">Créé le</span><span class="dc-val">${_fmtDate(new Date())}</span></div>
    </div>
    <div class="cta"><a href="${ADMIN_PORTAL}" class="btn btn-blue">Voir le profil →</a></div>
  </div>`;
    return { subject: `[VNK] Nouveau client : ${client.full_name}`, html: _adminLayout(body, `Nouveau client : ${client.full_name} (${client.email})`, '#3FB950') };
}

function tplAdminPaymentReceived(client, inv) {
    const body = `
  <div class="ev-type" style="color:#3FB950">PAIEMENT REÇU</div>
  <div class="banner">
    <h1>Paiement Stripe confirmé</h1>
    <p>Un paiement a été traité avec succès.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="alert success">Stripe a confirmé la réception de ${_fmtCA(inv.amount_ttc)}</div>
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Client</span><span class="dc-val">${client.full_name}</span></div>
      <div class="dc-row"><span class="dc-lbl">Facture</span><span class="dc-val">${inv.invoice_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Montant</span><span class="dc-val hi">${_fmtCA(inv.amount_ttc)}</span></div>
      <div class="dc-row"><span class="dc-lbl">Payée le</span><span class="dc-val">${_fmtDate(inv.paid_at || new Date())}</span></div>
      ${inv.stripe_payment_intent_id ? `<div class="dc-row"><span class="dc-lbl">ID Stripe</span><span class="dc-val" style="font-family:monospace;font-size:10px;color:#484F58">${inv.stripe_payment_intent_id}</span></div>` : ''}
    </div>
    <div class="cta"><a href="${ADMIN_PORTAL}#invoices" class="btn btn-green">Voir la facture →</a></div>
  </div>`;
    return { subject: `[VNK] Paiement ${_fmtCA(inv.amount_ttc)} — ${client.full_name}`, html: _adminLayout(body, `Paiement de ${_fmtCA(inv.amount_ttc)} reçu de ${client.full_name}`, '#3FB950') };
}

function tplAdminQuoteAccepted(client, quote) {
    const body = `
  <div class="ev-type" style="color:#D29922">DEVIS ACCEPTÉ</div>
  <div class="banner">
    <h1>Un client a accepté votre devis</h1>
    <p>Un contrat a été généré automatiquement — votre signature est requise pour démarrer.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="alert action">Action requise : signez le contrat généré pour officialiser l'engagement.</div>
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Client</span><span class="dc-val">${client.full_name}</span></div>
      <div class="dc-row"><span class="dc-lbl">Devis</span><span class="dc-val">${quote.quote_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Objet</span><span class="dc-val">${quote.title}</span></div>
      <div class="dc-row"><span class="dc-lbl">Montant TTC</span><span class="dc-val hi">${_fmtCA(quote.amount_ttc)}</span></div>
      <div class="dc-row"><span class="dc-lbl">Accepté le</span><span class="dc-val">${_fmtDate(new Date())}</span></div>
    </div>
    <div class="cta"><a href="${ADMIN_PORTAL}#contracts" class="btn btn-blue">Signer le contrat →</a></div>
  </div>`;
    return { subject: `[VNK] Devis accepté — ${quote.quote_number} — ${client.full_name}`, html: _adminLayout(body, `Devis ${quote.quote_number} accepté par ${client.full_name} — ${_fmtCA(quote.amount_ttc)}`, '#D29922') };
}

function tplAdminContractSignedByClient(client, contract) {
    const body = `
  <div class="ev-type" style="color:#D29922">SIGNATURE CLIENT</div>
  <div class="banner">
    <h1>Le client a signé le contrat</h1>
    <p>Votre signature est maintenant requise pour finaliser l'accord.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="alert warning">Action requise : signez le contrat pour générer la facture automatiquement.</div>
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Client</span><span class="dc-val">${client.full_name}</span></div>
      <div class="dc-row"><span class="dc-lbl">Contrat</span><span class="dc-val">${contract.contract_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Objet</span><span class="dc-val">${contract.title}</span></div>
      <div class="dc-row"><span class="dc-lbl">Signé par client</span><span class="dc-val">${_fmtDate(contract.signed_at || new Date())}</span></div>
      <div class="dc-row"><span class="dc-lbl">Votre signature</span><span class="dc-val warn">En attente</span></div>
    </div>
    <div class="cta"><a href="${ADMIN_PORTAL}#contracts" class="btn btn-blue">Signer maintenant →</a></div>
  </div>`;
    return { subject: `[VNK] Signature requise — ${contract.contract_number} — ${client.full_name}`, html: _adminLayout(body, `Action requise : signez le contrat ${contract.contract_number}`, '#D29922') };
}

function tplAdminDisputeOpened(client, dispute) {
    const body = `
  <div class="ev-type" style="color:#F85149">LITIGE OUVERT</div>
  <div class="banner">
    <h1>Litige ouvert — Action urgente</h1>
    <p>Un litige a été ouvert. Vous devez répondre dans les 7 jours.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="alert danger">Priorité ${(dispute.priority || 'MEDIUM').toUpperCase()} — Délai de réponse : 7 jours maximum</div>
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Client</span><span class="dc-val">${client.full_name}</span></div>
      <div class="dc-row"><span class="dc-lbl">Email</span><span class="dc-val">${client.email}</span></div>
      <div class="dc-row"><span class="dc-lbl">Titre</span><span class="dc-val">${dispute.title}</span></div>
      <div class="dc-row"><span class="dc-lbl">Priorité</span><span class="dc-val"><span class="badge b-red">${dispute.priority || 'medium'}</span></span></div>
      <div class="dc-row"><span class="dc-lbl">Ouvert le</span><span class="dc-val">${_fmtDate(new Date())}</span></div>
    </div>
    ${dispute.description ? `<div class="msgbox">${dispute.description}</div>` : ''}
    <div class="cta"><a href="${ADMIN_PORTAL}#disputes" class="btn btn-red">Gérer le litige →</a></div>
  </div>`;
    return { subject: `[VNK] LITIGE — ${client.full_name} — Priorité ${dispute.priority || 'medium'}`, html: _adminLayout(body, `LITIGE ouvert par ${client.full_name}`, '#F85149') };
}

function tplAdminRefundRequested(client, refund) {
    const body = `
  <div class="ev-type" style="color:#F85149">REMBOURSEMENT</div>
  <div class="banner">
    <h1>Remboursement demandé</h1>
    <p>Un remboursement a été initié pour ${client.full_name}.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Client</span><span class="dc-val">${client.full_name}</span></div>
      <div class="dc-row"><span class="dc-lbl">N° remboursement</span><span class="dc-val">${refund.refund_number}</span></div>
      <div class="dc-row"><span class="dc-lbl">Montant</span><span class="dc-val danger">${_fmtCA(refund.total_amount)}</span></div>
      <div class="dc-row"><span class="dc-lbl">Raison</span><span class="dc-val">${refund.reason}</span></div>
      <div class="dc-row"><span class="dc-lbl">Statut</span><span class="dc-val"><span class="badge b-amber">En traitement</span></span></div>
    </div>
    <div class="cta"><a href="${ADMIN_PORTAL}#refunds" class="btn btn-blue">Voir dans l'admin →</a></div>
  </div>`;
    return { subject: `[VNK] Remboursement ${refund.refund_number} — ${_fmtCA(refund.total_amount)}`, html: _adminLayout(body, `Remboursement de ${_fmtCA(refund.total_amount)} pour ${client.full_name}`, '#F85149') };
}

function tplAdminContactForm(contact) {
    const body = `
  <div class="ev-type" style="color:#58A6FF">FORMULAIRE DE CONTACT</div>
  <div class="banner">
    <h1>Nouveau prospect — Site web</h1>
    <p>Un visiteur a soumis une demande via le formulaire de contact.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Nom</span><span class="dc-val" style="font-weight:700">${contact.name}</span></div>
      <div class="dc-row"><span class="dc-lbl">Email</span><span class="dc-val">${contact.email}</span></div>
      ${contact.company ? `<div class="dc-row"><span class="dc-lbl">Entreprise</span><span class="dc-val">${contact.company}</span></div>` : ''}
      ${contact.service ? `<div class="dc-row"><span class="dc-lbl">Service</span><span class="dc-val"><span class="badge b-blue">${contact.service}</span></span></div>` : ''}
      <div class="dc-row"><span class="dc-lbl">Reçu le</span><span class="dc-val">${_fmtDate(new Date())}</span></div>
    </div>
    <div class="msgbox">${contact.message}</div>
    <div class="cta">
      <a href="mailto:${contact.email}?subject=Re: Votre demande VNK Automatisation" class="btn btn-blue">Répondre par email →</a>
    </div>
  </div>`;
    return { subject: `[VNK] Contact : ${contact.name} — ${contact.service || 'Général'}`, html: _adminLayout(body, `Contact de ${contact.name} (${contact.email})`, '#58A6FF') };
}

function tplAdminSystemError(error) {
    const body = `
  <div class="ev-type" style="color:#F85149">ERREUR SYSTÈME</div>
  <div class="banner">
    <h1>Erreur critique détectée</h1>
    <p>Vérifiez les logs Railway immédiatement.</p>
  </div>
  <div class="div"></div>
  <div class="body">
    <div class="alert danger">Vérifiez les logs Railway immédiatement</div>
    <div class="dc">
      <div class="dc-row"><span class="dc-lbl">Route</span><span class="dc-val">${error.route || 'Inconnue'}</span></div>
      <div class="dc-row"><span class="dc-lbl">Heure</span><span class="dc-val">${_fmtDate(new Date())}</span></div>
    </div>
    <div class="msgbox">${(error.message || '').substring(0, 500)}</div>
    <div class="cta"><a href="https://railway.app" class="btn btn-red">Ouvrir Railway →</a></div>
  </div>`;
    return { subject: `[VNK] ERREUR — ${error.route}`, html: _adminLayout(body, `Erreur système : ${error.route}`, '#F85149') };
}

// ─── Envoi ─────────────────────────────────────────────────
async function sendEmail(to, tpl) {
    const transporter = _getTransporter();
    if (!transporter) { console.warn('[email] Non configuré — EMAIL_HOST/USER/PASS requis'); return false; }
    try {
        await transporter.sendMail({ from: FROM, to, subject: tpl.subject, html: tpl.html });
        console.log(`[email] ✓ ${to} — ${tpl.subject}`);
        return true;
    } catch (e) { console.error(`[email] ✗ ${to}:`, e.message); return false; }
}

async function sendEmailToClient(pool, clientId, tpl) {
    try {
        const r = await pool.query('SELECT email, full_name FROM clients WHERE id=$1', [clientId]);
        if (!r.rows.length) return false;
        return sendEmail(r.rows[0].email, tpl);
    } catch (e) { console.warn('[email] client lookup error:', e.message); return false; }
}

async function notifyAdmin(tpl) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER || 'vnkautomatisation@gmail.com';
    return sendEmail(adminEmail, tpl);
}

module.exports = {
    sendEmail, sendEmailToClient, notifyAdmin,
    tplNewQuote, tplNewContract, tplContractSigned,
    tplNewInvoice, tplInvoicePaid, tplNewDocument,
    tplNewMessage, tplMandateUpdate,
    tplAdminNewMessage, tplAdminNewClient, tplAdminPaymentReceived,
    tplAdminQuoteAccepted, tplAdminContractSignedByClient,
    tplAdminDisputeOpened, tplAdminRefundRequested,
    tplAdminContactForm, tplAdminSystemError,
};