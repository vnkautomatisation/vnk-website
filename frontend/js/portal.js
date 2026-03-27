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
        const response = await fetch('/api/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('active-mandates').textContent = data.activeMandates || 0;
            document.getElementById('pending-quotes').textContent = data.pendingQuotes || 0;
            document.getElementById('pending-invoices').textContent = data.pendingInvoices || 0;
        }
    } catch (error) {
        console.log('Dashboard data not available yet — backend in development');
    }
}

// ---------- Logout ----------
function logout() {
    localStorage.removeItem('vnk-token');
    localStorage.removeItem('vnk-user');
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('dashboard-view').style.display = 'none';
}