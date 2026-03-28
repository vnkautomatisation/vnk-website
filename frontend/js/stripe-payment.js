/* ============================================
   VNK Automatisation Inc. - Stripe Payment
   ============================================ */

const stripePublishableKey = 'pk_test_51TErqtRnDD0deTI4BLVRIDRe8Jy1pfud8ibIoAXUgTi89OH7EQOVcn22KeE9DX8sDeTPiJB7lMyfvhRaRHTILbs600iS6ESs4W';
let stripeInstance = null;

// ---------- Show payment message ----------
function showPaymentMessage(message, type) {
    const existing = document.getElementById('payment-feedback');
    if (existing) {
        existing.className = `alert alert-${type}`;
        existing.textContent = message;
        existing.style.display = 'block';
    } else {
        // Si l'élément n'existe pas, affiche dans la console
        console.log(`Payment [${type}]: ${message}`);
    }
}

function initStripe() {
    // Correction: vérifier que Stripe est chargé et que la clé existe
    if (typeof Stripe !== 'undefined' && stripePublishableKey) {
        stripeInstance = Stripe(stripePublishableKey);
    }
}

// ---------- Pay Invoice ----------
async function payInvoice(invoiceId, amount) {
    if (!stripeInstance) {
        alert('Service de paiement non disponible. Veuillez rafraîchir la page.');
        return;
    }

    const formatted = new Intl.NumberFormat('fr-CA', {
        style: 'currency', currency: 'CAD'
    }).format(amount);

    const confirmed = await showConfirmPopup(`Confirmer le paiement de ${formatted} par carte de crédit ?`);
    if (!confirmed) return;

    try {
        showPaymentMessage('Initialisation du paiement...', 'info');

        const token = localStorage.getItem('vnk-token');
        const response = await fetch('/api/payments/create-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ invoice_id: invoiceId })
        });

        const data = await response.json();

        if (!data.success) {
            showPaymentMessage(data.message || 'Erreur lors de l\'initialisation du paiement.', 'error');
            return;
        }

        // Créer les éléments Stripe
        const elements = stripeInstance.elements({
            clientSecret: data.clientSecret,
            appearance: {
                theme: 'stripe',
                variables: {
                    colorPrimary: '#1B4F8A',
                    colorBackground: '#ffffff',
                    colorText: '#333333',
                    borderRadius: '8px',
                    fontFamily: 'Inter, Arial, sans-serif'
                }
            }
        });

        const paymentElement = elements.create('payment');
        showPaymentModal(invoiceId, amount, elements, paymentElement, data.clientSecret);

    } catch (error) {
        console.error('Payment error:', error);
        showPaymentMessage('Erreur de connexion. Veuillez réessayer.', 'error');
    }
}

// ---------- Show Payment Modal ----------
function showPaymentModal(invoiceId, amount, elements, paymentElement, clientSecret) {
    // Supprimer modal existant si présent
    const existing = document.getElementById('payment-modal');
    if (existing) existing.remove();

    const formatted = new Intl.NumberFormat('fr-CA', {
        style: 'currency', currency: 'CAD'
    }).format(amount);

    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.5);
        display:flex; align-items:center; justify-content:center;
        z-index:9999; padding:1rem;
    `;
    modal.innerHTML = `
        <div style="background:white; border-radius:12px; padding:1.5rem; width:100%; max-width:480px; box-shadow:0 20px 60px rgba(0,0,0,0.3)">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0; font-size:1.1rem; color:#1B4F8A">Paiement sécurisé</h3>
                <button onclick="closePaymentModal()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#888; line-height:1">×</button>
            </div>
            <p style="color:#666; font-size:0.9rem; margin-bottom:1rem;">Montant à payer : <strong style="color:#1B4F8A; font-size:1.1rem">${formatted}</strong></p>
            <div id="payment-element-container" style="margin-bottom:1rem;"></div>
            <div id="payment-modal-message" style="display:none; margin-bottom:1rem;"></div>
            <button id="pay-now-btn" onclick="confirmPayment()" style="width:100%; padding:0.85rem; background:#1B4F8A; color:white; border:none; border-radius:8px; font-size:1rem; font-weight:600; cursor:pointer;">
                Payer ${formatted}
            </button>
            <p style="text-align:center; font-size:0.75rem; color:#aaa; margin-top:0.75rem;">
                🔒 Paiement sécurisé par Stripe
            </p>
        </div>
    `;

    document.body.appendChild(modal);
    paymentElement.mount('#payment-element-container');

    window._stripeElements = elements;
    window._stripeClientSecret = clientSecret;
}

// ---------- Confirm Payment ----------
async function confirmPayment() {
    if (!stripeInstance || !window._stripeElements) return;

    const payBtn = document.getElementById('pay-now-btn');
    if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'Traitement...'; }

    try {
        const { error } = await stripeInstance.confirmPayment({
            elements: window._stripeElements,
            confirmParams: {
                return_url: `${window.location.origin}/portail.html?payment=success`
            }
        });

        if (error) {
            const msgEl = document.getElementById('payment-modal-message');
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.style.cssText = 'display:block; padding:0.75rem; background:#fef2f2; color:#c0392b; border-radius:6px; font-size:0.88rem; margin-bottom:1rem;';
                msgEl.textContent = error.message;
            }
            if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Réessayer'; }
        }
        // Si pas d'erreur, Stripe redirige vers return_url

    } catch (err) {
        console.error('Confirm payment error:', err);
        if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Réessayer'; }
    }
}

// ---------- Close Modal ----------
function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.remove();
    window._stripeElements = null;
    window._stripeClientSecret = null;
}

// ---------- Retour après paiement réussi ----------
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
            showSuccessPopup('Paiement réussi !', 'Votre facture a été marquée comme payée. Merci !');
            if (typeof loadAllData === 'function') loadAllData();
        }, 500);
    }
}

function showSuccessPopup(title, message) {
    const existing = document.getElementById('success-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'success-popup';
    popup.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.5);
        display:flex; align-items:center; justify-content:center;
        z-index:9999; padding:1rem;
    `;
    popup.innerHTML = `
        <div style="background:white; border-radius:16px; padding:2rem; width:100%; max-width:420px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.3)">
            <div style="width:64px; height:64px; background:#27AE60; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; font-size:2rem;">✓</div>
            <h3 style="margin:0 0 0.5rem; font-size:1.3rem; color:#1B4F8A">${title}</h3>
            <p style="color:#666; font-size:0.95rem; margin-bottom:1.5rem;">${message}</p>
            <button onclick="document.getElementById('success-popup').remove()" 
                style="padding:0.75rem 2rem; background:#1B4F8A; color:white; border:none; border-radius:8px; font-size:1rem; font-weight:600; cursor:pointer;">
                OK
            </button>
        </div>
    `;
    document.body.appendChild(popup);
}

function showConfirmPopup(message) {
    return new Promise((resolve) => {
        const existing = document.getElementById('confirm-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'confirm-popup';
        popup.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.5);
            display:flex; align-items:center; justify-content:center;
            z-index:9999; padding:1rem;
        `;
        popup.innerHTML = `
            <div style="background:white; border-radius:16px; padding:2rem; width:100%; max-width:400px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.3)">
                <div style="width:56px; height:56px; background:#EBF3FB; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; font-size:1.5rem;">💳</div>
                <h3 style="margin:0 0 0.75rem; font-size:1.1rem; color:#1B4F8A">Confirmer le paiement</h3>
                <p style="color:#666; font-size:0.95rem; margin-bottom:1.5rem;">${message}</p>
                <div style="display:flex; gap:0.75rem; justify-content:center;">
                    <button id="confirm-cancel" style="padding:0.75rem 1.5rem; background:#f1f1f1; color:#444; border:none; border-radius:8px; font-size:0.95rem; font-weight:600; cursor:pointer;">
                        Annuler
                    </button>
                    <button id="confirm-ok" style="padding:0.75rem 1.5rem; background:#1B4F8A; color:white; border:none; border-radius:8px; font-size:0.95rem; font-weight:600; cursor:pointer;">
                        Confirmer
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        document.getElementById('confirm-ok').onclick = () => {
            popup.remove();
            resolve(true);
        };
        document.getElementById('confirm-cancel').onclick = () => {
            popup.remove();
            resolve(false);
        };
    });
}

// ---------- Initialisation ----------
document.addEventListener('DOMContentLoaded', () => {
    initStripe();
    checkPaymentReturn();
});