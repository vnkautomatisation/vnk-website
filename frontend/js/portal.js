/* ============================================
   VNK Automatisation Inc. - Portal JavaScript
   ============================================ */

// ---------- Login form handler ----------
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    // Check if already logged in
    const token = localStorage.getItem('vnk-token');
    if (token) {
        showDashboard();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const loginBtn = document.getElementById('login-btn');
        const loginError = document.getElementById('login-error');
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span>Connexion...</span>';
        loginError.style.display = 'none';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                localStorage.setItem('vnk-token', data.token);
                localStorage.setItem('vnk-user', JSON.stringify(data.user));
                showDashboard();
            } else {
                loginError.textContent = data.message || 'Courriel ou mot de passe incorrect.';
                loginError.style.display = 'block';
            }
        } catch (error) {
            // Dev mode fallback
            loginError.textContent = 'Backend en développement. Portail disponible au lancement officiel.';
            loginError.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<span>Se connecter</span>';
        }
    });
});

// ---------- Show dashboard ----------
function showDashboard() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';

    const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');
    loadDashboardData();
}

// ---------- Load dashboard data ----------
async function loadDashboardData() {
    const token = localStorage.getItem('vnk-token');
    if (!token) return;

    try {
        // Load dashboard stats
        const dashResponse = await fetch('/api/clients/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (dashResponse.ok) {
            const data = await dashResponse.json();
            document.getElementById('active-mandates').textContent = data.activeMandates || 0;
            document.getElementById('pending-quotes').textContent = data.pendingQuotes || 0;
            document.getElementById('pending-invoices').textContent = data.pendingInvoices || 0;
        }

        // Load invoices
        const invoicesResponse = await fetch('/api/invoices', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (invoicesResponse.ok) {
            const invoiceData = await invoicesResponse.json();
            renderInvoices(invoiceData.invoices);
        }

        // Load quotes
        const quotesResponse = await fetch('/api/quotes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (quotesResponse.ok) {
            const quoteData = await quotesResponse.json();
            renderQuotes(quoteData.quotes);
        }

    } catch (error) {
        console.log('Dashboard data not available yet — backend in development');
    }
}

// ---------- Render Invoices ----------
function renderInvoices(invoices) {
    const activityList = document.getElementById('activity-list');

    if (!invoices || invoices.length === 0) {
        activityList.innerHTML = '<p class="no-activity">No invoices yet.</p>';
        return;
    }

    const unpaidInvoices = invoices.filter(inv => inv.status === 'unpaid');
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');

    let html = '';

    if (unpaidInvoices.length > 0) {
        html += '<h4 style="color:var(--color-primary); margin-bottom:0.5rem;">Unpaid Invoices</h4>';
        unpaidInvoices.forEach(invoice => {
            html += `
        <div class="activity-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; background:var(--color-white); border-radius:var(--border-radius); margin-bottom:0.5rem; border:1px solid var(--color-border);">
          <div>
            <strong style="color:var(--color-primary)">${invoice.invoice_number}</strong>
            <p style="font-size:0.85rem; color:var(--color-text-light); margin:0">${invoice.title}</p>
            <p style="font-size:0.8rem; color:var(--color-text-light); margin:0">Due: ${new Date(invoice.due_date).toLocaleDateString('fr-CA')}</p>
          </div>
          <div style="text-align:right;">
           <strong style="color:var(--color-primary); display:block">${formatCurrency(invoice.amount_ttc)}</strong>
            <div style="display:flex; gap:0.5rem; margin-top:0.25rem;">
              <button 
                class="btn btn-primary" 
                style="font-size:0.8rem; padding:0.4rem 0.75rem"
                onclick="payInvoice(${invoice.id}, ${invoice.amount_ttc})">
                Pay Now
              </button>
              <button 
                class="btn btn-outline" 
                style="font-size:0.8rem; padding:0.4rem 0.75rem"
                onclick="downloadPDF('invoices', ${invoice.id}, '${invoice.invoice_number}')">
                PDF
              </button>
            </div>
          </div>
        </div>
      `;
        });
    }

    if (paidInvoices.length > 0) {
        html += '<h4 style="color:var(--color-success); margin-bottom:0.5rem; margin-top:1rem;">Paid Invoices</h4>';
        paidInvoices.forEach(invoice => {
            html += `
        <div class="activity-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; background:rgba(39,174,96,0.05); border-radius:var(--border-radius); margin-bottom:0.5rem; border:1px solid rgba(39,174,96,0.2);">
          <div>
            <strong style="color:var(--color-success)">${invoice.invoice_number}</strong>
            <p style="font-size:0.85rem; color:var(--color-text-light); margin:0">${invoice.title}</p>
          </div>
          <div style="text-align:right;">
            <strong style="color:var(--color-success)">${formatCurrency(invoice.amount_ttc)}</strong>
            <span style="display:block; font-size:0.75rem; color:var(--color-success)">✓ Paid</span>
            <span style="display:block; font-size:0.75rem; color:var(--color-success)">✓ Paid</span>
            <button
              class="btn btn-outline"
              style="font-size:0.8rem; padding:0.4rem 0.75rem; margin-top:0.25rem"
              onclick="downloadPDF('invoices', ${invoice.id}, '${invoice.invoice_number}')">
              PDF
            </button>
          </div>
        </div>
      `;
        });
    }

    activityList.innerHTML = html;
}

// ---------- Download PDF ----------
async function downloadPDF(type, id, number) {
    const token = localStorage.getItem('vnk-token');

    try {
        const response = await fetch(`/api/${type}/${id}/pdf`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VNK-${number}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        }
    } catch (error) {
        console.error('PDF download error:', error);
    }
}

// ---------- Render Quotes ----------
function renderQuotes(quotes) {
    const pendingQuotes = quotes ? quotes.filter(q => q.status === 'pending') : [];

    const pendingEl = document.getElementById('pending-quotes');
    if (pendingEl) {
        pendingEl.textContent = pendingQuotes.length;
    }
}

// ---------- Logout ----------
function logout() {
    localStorage.removeItem('vnk-token');
    localStorage.removeItem('vnk-user');
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('dashboard-view').style.display = 'none';
}