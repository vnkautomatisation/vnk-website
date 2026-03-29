// @ts-nocheck
/* ============================================================
   VNK Automatisation Inc. — Stripe Payment Modal Premium v3
   Design : Glassmorphism · Logo intégré · Adresse pré-remplie
   Multi-méthode via Stripe Payment Element
   ============================================================ */

const _VNK_STRIPE_KEY = 'pk_test_51TErqtRnDD0deTI4BLVRIDRe8Jy1pfud8ibIoAXUgTi89OH7EQOVcn22KeE9DX8sDeTPiJB7lMyfvhRaRHTILbs600iS6ESs4W';
let _vnkStripe = null;
let _vnkPayElements = null;

/* ─── Init ─── */
function initStripe() {
    if (typeof Stripe !== 'undefined' && !_vnkStripe) {
        _vnkStripe = Stripe(_VNK_STRIPE_KEY);
    }
}

/* ─── Point d'entrée principal ─── */
async function payInvoice(invoiceId, amountTtc) {
    initStripe();
    if (!_vnkStripe) {
        _vnkToast('Service de paiement indisponible. Rechargez la page.', 'error');
        return;
    }

    const token = localStorage.getItem('vnk-token');
    const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');
    if (!token) return;

    const invoice = (window._allInvoices || []).find(i => i.id === invoiceId) || {};

    _vnkPayOpen(invoice, amountTtc, user);

    try {
        const r = await fetch('/api/payments/create-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ invoice_id: invoiceId })
        });
        const d = await r.json();

        if (!d.success || !d.clientSecret) {
            _vnkPayBodyError(d.message || 'Erreur lors de la création du paiement.');
            return;
        }

        _vnkMountStripeElement(d.clientSecret);

    } catch (e) {
        console.error(e);
        _vnkPayBodyError('Erreur de connexion. Veuillez réessayer.');
    }
}

/* ─── Ouvrir le modal ─── */
function _vnkPayOpen(invoice, amount, user) {
    const ex = document.getElementById('vnk-pay-modal');
    if (ex) ex.remove();

    _vnkInjectStyles();

    const fmt = _fmtCAD(amount);
    const invNum = invoice.invoice_number || '';
    const due = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    const name = user.name || user.full_name || '';
    const email = user.email || '';
    const address = user.address || '';
    const city = user.city || '';
    const province = user.province || 'QC';
    const postal = user.postal_code || '';
    const parts = name.trim().split(' ');
    const fname = parts[0] || '';
    const lname = parts.slice(1).join(' ') || '';

    const modal = document.createElement('div');
    modal.id = 'vnk-pay-modal';
    modal.innerHTML = `
    <div class="vnkp-backdrop" id="vnkp-backdrop">
      <div class="vnkp-sheet" id="vnkp-sheet">

        <!-- HEADER -->
        <div class="vnkp-hdr">
          <div class="vnkp-hdr-glass"></div>
          <div class="vnkp-hdr-content">
            <div class="vnkp-logo-row">
              <div class="vnkp-logo-mark">
                <svg width="26" height="26" viewBox="0 0 48 40">
                  <polygon points="24,2 44,13 44,35 24,46 4,35 4,13" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.75)" stroke-width="2"/>
                  <text x="24" y="29" text-anchor="middle" style="font-size:11px;font-weight:900;fill:white;font-family:system-ui,sans-serif">VNK</text>
                </svg>
              </div>
              <div class="vnkp-logo-text">
                <div class="vnkp-brand">VNK Automatisation Inc.</div>
                <div class="vnkp-tagline">Value · Network · Knowledge</div>
              </div>
              <button class="vnkp-close" onclick="closePaymentModal()" aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="vnkp-hdr-divider"></div>
            <div class="vnkp-amount-row">
              <div>
                ${invNum ? `<div class="vnkp-inv-ref">Facture ${invNum}${due ? ' · Échéance ' + due : ''}</div>` : ''}
                <div class="vnkp-amount-main">${fmt}</div>
                <div class="vnkp-amount-sub">CAD · Toutes taxes comprises</div>
              </div>
              <div class="vnkp-ssl-pill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                SSL sécurisé
              </div>
            </div>
          </div>
        </div>

        <!-- BODY -->
        <div class="vnkp-body" id="vnkp-body">

          <!-- Skeleton -->
          <div id="vnkp-skeleton">
            <div class="vnkp-sect-label">Méthode de paiement</div>
            <div class="vnkp-skel-tabs">
              <div class="vnkp-skel-tab"></div><div class="vnkp-skel-tab"></div>
              <div class="vnkp-skel-tab"></div><div class="vnkp-skel-tab"></div>
            </div>
            <div class="vnkp-skel-field" style="height:46px;margin-top:0.85rem"></div>
            <div class="vnkp-skel-row">
              <div class="vnkp-skel-field"></div><div class="vnkp-skel-field"></div><div class="vnkp-skel-field"></div>
            </div>
          </div>

          <!-- Stripe Payment Element -->
          <div id="vnkp-stripe-wrap" style="display:none">
            <div class="vnkp-sect-label">Méthode de paiement</div>
            <div id="vnkp-stripe-element"></div>
          </div>

          <div class="vnkp-sep" id="vnkp-sep" style="display:none"></div>

          <!-- Adresse de facturation -->
          <div id="vnkp-billing-section" style="display:none">
            <div class="vnkp-sect-label">Adresse de facturation</div>
            <div class="vnkp-fields">
              <div class="vnkp-row">
                <div class="vnkp-field">
                  <label class="vnkp-label" for="vnkp-fname">Prénom</label>
                  <input id="vnkp-fname" class="vnkp-input" type="text" value="${_esc(fname)}" placeholder="Jean" autocomplete="given-name">
                </div>
                <div class="vnkp-field">
                  <label class="vnkp-label" for="vnkp-lname">Nom</label>
                  <input id="vnkp-lname" class="vnkp-input" type="text" value="${_esc(lname)}" placeholder="Tremblay" autocomplete="family-name">
                </div>
              </div>
              <div class="vnkp-field">
                <label class="vnkp-label" for="vnkp-address">Adresse</label>
                <input id="vnkp-address" class="vnkp-input" type="text" value="${_esc(address)}" placeholder="123 rue des Érables" autocomplete="street-address">
              </div>
              <div class="vnkp-row">
                <div class="vnkp-field" style="flex:2">
                  <label class="vnkp-label" for="vnkp-city">Ville</label>
                  <input id="vnkp-city" class="vnkp-input" type="text" value="${_esc(city)}" placeholder="Montréal" autocomplete="address-level2">
                </div>
                <div class="vnkp-field">
                  <label class="vnkp-label" for="vnkp-province">Province</label>
                  <select id="vnkp-province" class="vnkp-input vnkp-select">
                    ${['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'].map(p => `<option${p === province ? ' selected' : ''}>${p}</option>`).join('')}
                  </select>
                </div>
                <div class="vnkp-field">
                  <label class="vnkp-label" for="vnkp-postal">Code postal</label>
                  <input id="vnkp-postal" class="vnkp-input" type="text" value="${_esc(postal)}" placeholder="G1A 1A1" autocomplete="postal-code" maxlength="7">
                </div>
              </div>
              <div class="vnkp-field">
                <label class="vnkp-label" for="vnkp-email">Courriel — reçu de paiement</label>
                <div style="position:relative">
                  <input id="vnkp-email" class="vnkp-input" type="email" value="${_esc(email)}" placeholder="jean@exemple.com" autocomplete="email" style="padding-right:2.4rem">
                  <svg style="position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Erreur -->
          <div id="vnkp-error" class="vnkp-error" style="display:none"></div>

          <!-- Sécurité -->
          <div class="vnkp-secure-bar" id="vnkp-secure-bar" style="display:none">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Chiffrement 256-bit · Aucune donnée de carte conservée · Traitement sécurisé par Stripe</span>
          </div>

        </div>

        <!-- FOOTER -->
        <div class="vnkp-footer">
          <div class="vnkp-card-logos">
            <div class="vnkp-card-visa">VISA</div>
            <div class="vnkp-card-mc"><div class="vnkp-mc-r"></div><div class="vnkp-mc-y"></div></div>
            <div class="vnkp-card-amex">AMEX</div>
          </div>
          <div class="vnkp-footer-btns">
            <button class="vnkp-btn-cancel" onclick="closePaymentModal()">Annuler</button>
            <button class="vnkp-btn-pay" id="vnkp-pay-btn" onclick="_vnkPaySubmit()" disabled>
              <span id="vnkp-pay-btn-inner">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Payer ${fmt}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>`;

    document.body.appendChild(modal);

    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.getElementById('vnkp-backdrop')?.classList.add('vnkp-in');
        document.getElementById('vnkp-sheet')?.classList.add('vnkp-in');
    }));

    document.getElementById('vnkp-backdrop').addEventListener('click', e => {
        if (e.target.id === 'vnkp-backdrop') closePaymentModal();
    });

    document._vnkEsc = e => { if (e.key === 'Escape') closePaymentModal(); };
    document.addEventListener('keydown', document._vnkEsc);
}

/* ─── Monter Stripe Element ─── */
function _vnkMountStripeElement(clientSecret) {
    if (!_vnkStripe) return;

    const elements = _vnkStripe.elements({
        clientSecret,
        appearance: {
            theme: 'flat',
            variables: {
                colorPrimary: '#1B4F8A',
                colorBackground: '#ffffff',
                colorText: '#0F172A',
                colorTextSecondary: '#64748B',
                colorDanger: '#DC2626',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                borderRadius: '10px',
                spacingUnit: '5px',
                fontSizeBase: '14px',
            },
            rules: {
                '.Input': { border: '1.5px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#fff', padding: '11px 12px' },
                '.Input:focus': { border: '1.5px solid #1B4F8A', boxShadow: '0 0 0 3px rgba(27,79,138,0.1)', outline: 'none' },
                '.Label': { fontWeight: '600', color: '#475569', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '5px' },
                '.Tab': { border: '1.5px solid #E2E8F0', borderRadius: '10px', boxShadow: 'none', padding: '10px 12px', backgroundColor: '#F8FAFC' },
                '.Tab--selected': { border: '1.5px solid #1B4F8A', backgroundColor: '#EBF5FB', boxShadow: '0 0 0 3px rgba(27,79,138,0.1)' },
                '.Tab:hover': { backgroundColor: '#EBF5FB', border: '1.5px solid #93C5FD' },
                '.TabLabel--selected': { color: '#1B4F8A', fontWeight: '700' },
                '.TabIcon--selected': { fill: '#1B4F8A' },
                '.Block': { border: '1.5px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#fff' },
                '.Error': { color: '#DC2626', fontSize: '12px' }
            }
        }
    });

    const payEl = elements.create('payment', {
        layout: { type: 'tabs', defaultCollapsed: false },
        paymentMethodOrder: ['card', 'apple_pay', 'google_pay', 'link', 'acss_debit'],
        fields: { billingDetails: { name: 'never', email: 'never', address: 'never' } },
        wallets: { applePay: 'auto', googlePay: 'auto' }
    });

    _vnkPayElements = elements;
    payEl.mount('#vnkp-stripe-element');

    payEl.on('ready', () => {
        const skel = document.getElementById('vnkp-skeleton');
        if (skel) { skel.style.transition = 'opacity 0.25s'; skel.style.opacity = '0'; setTimeout(() => skel.remove(), 260); }

        ['vnkp-stripe-wrap', 'vnkp-billing-section', 'vnkp-sep', 'vnkp-secure-bar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.display = 'block'; el.style.animation = 'vnkpFadeUp 0.3s ease'; }
        });

        const btn = document.getElementById('vnkp-pay-btn');
        if (btn) btn.disabled = false;
    });

    payEl.on('change', e => {
        const errEl = document.getElementById('vnkp-error');
        if (!errEl) return;
        if (e.error) { errEl.innerHTML = _errIcon() + e.error.message; errEl.style.display = 'flex'; }
        else errEl.style.display = 'none';
    });
}

/* ─── Soumettre ─── */
async function _vnkPaySubmit() {
    if (!_vnkStripe || !_vnkPayElements) return;

    const btn = document.getElementById('vnkp-pay-btn');
    const inner = document.getElementById('vnkp-pay-btn-inner');
    const errEl = document.getElementById('vnkp-error');

    const fname = document.getElementById('vnkp-fname')?.value.trim() || '';
    const lname = document.getElementById('vnkp-lname')?.value.trim() || '';
    const address = document.getElementById('vnkp-address')?.value.trim() || '';
    const city = document.getElementById('vnkp-city')?.value.trim() || '';
    const province = document.getElementById('vnkp-province')?.value || 'QC';
    const postal = document.getElementById('vnkp-postal')?.value.trim() || '';
    const email = document.getElementById('vnkp-email')?.value.trim() || '';

    if (!fname || !lname) { _vnkPayShowErr('Veuillez entrer votre nom complet.'); return; }
    if (!email || !email.includes('@')) { _vnkPayShowErr('Veuillez entrer un courriel valide pour le reçu.'); return; }

    if (errEl) errEl.style.display = 'none';
    if (btn) btn.disabled = true;
    if (inner) inner.innerHTML = `<svg class="vnkp-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Traitement…`;

    try {
        const { error, paymentIntent } = await _vnkStripe.confirmPayment({
            elements: _vnkPayElements,
            confirmParams: {
                return_url: window.location.origin + '/portail.html?payment=success',
                payment_method_data: {
                    billing_details: {
                        name: (fname + ' ' + lname).trim(),
                        email,
                        address: { line1: address, city, state: province, postal_code: postal, country: 'CA' }
                    }
                },
                receipt_email: email
            },
            redirect: 'if_required'
        });

        if (error) {
            _vnkPayShowErr(error.message);
            if (btn) btn.disabled = false;
            if (inner) inner.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Réessayer`;
        } else if (paymentIntent?.status === 'succeeded') {
            _vnkPaySuccess(email);
        }
    } catch (e) {
        console.error(e);
        _vnkPayShowErr('Erreur de connexion. Veuillez réessayer.');
        if (btn) btn.disabled = false;
        if (inner) inner.textContent = 'Réessayer';
    }
}

/* ─── Succès ─── */
function _vnkPaySuccess(email) {
    const sheet = document.getElementById('vnkp-sheet');
    if (!sheet) return;
    sheet.innerHTML = `
    <div class="vnkp-success">
      <div class="vnkp-success-bg"></div>
      <div class="vnkp-success-content">
        <div class="vnkp-success-ring">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 class="vnkp-success-title">Paiement confirmé !</h2>
        <p class="vnkp-success-msg">Votre paiement a été traité avec succès.${email ? '<br>Un reçu a été envoyé à <strong>' + _esc(email) + '</strong>.' : ''}</p>
        <div class="vnkp-success-logo">
          <svg width="18" height="18" viewBox="0 0 48 40"><polygon points="24,2 44,13 44,35 24,46 4,35 4,13" fill="none" stroke="rgba(27,79,138,0.45)" stroke-width="2"/><text x="24" y="29" text-anchor="middle" style="font-size:11px;font-weight:900;fill:#1B4F8A;font-family:system-ui">VNK</text></svg>
          <span>VNK Automatisation Inc.</span>
        </div>
        <button class="vnkp-btn-success" onclick="closePaymentModal();if(typeof loadAllData==='function')setTimeout(loadAllData,800)">Fermer</button>
      </div>
    </div>`;
}

/* ─── Fermer ─── */
function closePaymentModal() {
    const modal = document.getElementById('vnk-pay-modal');
    const backdrop = document.getElementById('vnkp-backdrop');
    const sheet = document.getElementById('vnkp-sheet');
    if (backdrop) backdrop.classList.remove('vnkp-in');
    if (sheet) { sheet.style.transform = 'translateY(16px) scale(0.97)'; sheet.style.opacity = '0'; }
    if (document._vnkEsc) document.removeEventListener('keydown', document._vnkEsc);
    setTimeout(() => { if (modal) modal.remove(); }, 260);
    _vnkPayElements = null;
}

/* ─── Retour redirect Stripe ─── */
function checkPaymentReturn() {
    const p = new URLSearchParams(window.location.search);
    if (p.get('payment') === 'success') {
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => { _vnkToast('Paiement confirmé ! Merci.', 'success'); if (typeof loadAllData === 'function') loadAllData(); }, 500);
    }
}

/* ─── Helpers ─── */
function _vnkPayShowErr(msg) {
    const el = document.getElementById('vnkp-error');
    if (el) { el.innerHTML = _errIcon() + msg; el.style.display = 'flex'; el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}
function _vnkPayBodyError(msg) {
    const skel = document.getElementById('vnkp-skeleton');
    if (skel) skel.innerHTML = `<div class="vnkp-error" style="display:flex;margin:0">${_errIcon()}${msg}</div>`;
}
function _errIcon() { return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`; }
function _fmtCAD(n) { return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n || 0); }
function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function _vnkToast(msg, type) {
    let t = document.getElementById('vnk-pay-toast');
    if (!t) { t = document.createElement('div'); t.id = 'vnk-pay-toast'; t.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(10px);padding:0.7rem 1.4rem;border-radius:10px;font-size:0.85rem;font-weight:600;z-index:9999999;transition:all 0.3s cubic-bezier(.34,1.56,.64,1);opacity:0;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,0.15);font-family:"DM Sans",system-ui,sans-serif'; document.body.appendChild(t); }
    t.textContent = msg; t.style.background = type === 'error' ? '#DC2626' : '#16A34A'; t.style.color = 'white';
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; }, 4000);
}

/* ─── CSS ─── */
function _vnkInjectStyles() {
    if (document.getElementById('vnkp-styles')) return;
    const s = document.createElement('style');
    s.id = 'vnkp-styles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
#vnk-pay-modal * { box-sizing:border-box; font-family:"DM Sans",system-ui,sans-serif; }
.vnkp-backdrop { position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(8,14,28,0.55);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);opacity:0;transition:opacity 0.28s ease; }
.vnkp-backdrop.vnkp-in { opacity:1; }
.vnkp-sheet { background:rgba(255,255,255,0.97);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border-radius:22px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;overflow-x:hidden;box-shadow:0 0 0 1px rgba(255,255,255,0.5),0 4px 12px rgba(0,0,0,0.08),0 28px 72px rgba(8,14,28,0.3);transform:translateY(22px) scale(0.96);opacity:0;transition:transform 0.32s cubic-bezier(.34,1.4,.64,1),opacity 0.26s ease;scrollbar-width:none; }
.vnkp-sheet::-webkit-scrollbar { display:none; }
.vnkp-sheet.vnkp-in { transform:translateY(0) scale(1);opacity:1; }
.vnkp-hdr { position:relative;overflow:hidden;border-radius:22px 22px 0 0; }
.vnkp-hdr-glass { position:absolute;inset:0;background:linear-gradient(135deg,#071424 0%,#0F2D52 45%,#174070 100%); }
.vnkp-hdr-glass::before { content:'';position:absolute;top:-60px;right:-60px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(37,99,235,0.22) 0%,transparent 65%); }
.vnkp-hdr-glass::after { content:'';position:absolute;bottom:-40px;left:-20px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(27,79,138,0.18) 0%,transparent 65%); }
.vnkp-hdr-content { position:relative;z-index:1;padding:1.2rem 1.5rem 1.15rem; }
.vnkp-logo-row { display:flex;align-items:center;gap:10px; }
.vnkp-logo-mark { width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.vnkp-logo-text { flex:1; }
.vnkp-brand { font-size:0.82rem;font-weight:800;color:white;letter-spacing:-0.01em;line-height:1.2; }
.vnkp-tagline { font-size:0.58rem;color:rgba(255,255,255,0.45);letter-spacing:0.12em;text-transform:uppercase;margin-top:1px; }
.vnkp-close { width:30px;height:30px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s;flex-shrink:0; }
.vnkp-close:hover { background:rgba(255,255,255,0.2); }
.vnkp-hdr-divider { height:1px;margin:0.85rem 0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12) 20%,rgba(255,255,255,0.12) 80%,transparent); }
.vnkp-amount-row { display:flex;align-items:flex-end;justify-content:space-between; }
.vnkp-inv-ref { font-size:0.68rem;color:rgba(255,255,255,0.5);margin-bottom:4px;font-weight:500; }
.vnkp-amount-main { font-size:1.9rem;font-weight:800;color:white;letter-spacing:-0.03em;line-height:1; }
.vnkp-amount-sub { font-size:0.68rem;color:rgba(255,255,255,0.45);margin-top:4px; }
.vnkp-ssl-pill { display:flex;align-items:center;gap:5px;background:rgba(22,163,74,0.2);border:1px solid rgba(74,222,128,0.3);border-radius:20px;padding:5px 10px;font-size:0.65rem;font-weight:700;color:#4ade80;letter-spacing:0.04em;text-transform:uppercase;flex-shrink:0; }
.vnkp-body { padding:1.5rem 1.5rem 0.75rem; }
.vnkp-sect-label { font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94A3B8;margin-bottom:0.65rem;display:flex;align-items:center;gap:6px; }
.vnkp-sect-label::before { content:'';display:block;width:3px;height:12px;background:linear-gradient(180deg,#1B4F8A,#2563EB);border-radius:2px; }
.vnkp-skel-tabs { display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:0.75rem; }
.vnkp-skel-tab { height:64px;background:#F1F5F9;border-radius:10px;animation:vnkpPulse 1.5s ease-in-out infinite; }
.vnkp-skel-row { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px; }
.vnkp-skel-field { height:44px;background:#F1F5F9;border-radius:9px;animation:vnkpPulse 1.5s ease-in-out infinite; }
@keyframes vnkpPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
.vnkp-fields { display:flex;flex-direction:column;gap:0.6rem; }
.vnkp-row { display:flex;gap:0.6rem; }
.vnkp-row > * { flex:1; }
.vnkp-field { display:flex;flex-direction:column; }
.vnkp-label { font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#475569;margin-bottom:5px; }
.vnkp-input { border:1.5px solid #E2E8F0;border-radius:9px;background:white;padding:0.62rem 0.85rem;font-size:0.875rem;color:#0F172A;outline:none;transition:border-color 0.15s,box-shadow 0.15s;width:100%;font-family:inherit; }
.vnkp-input:focus { border-color:#1B4F8A;box-shadow:0 0 0 3px rgba(27,79,138,0.1); }
.vnkp-input:not(:placeholder-shown):not(:focus) { background:#FAFBFC; }
.vnkp-select { appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px; }
.vnkp-sep { height:1px;background:linear-gradient(90deg,transparent,#E2E8F0 15%,#E2E8F0 85%,transparent);margin:1.1rem 0 0; }
.vnkp-secure-bar { display:flex;align-items:center;gap:8px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:0.55rem 0.85rem;margin-top:1rem; }
.vnkp-secure-bar span { font-size:0.7rem;color:#166534;font-weight:600;line-height:1.4; }
.vnkp-error { display:flex;align-items:flex-start;gap:8px;background:#FEF2F2;border:1px solid #FECACA;border-radius:9px;padding:0.65rem 0.85rem;font-size:0.82rem;color:#DC2626;font-weight:500;margin-top:0.85rem; }
.vnkp-footer { position:sticky;bottom:0;background:rgba(255,255,255,0.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid rgba(226,232,240,0.8);padding:0.85rem 1.5rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem; }
.vnkp-card-logos { display:flex;align-items:center;gap:6px; }
.vnkp-card-visa { background:#1A1F71;color:white;font-size:0.55rem;font-weight:900;padding:3px 6px;border-radius:4px;letter-spacing:0.05em; }
.vnkp-card-mc { display:flex;position:relative;width:28px;height:18px;flex-shrink:0; }
.vnkp-mc-r { width:18px;height:18px;background:#EB001B;border-radius:50%;position:absolute;left:0; }
.vnkp-mc-y { width:18px;height:18px;background:#F79E1B;border-radius:50%;position:absolute;left:10px;opacity:0.9; }
.vnkp-card-amex { background:#016FD0;color:white;font-size:0.55rem;font-weight:900;padding:3px 6px;border-radius:4px;letter-spacing:0.05em; }
.vnkp-footer-btns { display:flex;gap:0.6rem; }
.vnkp-btn-cancel { padding:0.65rem 1.1rem;background:white;border:1.5px solid #E2E8F0;border-radius:10px;font-size:0.85rem;font-weight:600;color:#64748B;cursor:pointer;font-family:inherit;transition:all 0.15s;white-space:nowrap; }
.vnkp-btn-cancel:hover { background:#F8FAFC;border-color:#CBD5E0; }
.vnkp-btn-pay { padding:0.7rem 1.4rem;background:linear-gradient(135deg,#071424 0%,#1B4F8A 55%,#2563EB 100%);border:none;border-radius:10px;font-size:0.88rem;font-weight:800;color:white;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 4px 16px rgba(27,79,138,0.4),0 1px 0 rgba(255,255,255,0.12) inset;transition:all 0.2s;white-space:nowrap;position:relative;overflow:hidden;letter-spacing:-0.01em; }
.vnkp-btn-pay::before { content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent); }
.vnkp-btn-pay:hover:not(:disabled) { box-shadow:0 6px 22px rgba(27,79,138,0.5);transform:translateY(-1px); }
.vnkp-btn-pay:active:not(:disabled) { transform:translateY(0); }
.vnkp-btn-pay:disabled { opacity:0.5;cursor:not-allowed;transform:none;box-shadow:none; }
.vnkp-success { position:relative;overflow:hidden;border-radius:22px; }
.vnkp-success-bg { position:absolute;inset:0;background:linear-gradient(160deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%); }
.vnkp-success-content { position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:3rem 2rem;gap:0.85rem; }
.vnkp-success-ring { width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,#16A34A,#22C55E);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(22,163,74,0.35),0 0 0 12px rgba(22,163,74,0.1);animation:vnkpSuccessPop 0.5s cubic-bezier(.34,1.56,.64,1); }
@keyframes vnkpSuccessPop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
.vnkp-success-title { font-size:1.25rem;font-weight:800;color:#0F172A;letter-spacing:-0.02em; }
.vnkp-success-msg { font-size:0.875rem;color:#475569;line-height:1.6;max-width:320px; }
.vnkp-success-logo { display:flex;align-items:center;gap:7px;margin-top:0.25rem;font-size:0.75rem;color:#94A3B8;font-weight:600; }
.vnkp-btn-success { margin-top:0.5rem;padding:0.75rem 2.5rem;background:linear-gradient(135deg,#0F2D52,#1B4F8A);color:white;border:none;border-radius:11px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(27,79,138,0.35); }
@keyframes vnkpSpin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
.vnkp-spin { animation:vnkpSpin 0.75s linear infinite; }
@keyframes vnkpFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@media (max-width:520px) {
  .vnkp-sheet { border-radius:20px 20px 0 0;max-height:96vh; }
  .vnkp-backdrop { align-items:flex-end;padding:0; }
  .vnkp-row { flex-wrap:wrap; }
  .vnkp-amount-main { font-size:1.5rem; }
}
    `;
    document.head.appendChild(s);
}

/* ─── Compat legacy ─── */
function showConfirmPopup(msg) {
    return new Promise(resolve => {
        const ex = document.getElementById('_vnk_lc');
        if (ex) ex.remove();
        const p = document.createElement('div');
        p.id = '_vnk_lc';
        p.style.cssText = 'position:fixed;inset:0;background:rgba(8,14,28,0.55);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:1rem;font-family:"DM Sans",system-ui,sans-serif';
        p.innerHTML = `<div style="background:white;border-radius:16px;padding:2rem;max-width:380px;width:100%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.22)"><p style="font-size:0.95rem;color:#1E293B;margin-bottom:1.5rem;line-height:1.6">${msg}</p><div style="display:flex;gap:0.75rem;justify-content:center"><button id="_vnk_no" style="padding:0.65rem 1.5rem;background:#F1F5F9;color:#475569;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button><button id="_vnk_yes" style="padding:0.65rem 1.5rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit">Confirmer</button></div></div>`;
        document.body.appendChild(p);
        document.getElementById('_vnk_yes').onclick = () => { p.remove(); resolve(true); };
        document.getElementById('_vnk_no').onclick = () => { p.remove(); resolve(false); };
    });
}
function showSuccessPopup(title, msg) { _vnkToast(title + ' — ' + msg, 'success'); }
function showPaymentMessage(msg, type) { if (type === 'error') _vnkToast(msg, 'error'); }

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => { initStripe(); checkPaymentReturn(); });