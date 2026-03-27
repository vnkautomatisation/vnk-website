/* ============================================
   VNK Automatisation Inc. - Stripe Payment
   ============================================ */

// Initialize Stripe with publishable key
const stripePublishableKey = 'pk_test_51TErqtRnDD0deTI4BLVRIDRe8Jy1pfud8ibIoAXUgTi89OH7EQOVcn22KeE9DX8sDeTPiJB7lMyfvhRaRHTILbs600iS6ESs4W'; // Replace with your key
let stripeInstance = null;

function initStripe() {
    if (stripePublishableKey && stripePublishableKey !== 'pk_test_51TErqtRnDD0deTI4BLVRIDRe8Jy1pfud8ibIoAXUgTi89OH7EQOVcn22KeE9DX8sDeTPiJB7lMyfvhRaRHTILbs600iS6ESs4W') {
        stripeInstance = Stripe(stripePublishableKey);
    }
}

// ---------- Pay Invoice ----------
async function payInvoice(invoiceId, amount) {
    if (!stripeInstance) {
        showPaymentMessage('Payment service not configured yet.', 'error');
        return;
    }

    try {
        // Show loading state
        showPaymentMessage('Initializing payment...', 'info');

        // Create payment intent on backend
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
            showPaymentMessage(data.message || 'Payment initialization failed.', 'error');
            return;
        }

        // Create payment element
        const elements = stripeInstance.elements({
            clientSecret: data.clientSecret,
            appearance: {
                theme: 'stripe',
                variables: {
                    colorPrimary: '#1B4F8A',
                    colorBackground: '#ffffff',
                    colorText: '#444444',
                    borderRadius: '8px',
                    fontFamily: 'Inter, Arial, sans-serif'
                }
            }
        });

        const paymentElement = elements.create('payment');

        // Show payment modal
        showPaymentModal(invoiceId, amount, elements, paymentElement, data.clientSecret);

    } catch (error) {
        console.error('Payment error:', error);
        showPaymentMessage('Payment error. Please try again.', 'error');
    }
}

// ---------- Show Payment Modal ----------
function showPaymentModal(invoiceId, amount, elements, paymentElement, clientSecret) {
    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Pay Invoice — ${formatCurrency(amount)}</span>
        <button class="modal-close" onclick="closePaymentModal()">×</button>
      </div>
      <div id="payment-element-container" style="margin: 1rem 0;"></div>
      <div id="payment-messages" style="margin: 0.5rem 0;"></div>
      <button class="btn btn-primary" style="width:100%" id="pay-now-btn" onclick="confirmPayment()">
        Pay ${formatCurrency(amount)}
      </button>
    </div>
  `;

    document.body.appendChild(modal);

    // Mount Stripe payment element
    paymentElement.mount('#payment-element-container');

    // Store references for confirmation
    window._stripeElements = elements;
    window._stripeClientSecret = clientSecret;
}

// ---------- Confirm Payment ----------
async function confirmPayment() {
    if (!stripeInstance || !window._stripeElements) return;

    const payBtn = document.getElementById('pay-now-btn');
    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';

    try {
        const { error } = await stripeInstance.confirmPayment({
            elements: window._stripeElements,
            confirmParams: {
                return_url: `${window.location.origin}/portail.html?payment=success`
            }
        });

        if (error) {
            showModalMessage(error.message, 'error');
            payBtn.disabled = false;
            payBtn.textContent = 'Try Again';
        }
        // If no error, Stripe redirects to return_url

    } catch (err) {
        console.error('Confirm payment error:', err);
        showModalMessage('Payment failed. Please try again.', 'error');
        payBtn.disabled = false;
        payBtn.textContent = 'Try Again';
    }
}

// ---------- Close Payment Modal ----------
function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.remove();
    window._stripeElements = null;
    window._stripeClientSecret = null;
}

// ---------- Check Payment Success on Return ----------
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        showPaymentMessage('Payment successful! Your invoice has been marked as paid.', 'success');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ---------- Helpers ----------
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(amount);
}

function showPaymentMessage(message, type) {
    const existing = document.getElementById('payment-feedback');
    if (existing) {
        existing.className = `alert alert-${type}`;
        existing.textContent = message;
        existing.style.display = 'block';
    }
}

function showModalMessage(message, type) {
    const container = document.getElementById('payment-messages');
    if (container) {
        container.className = `alert alert-${type}`;
        container.textContent = message;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initStripe();
    checkPaymentReturn();
});
