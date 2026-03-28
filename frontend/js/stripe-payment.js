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

    if (!confirm(`Confirmer le paiement de ${formatted} par carte de crédit ?`)) return;

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
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Afficher message succès et rafraîchir
        setTimeout(() => {
            alert('Paiement réussi ! Votre facture a été marquée comme payée.');
            if (typeof loadAllData === 'function') loadAllData();
        }, 500);
    }
}

// ---------- Initialisation ----------
document.addEventListener('DOMContentLoaded', () => {
    initStripe();
    checkPaymentReturn();
});