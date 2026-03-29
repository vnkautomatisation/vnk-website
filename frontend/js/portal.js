/* ============================================
   VNK Automatisation Inc. — Portal JavaScript
   Version complète — Mars 2026
   ============================================ */

function togglePortalSidebar() {
    const sidebar = document.querySelector('.portal-sidebar');
    const overlay = document.getElementById('portal-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    const savedEmail = localStorage.getItem('vnk-portal-email');
    if (savedEmail) {
        const emailEl = document.getElementById('login-email');
        const rememberEl = document.getElementById('remember-me');
        if (emailEl) emailEl.value = savedEmail;
        if (rememberEl) rememberEl.checked = true;
    }
    const token = localStorage.getItem('vnk-token');
    if (token) showDashboard();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const loginBtn = document.getElementById('login-btn');
        const loginError = document.getElementById('login-error');
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('remember-me')?.checked;
        if (remember) localStorage.setItem('vnk-portal-email', email);
        else localStorage.removeItem('vnk-portal-email');
        loginBtn.disabled = true;
        loginBtn.textContent = 'Connexion...';
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
        } catch {
            loginError.textContent = 'Erreur de connexion. Veuillez réessayer.';
            loginError.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Se connecter';
        }
    });
});

function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'grid';
    const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');
    const name = user.name || user.full_name || 'VNK';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase();
    const el = (id) => document.getElementById(id);
    if (el('sidebar-avatar')) el('sidebar-avatar').textContent = initials;
    if (el('sidebar-name')) el('sidebar-name').textContent = name;
    if (el('sidebar-company')) el('sidebar-company').textContent = user.company || user.company_name || '';
    if (el('mobile-avatar')) el('mobile-avatar').textContent = initials.substring(0, 2);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    if (el('dashboard-greeting')) el('dashboard-greeting').textContent = greeting + ', ' + name.split(' ')[0] + ' !';
    loadAllData();
    startPolling();
    // Restaurer l'onglet actif
    const savedTab = localStorage.getItem('vnk-portal-tab');
    if (savedTab && savedTab !== 'dashboard') showTab(savedTab);
}

async function authFetch(url) {
    const token = localStorage.getItem('vnk-token');
    if (!token) return null;
    try {
        const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
        if (r.status === 401 || r.status === 403) { logout(); return null; }
        if (!r.ok) return null;
        const text = await r.text();
        if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return null;
        return JSON.parse(text);
    } catch (e) { return null; }
}

async function loadAllData() {
    const token = localStorage.getItem('vnk-token');
    if (!token) return;
    try {
        const [dash, quotes, invoices, messages, docs, mandates, contracts] = await Promise.all([
            authFetch('/api/clients/dashboard'),
            authFetch('/api/quotes'),
            authFetch('/api/invoices'),
            authFetch('/api/messages'),
            authFetch('/api/documents'),
            authFetch('/api/mandates'),
            authFetch('/api/contracts'),
        ]);
        const el = (id) => document.getElementById(id);
        if (dash) {
            if (el('stat-mandates')) el('stat-mandates').textContent = dash.activeMandates || 0;
            if (el('stat-quotes')) el('stat-quotes').textContent = dash.pendingQuotes || 0;
            if (el('stat-invoices')) el('stat-invoices').textContent = dash.pendingInvoices || 0;
            if (dash.pendingQuotes > 0) showBadge('badge-quotes', dash.pendingQuotes);
            if (dash.pendingInvoices > 0) showBadge('badge-invoices', dash.pendingInvoices);
            if (dash.activeMandates > 0) showBadge('badge-mandates', dash.activeMandates);
            renderActivity(dash.recentActivity || []);
        }
        if (quotes) {
            window._allQuotes = quotes.quotes || [];
            const pendingQuotes = window._allQuotes.filter(q => q.status === 'pending');
            renderQuotes(window._allQuotes);
            if (pendingQuotes.length > 0) showBadge('badge-quotes', pendingQuotes.length);
        } else {
            const qlist = el('quotes-list');
            if (qlist) qlist.innerHTML = '<div style="padding:1rem;background:#FEF3C7;border-radius:8px;border-left:3px solid #D97706;font-size:0.85rem;color:#92400E"><strong>Session expirée.</strong> <a href="#" onclick="logout()" style="color:#92400E">Reconnectez-vous</a> pour voir vos devis.</div>';
        }
        if (invoices) {
            window._allInvoices = invoices.invoices || [];
            renderInvoices(window._allInvoices);
            const unpaid = window._allInvoices.filter(i => i.status === 'unpaid' || i.status === 'overdue').length;
            if (unpaid > 0) showBadge('badge-invoices', unpaid);
        }
        if (docs) {
            const docsArr = docs.documents || [];
            window._allDocuments = docsArr;
            renderDocuments(docsArr);
            // Badge basé sur les documents non lus
            const unread = _getUnreadDocs(docsArr);
            const navBadge = document.getElementById('badge-documents');
            if (navBadge) {
                if (unread.length > 0) { navBadge.textContent = unread.length; navBadge.style.display = 'inline-block'; }
                else navBadge.style.display = 'none';
            }
        }
        if (mandates) {
            const mArr = mandates.mandates || [];
            window._allMandates = mArr;
            renderMandates(mArr);
            const activeMandates = mArr.filter(m => m.status === 'active' || m.status === 'in_progress').length;
            if (activeMandates > 0) showBadge('badge-mandates', activeMandates);
        }
        if (contracts) {
            window._allContracts = contracts.contracts || [];
            // Reset filtre à "Tous" au rechargement auto
            const cf = document.getElementById('contract-filter');
            if (cf && cf.value !== 'all') { } // garder le filtre choisi par l'user
            renderPortalContracts(window._allContracts);
            const pending = window._allContracts.filter(c => c.status === 'pending_signature' || c.status === 'pending').length;
            if (pending > 0) showBadge('badge-contracts', pending);
        }
        if (messages) {
            const unread = (messages.messages || []).filter(m => !m.is_read && m.sender === 'vnk').length;
            if (el('stat-messages')) el('stat-messages').textContent = unread;
            // Notifier le widget chat flottant
            if (typeof vnkChatNotify === 'function') vnkChatNotify(messages.messages || [], unread);
        }
        const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');
        renderProfile(user);
    } catch (error) { console.log('Data loading error:', error); }
}

let _pollingInterval = null;
function startPolling() {
    if (_pollingInterval) clearInterval(_pollingInterval);
    _pollingInterval = setInterval(loadAllData, 30000);
}
function stopPolling() {
    if (_pollingInterval) { clearInterval(_pollingInterval); _pollingInterval = null; }
}

function showTab(tabName) {
    document.querySelectorAll('.portal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.portal-nav-item').forEach(n => n.classList.remove('active'));
    const tab = document.getElementById('tab-' + tabName);
    if (tab) tab.classList.add('active');
    document.querySelectorAll('.portal-nav-item').forEach(btn => {
        if (btn.getAttribute('onclick') === "showTab('" + tabName + "')") btn.classList.add('active');
    });
    const sidebar = document.querySelector('.portal-sidebar');
    const overlay = document.getElementById('portal-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    const titles = { profile: 'Mon profil', dashboard: 'Tableau de bord', mandates: 'Mes mandats', quotes: 'Mes devis', invoices: 'Mes factures', contracts: 'Mes contrats', documents: 'Mes documents' };
    const mobileTitle = document.getElementById('mobile-tab-title');
    if (mobileTitle) mobileTitle.textContent = titles[tabName] || '';
    localStorage.setItem('vnk-portal-tab', tabName);
    // Marquer les documents comme vus
    if (tabName === 'documents') {
        (window._allDocuments || []).forEach(d => _markDocRead(d.id));
        const badge = document.getElementById('badge-documents');
        if (badge) badge.style.display = 'none';
        // Re-render pour enlever les badges NOUVEAU
        if (window._allDocuments?.length) renderDocuments(window._allDocuments);
    }
    window.scrollTo(0, 0);
}

function showBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) { badge.style.display = 'inline-block'; badge.textContent = count; }
}

function renderProfile(user) {
    const el = document.getElementById('profile-content');
    if (!el) return;
    const name = user.name || user.full_name || '—';
    const company = user.company || user.company_name || '—';
    const pRow = (l, v) => '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0;border-bottom:0.5px solid #E2E8F0;font-size:0.83rem"><span style="color:#64748B;min-width:110px">' + l + '</span><span style="font-weight:600;color:#1E293B;text-align:right">' + (v || '—') + '</span></div>';
    const cityStr = user.city ? (user.city + (user.province ? ', ' + user.province : '') + (user.postal_code ? ' ' + user.postal_code : '')) : null;
    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1rem">' +
        '<div style="background:#F8FAFC;border-radius:10px;padding:1.25rem;border:1px solid #E2E8F0">' +
        '<h4 style="font-size:0.8rem;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem">Informations personnelles</h4>' +
        pRow('Nom complet', name) + pRow('Courriel', user.email) + pRow('Entreprise', company) +
        pRow('Téléphone', user.phone) + pRow('Adresse', user.address) + pRow('Ville', cityStr) + pRow('Secteur', user.sector) +
        '</div>' +
        '<div style="background:#F8FAFC;border-radius:10px;padding:1.25rem;border:1px solid #E2E8F0">' +
        '<h4 style="font-size:0.8rem;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem">Compte VNK</h4>' +
        pRow('Portail', '<span style="color:#27AE60;font-weight:700">Actif ✓</span>') +
        pRow('Technologies', user.technologies) +
        pRow('Devis', (window._allQuotes || []).length + ' devis') +
        pRow('Contrats', (window._allContracts || []).length + ' contrat(s)') +
        pRow('Membre depuis', user.created_at ? new Date(user.created_at).toLocaleDateString('fr-CA') : null) +
        '</div></div>' +
        '<div style="background:#F8FAFC;border-radius:10px;padding:1.25rem;border:1px solid #E2E8F0;margin-bottom:1rem">' +
        '<h4 style="font-size:0.8rem;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem">Changer le mot de passe</h4>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;align-items:end">' +
        '<div><label style="font-size:0.78rem;color:#64748B;display:block;margin-bottom:4px">Mot de passe actuel</label><input type="password" id="pw-current" style="width:100%;padding:0.5rem 0.75rem;border:1px solid #E2E8F0;border-radius:6px;font-size:0.85rem;box-sizing:border-box"></div>' +
        '<div><label style="font-size:0.78rem;color:#64748B;display:block;margin-bottom:4px">Nouveau mot de passe</label><input type="password" id="pw-new" style="width:100%;padding:0.5rem 0.75rem;border:1px solid #E2E8F0;border-radius:6px;font-size:0.85rem;box-sizing:border-box"></div>' +
        '<div><label style="font-size:0.78rem;color:#64748B;display:block;margin-bottom:4px">Confirmer</label><input type="password" id="pw-confirm" style="width:100%;padding:0.5rem 0.75rem;border:1px solid #E2E8F0;border-radius:6px;font-size:0.85rem;box-sizing:border-box"></div>' +
        '</div><div style="display:flex;align-items:center;gap:1rem;margin-top:0.75rem">' +
        '<button onclick="changePassword()" style="padding:0.5rem 1.25rem;background:#1B4F8A;color:white;border:none;border-radius:6px;font-size:0.82rem;font-weight:600;cursor:pointer">Changer le mot de passe</button>' +
        '<span id="pw-msg" style="font-size:0.8rem"></span></div></div>' +
        '<div style="background:#EBF5FB;border-radius:10px;padding:1rem 1.25rem;border-left:3px solid #1B4F8A;font-size:0.82rem;color:#1B4F8A">' +
        'Pour modifier vos coordonnées, contactez VNK à <strong>vnkautomatisation@gmail.com</strong></div>';
}

async function changePassword() {
    const current = document.getElementById('pw-current')?.value;
    const newPw = document.getElementById('pw-new')?.value;
    const confirm = document.getElementById('pw-confirm')?.value;
    const msg = document.getElementById('pw-msg');
    if (!current || !newPw || !confirm) { msg.textContent = 'Tous les champs sont requis.'; msg.style.color = '#E74C3C'; return; }
    if (newPw !== confirm) { msg.textContent = 'Les mots de passe ne correspondent pas.'; msg.style.color = '#E74C3C'; return; }
    if (newPw.length < 8) { msg.textContent = 'Minimum 8 caractères.'; msg.style.color = '#E74C3C'; return; }
    const token = localStorage.getItem('vnk-token');
    try {
        const r = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ currentPassword: current, newPassword: newPw }) });
        const d = await r.json();
        if (d.success) { msg.textContent = '✓ Mot de passe changé.'; msg.style.color = '#27AE60';['pw-current', 'pw-new', 'pw-confirm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
        else { msg.textContent = d.message || 'Erreur.'; msg.style.color = '#E74C3C'; }
    } catch { msg.textContent = 'Erreur de connexion.'; msg.style.color = '#E74C3C'; }
}

function renderActivity(activities) {
    const list = document.getElementById('activity-list');
    if (!list) return;
    if (!activities.length) { list.innerHTML = '<p class="portal-empty">Aucune activité récente.</p>'; return; }
    const icons = { invoice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>', quote: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E07820" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', mandate: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' };
    const bgs = { invoice: 'rgba(27,79,138,0.07)', quote: 'rgba(224,120,32,0.07)', mandate: 'rgba(39,174,96,0.07)' };
    const labels = { invoice: 'Facture', quote: 'Devis', mandate: 'Mandat', document: 'Document' };
    list.innerHTML = activities.map(a => {
        const icon = icons[a.type] || icons.mandate;
        const bg = bgs[a.type] || bgs.mandate;
        const date = new Date(a.date).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
        const amt = a.amount ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(a.amount) : '';
        return '<div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid var(--color-border)">' +
            '<div style="width:34px;height:34px;border-radius:8px;background:' + bg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon + '</div>' +
            '<div style="flex:1;min-width:0"><div style="font-size:0.88rem;font-weight:600;color:var(--color-text);margin-bottom:0.2rem">' + a.description + '</div>' +
            '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap"><span style="font-size:0.72rem;font-weight:600;color:white;background:var(--color-primary);padding:0.1rem 0.5rem;border-radius:10px">' + (labels[a.type] || 'Activité') + '</span>' +
            (amt ? '<span style="font-size:0.78rem;font-weight:700;color:var(--color-primary)">' + amt + '</span>' : '') + '</div>' +
            '<div style="font-size:0.72rem;color:var(--color-text-light);margin-top:0.25rem">' + date + '</div></div></div>';
    }).join('');
}

function renderMandates(mandates) {
    const list = document.getElementById('mandates-list');
    if (!list) return;
    // Bouton "Démarrer un projet" toujours visible dans le header
    const startBtn = document.getElementById('mandate-start-btn');
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (!mandates.length) { list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><p>Aucun mandat actif pour l\'instant.</p></div>'; return; }
    const stl = { active: 'En cours', in_progress: 'En cours', pending: 'En attente', completed: 'Complété', paused: 'En pause' };
    const svl = { 'plc-support': 'Support PLC', audit: 'Audit technique', documentation: 'Documentation', refactoring: 'Refactorisation' };
    list.innerHTML = mandates.map(m => '<div class="portal-list-item"><div style="flex:1"><div class="portal-item-title">' + m.title + '</div>' +
        '<div class="portal-item-desc">' + (m.description || '') + '</div>' +
        '<div class="portal-item-meta">' + (m.service_type ? '<span style="background:#EBF5FB;color:#1B4F8A;padding:0.15rem 0.5rem;border-radius:10px;font-size:0.72rem;font-weight:600">' + (svl[m.service_type] || m.service_type) + '</span>' : '') +
        '<span>Début: ' + new Date(m.start_date || m.created_at).toLocaleDateString('fr-CA') + '</span>' + (m.end_date ? '<span>Fin: ' + new Date(m.end_date).toLocaleDateString('fr-CA') + '</span>' : '') + '</div>' +
        '<div class="portal-progress"><div class="portal-progress-label"><span>Progression</span><span>' + (m.progress || 0) + '%</span></div><div class="portal-progress-bar"><div class="portal-progress-fill" style="width:' + (m.progress || 0) + '%"></div></div></div>' +
        (m.notes ? '<div style="margin-top:0.75rem;padding:0.6rem 0.75rem;background:var(--color-light-blue);border-radius:6px;font-size:0.82rem;color:var(--color-primary);border-left:3px solid var(--color-primary)"><strong>Note de VNK :</strong> ' + m.notes + '</div>' : '') +
        '</div><div class="portal-item-actions"><span class="portal-status portal-status-' + m.status + '">' + (stl[m.status] || m.status) + '</span></div></div>').join('');
}

function renderQuotes(quotes) {
    const list = document.getElementById('quotes-list');
    if (!list) return;
    if (!quotes.length) { list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Aucun devis disponible.</p></div>'; return; }
    const sl = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé', expired: 'Expiré' };
    const sc = { pending: '#D97706', accepted: '#27AE60', declined: '#E74C3C', expired: '#94A3B8' };
    const svl = { 'plc-support': 'Support PLC', 'audit': 'Audit technique', 'documentation': 'Documentation', 'refactoring': 'Refactorisation' };
    list.innerHTML = quotes.map(q => {
        const color = sc[q.status] || '#94A3B8';
        const svc = q.service_type ? (svl[q.service_type] || q.service_type) : null;
        const isExpired = q.expiry_date && new Date(q.expiry_date) < new Date();
        return '<div style="display:grid;grid-template-columns:110px 1fr auto 52px 62px;align-items:center;gap:0.5rem;padding:0.4rem 0.75rem;border-bottom:1px solid #F1F5F9;background:white;transition:background 0.1s" onmouseover="this.style.background=\'#FAFCFF\'" onmouseout="this.style.background=\'white\'">' +
            '<div style="display:flex;flex-direction:column;gap:1px">' +
            '<strong style="font-size:0.8rem;color:#1B4F8A;white-space:nowrap">' + q.quote_number + '</strong>' +
            '<span style="background:' + color + '22;color:' + color + ';font-size:0.63rem;font-weight:700;padding:1px 5px;border-radius:6px;width:fit-content">' + (sl[q.status] || q.status) + '</span>' +
            '</div>' +
            '<div class="portal-item-meta" style="margin-top:0.3rem;background:#F8FAFC;padding:3px 6px;border-radius:4px">' +
            '<span>HT : <strong>' + formatCurrency(q.amount_ht) + '</strong></span>' +
            '<span>TPS : ' + formatCurrency(q.tps_amount) + '</span>' +
            '<span>TVQ : ' + formatCurrency(q.tvq_amount) + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="portal-item-actions">' +
            '<span class="portal-item-amount">' + formatCurrency(q.amount_ttc) + '</span>' +
            '<span style="background:' + color + '22;color:' + color + ';font-size:0.72rem;font-weight:600;padding:2px 8px;border-radius:4px">' + (sl[q.status] || q.status) + '</span>' +
            '<div style="display:flex;gap:0.4rem;margin-top:0.3rem">' +
            '<button class="btn btn-outline btn-sm" onclick="downloadPDF(\'quotes\',' + q.id + ',\'' + q.quote_number + '\')">PDF</button>' +
            (q.status === 'pending' ? '<button class="btn btn-primary btn-sm" onclick="acceptQuote(' + q.id + ')">Accepter</button>' : '') +
            '</div></div></div>';
    }).join('');
}

function filterQuotes() {
    const search = (document.getElementById('quote-search')?.value || '').toLowerCase();
    const status = document.getElementById('quote-filter')?.value || 'all';
    let list = window._allQuotes || [];
    if (status !== 'all') list = list.filter(q => q.status === status);
    if (search) list = list.filter(q => ((q.quote_number || '') + ' ' + (q.title || '')).toLowerCase().includes(search));
    renderQuotes(list);
}

function renderInvoices(invoices) {
    const list = document.getElementById('invoices-list');
    if (!list) return;
    if (!invoices.length) { list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg><p>Aucune facture disponible.</p></div>'; return; }
    const sl = { unpaid: 'Non payée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' };
    const sc = { unpaid: '#D97706', paid: '#27AE60', overdue: '#E74C3C', cancelled: '#94A3B8' };
    list.innerHTML = invoices.map(inv => {
        const color = sc[inv.status] || '#94A3B8';
        const isPaid = inv.status === 'paid';
        const isOverdue = inv.status === 'overdue';
        const lb = isPaid ? 'border-left:2px solid #27AE60;' : isOverdue ? 'border-left:2px solid #E74C3C;' : '';
        return '<div style="display:grid;grid-template-columns:110px 1fr auto 52px 62px;align-items:center;gap:0.5rem;padding:0.4rem 0.75rem;border-bottom:1px solid #F1F5F9;background:white;' + lb + 'transition:background 0.1s" onmouseover="this.style.background=\'#FAFCFF\'" onmouseout="this.style.background=\'white\'">' +
            '<div style="display:flex;flex-direction:column;gap:1px">' +
            '<strong style="font-size:0.8rem;color:#1B4F8A;white-space:nowrap">' + inv.invoice_number + '</strong>' +
            '<span style="background:' + color + '22;color:' + color + ';font-size:0.63rem;font-weight:700;padding:1px 5px;border-radius:6px;width:fit-content">' + (sl[inv.status] || inv.status) + '</span>' +
            '</div>' +
            '<div class="portal-item-meta" style="margin-top:0.3rem;background:#F8FAFC;padding:3px 6px;border-radius:4px">' +
            '<span>HT : <strong>' + formatCurrency(inv.amount_ht) + '</strong></span>' +
            '<span>TPS : ' + formatCurrency(inv.tps_amount) + '</span>' +
            '<span>TVQ : ' + formatCurrency(inv.tvq_amount) + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="portal-item-actions">' +
            '<span class="portal-item-amount" style="color:' + (isPaid ? '#27AE60' : 'var(--color-primary)') + '">' + formatCurrency(inv.amount_ttc) + '</span>' +
            '<span style="background:' + color + '22;color:' + color + ';font-size:0.72rem;font-weight:600;padding:2px 8px;border-radius:4px">' + (sl[inv.status] || inv.status) + '</span>' +
            '<div style="display:flex;gap:0.4rem;margin-top:0.3rem">' +
            '<button class="btn btn-outline btn-sm" onclick="downloadPDF(\'invoices\',' + inv.id + ',\'' + inv.invoice_number + '\')">PDF</button>' +
            (inv.status === 'unpaid' || inv.status === 'overdue' ? '<button class="btn btn-primary btn-sm" onclick="payInvoice(' + inv.id + ',' + inv.amount_ttc + ')">Payer</button>' : '') +
            '</div></div></div>';
    }).join('');
}

function filterInvoices() {
    const search = (document.getElementById('invoice-search')?.value || '').toLowerCase();
    const status = document.getElementById('invoice-filter')?.value || 'all';
    let list = window._allInvoices || [];
    if (status !== 'all') list = list.filter(i => i.status === status);
    if (search) list = list.filter(i => ((i.invoice_number || '') + ' ' + (i.title || '')).toLowerCase().includes(search));
    renderInvoices(list);
}

function renderPortalContracts(contracts) {
    const list = document.getElementById('contracts-list');
    if (!list) return;
    // Masquer les brouillons — le client ne les voit pas
    const visible = (contracts || []).filter(c => c.status !== 'draft');
    if (!visible.length) { list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Aucun contrat disponible.</p></div>'; return; }
    const sl = { pending: 'En attente de signature', pending_signature: 'En attente de signature', viewed: 'Consulté', signed: 'Signé' };
    const sc = { pending: '#D97706', pending_signature: '#D97706', viewed: '#2E86AB', signed: '#27AE60' };
    list.innerHTML = visible.map(c => {
        const color = sc[c.status] || '#94A3B8';
        // needsSign = en attente de signature (pending ou pending_signature)
        const needsSign = c.status === 'pending' || c.status === 'pending_signature';
        const isSigned = c.status === 'signed';
        return '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:1rem 1.25rem;margin-bottom:0.75rem;background:white;' + (needsSign ? 'border-left:3px solid #D97706;' : isSigned ? 'border-left:3px solid #27AE60;' : '') + '">' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">' +
            '<div style="flex:1">' +
            '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;flex-wrap:wrap">' +
            '<strong style="font-size:0.9rem;color:#1B4F8A">' + c.contract_number + '</strong>' +
            '<span style="background:' + color + '22;color:' + color + ';font-size:0.72rem;font-weight:600;padding:2px 8px;border-radius:4px">' + (sl[c.status] || c.status) + '</span>' +
            '</div>' +
            '<div style="font-size:0.88rem;font-weight:600;color:#1E293B;margin-bottom:0.2rem">' + c.title + '</div>' +
            '<div style="font-size:0.75rem;color:#94A3B8">' +
            (c.quote_number ? 'Devis ' + c.quote_number + ' · ' : '') +
            new Date(c.created_at).toLocaleDateString('fr-CA') +
            (c.signed_at ? ' · Signé le ' + new Date(c.signed_at).toLocaleDateString('fr-CA') : '') +
            '</div>' +
            (needsSign ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:#D97706;font-weight:600;display:flex;align-items:center;gap:5px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Ce contrat requiert votre signature</div>' : '') +
            (isSigned ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:#27AE60;font-weight:600;display:flex;align-items:center;gap:5px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Contrat signé</div>' : '') +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:0.4rem;flex-shrink:0">' +
            // Bouton SIGNER — seulement si en attente de signature
            (needsSign ?
                '<button onclick="signContract(' + c.id + ',' + JSON.stringify(c.hellosign_request_id || '') + ',' + JSON.stringify(c.file_url || '') + ')" style="display:flex;align-items:center;gap:5px;padding:0.5rem 1rem;border:none;border-radius:8px;background:#D97706;color:white;font-size:0.82rem;font-weight:600;cursor:pointer;white-space:nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Signer</button>' : '') +
            // Bouton VOIR PDF signé — seulement si signé
            (isSigned ?
                '<a href="/api/contracts/' + c.id + '/pdf" target="_blank" style="display:flex;align-items:center;gap:5px;padding:0.5rem 1rem;border:1.5px solid #27AE60;border-radius:8px;color:#27AE60;font-size:0.82rem;font-weight:600;text-decoration:none;white-space:nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Voir le contrat</a>' +
                '<a href="/api/contracts/' + c.id + '/pdf" download style="display:flex;align-items:center;gap:5px;padding:0.5rem 1rem;border:1.5px solid #E2E8F0;border-radius:8px;color:#64748B;font-size:0.82rem;font-weight:600;text-decoration:none;white-space:nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Télécharger</a>' : '') +
            '</div></div></div>';
    }).join('');
}

function filterContracts() {
    const search = (document.getElementById('contract-search')?.value || '').toLowerCase();
    const status = document.getElementById('contract-filter')?.value || 'all';
    let list = window._allContracts || [];
    if (status !== 'all') list = list.filter(c => c.status === status);
    if (search) list = list.filter(c => ((c.contract_number || '') + ' ' + (c.title || '')).toLowerCase().includes(search));
    renderPortalContracts(list);
}

// ── Documents — helpers lu/non-lu ──────────────
function _getReadDocs() {
    try { return JSON.parse(localStorage.getItem('vnk-read-docs') || '[]'); } catch { return []; }
}
// Téléchargement robuste — gère data: URI et URL normale
function downloadDoc(id) {
    const doc = (window._allDocuments || []).find(d => d.id === id);
    if (!doc || !doc.file_url) return;
    _markDocRead(id);
    _updateDocItem(id);
    if (doc.file_url.startsWith('data:')) {
        // Convertir data: URI en blob pour download
        try {
            const arr = doc.file_url.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            const u8arr = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
            const blob = new Blob([u8arr], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.file_name || doc.title + '.pdf';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
        } catch (e) { console.error('Download error:', e); }
    } else {
        // URL normale
        const a = document.createElement('a');
        a.href = doc.file_url;
        a.download = doc.file_name || doc.title;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}

function _markDocRead(id) {
    const read = _getReadDocs();
    if (!read.includes(id)) { read.push(id); localStorage.setItem('vnk-read-docs', JSON.stringify(read)); }
}
function _getUnreadDocs(docs) {
    const read = _getReadDocs();
    return docs.filter(d => !read.includes(d.id));
}

window._docSortState = 'date-desc';
window._docSearch = '';

function filterDocuments() {
    const search = (document.getElementById('doc-search')?.value || '').toLowerCase();
    window._docSearch = search;
    let list = window._allDocuments || [];
    if (search) list = list.filter(d => (d.title || '').toLowerCase().includes(search) || (d.description || '').toLowerCase().includes(search));
    list = _sortDocs(list, window._docSortState);
    renderDocuments(list);
}

function _sortDocs(arr, val) {
    return [...arr].sort((a, b) => {
        if (val === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
        if (val === 'date-asc') return new Date(a.created_at) - new Date(b.created_at);
        if (val === 'name-asc') return (a.title || '').localeCompare(b.title || '');
        if (val === 'name-desc') return (b.title || '').localeCompare(a.title || '');
        if (val === 'unread') return _getReadDocs().includes(a.id) - _getReadDocs().includes(b.id);
        return 0;
    });
}

function toggleDocSort() {
    const opts = [['date-desc', 'Date ↓'], ['date-asc', 'Date ↑'], ['name-asc', 'Nom A→Z'], ['name-desc', 'Nom Z→A'], ['unread', 'Non lus en premier']];
    const existing = document.getElementById('sort-dropdown-docs');
    if (existing) { existing.remove(); return; }
    const btn = document.getElementById('doc-sort-btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.id = 'sort-dropdown-docs';
    dd.style.cssText = 'position:fixed;z-index:9999;background:white;border:1.5px solid #E2E8F0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;padding:4px 0;top:' + (rect.bottom + 4) + 'px;right:' + (window.innerWidth - rect.right) + 'px';
    dd.innerHTML = opts.map(([val, label]) =>
        '<div onclick="applyDocSort(\'' + val + '\')" class="vnk-menu-item" style="padding:8px 14px;font-size:0.83rem;color:' + (window._docSortState === val ? '#1B4F8A' : '#1E293B') + ';font-weight:' + (window._docSortState === val ? '600' : '400') + ';display:flex;align-items:center;gap:8px">' +
        (window._docSortState === val ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '<span style="width:13px"></span>') +
        label + '</div>'
    ).join('');
    document.body.appendChild(dd);
    setTimeout(() => document.addEventListener('click', function _c(e) {
        if (!dd.contains(e.target) && e.target !== btn) { dd.remove(); document.removeEventListener('click', _c); }
    }), 0);
}

function applyDocSort(val) {
    window._docSortState = val;
    const dd = document.getElementById('sort-dropdown-docs');
    if (dd) dd.remove();
    const labelMap = { 'date-desc': 'Date ↓', 'date-asc': 'Date ↑', 'name-asc': 'Nom A→Z', 'name-desc': 'Nom Z→A', 'unread': 'Non lus' };
    const lbl = document.getElementById('doc-sort-label');
    if (lbl) lbl.textContent = labelMap[val] || val;
    filterDocuments();
}

function _docCategory(doc) {
    const t = (doc.file_type || doc.file_name || '').toLowerCase();
    const title = (doc.title || '').toLowerCase();
    if (title.includes('facture') || title.includes('invoice') || t.includes('facture')) return 'Factures';
    if (title.includes('contrat') || title.includes('contract') || t.includes('contrat')) return 'Contrats';
    if (title.includes('devis') || title.includes('quote')) return 'Devis';
    if (title.includes('rapport') || title.includes('audit') || title.includes('documentation') || title.includes('doc')) return 'Documentation technique';
    return 'Autres documents';
}

const _catOrder = ['Documentation technique', 'Factures', 'Contrats', 'Devis', 'Autres documents'];
const _catIcons = {
    'Documentation technique': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'Factures': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    'Contrats': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>',
    'Devis': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    'Autres documents': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>'
};


function renderDocuments(documents) {
    const list = document.getElementById('documents-list');
    if (!list) return;
    if (!documents.length) {
        list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg><p>Aucun document disponible.</p><p style="font-size:0.8rem;color:var(--color-text-light)">Les fichiers apparaîtront ici une fois votre mandat démarré.</p></div>';
        return;
    }
    const readIds = _getReadDocs();
    const ftypes = { pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel', png: 'Image', jpg: 'Image', jpeg: 'Image' };

    // Grouper par catégorie
    const groups = {};
    documents.forEach(doc => {
        const cat = _docCategory(doc);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(doc);
    });

    const renderDoc = doc => {
        const isRead = readIds.includes(doc.id);
        const size = doc.file_size ? (doc.file_size > 1048576 ? (doc.file_size / 1048576).toFixed(1) + ' Mo' : Math.round(doc.file_size / 1024) + ' Ko') : '';
        const ext = (doc.file_name || doc.title || '').split('.').pop().toLowerCase();
        const ftype = ftypes[ext] || 'Fichier';
        const tcolor = { PDF: '#E74C3C', Word: '#1B4F8A', Excel: '#27AE60', Image: '#8E44AD', Fichier: '#64748B' }[ftype] || '#64748B';
        return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.5rem;border-bottom:1px solid #F1F5F9;background:white" id="doc-item-' + doc.id + '">' +
            '<span style="background:' + tcolor + '22;color:' + tcolor + ';font-size:0.63rem;font-weight:700;padding:1px 5px;border-radius:4px;flex-shrink:0">' + ftype + '</span>' +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-size:0.82rem;font-weight:600;color:#1E293B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + doc.title + '</div>' +
            '<div style="font-size:0.68rem;color:#94A3B8">' + new Date(doc.created_at).toLocaleDateString('fr-CA') + (size ? ' · ' + size : '') + '</div>' +
            '</div>' +
            (!isRead ? '<span style="background:#1B4F8A;color:white;font-size:0.6rem;font-weight:700;padding:1px 5px;border-radius:8px">NOUVEAU</span>' : '<span style="color:#27AE60;font-size:0.65rem;display:flex;align-items:center;gap:2px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Lu</span>') +
            (doc._action === 'pdf-invoice' ?
                '<a href="/api/invoices/' + doc._invoice_id + '/pdf" target="_blank" class="btn btn-primary btn-sm" style="font-size:0.72rem;padding:0.2rem 0.5rem;text-decoration:none" onclick="_markDocRead(' + JSON.stringify(doc.id) + ')">Télécharger</a>' :
                doc.file_url ?
                    '<button class="btn btn-primary btn-sm" style="font-size:0.72rem;padding:0.2rem 0.5rem" onclick="downloadDoc(' + JSON.stringify(doc.id) + ')">Télécharger</button>' :
                    '<span style="font-size:0.7rem;color:#94A3B8">Bientôt dispo</span>') +
            '</div>';
    };

    // Catégories en colonnes (grille 2 colonnes), Autres documents en ligne
    const gridCats = ['Documentation technique', 'Factures', 'Contrats', 'Devis'];
    const lineCats = ['Autres documents'];

    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.25rem">';
    let hasGrid = false;

    gridCats.forEach(cat => {
        if (!groups[cat]) return;
        hasGrid = true;
        const docs = groups[cat];
        const unread = docs.filter(d => !readIds.map(String).includes(String(d.id))).length;
        html += '<div style="background:#F8FAFC;border-radius:10px;border:1px solid #E2E8F0;overflow:hidden">' +
            '<div style="padding:0.65rem 0.85rem;background:white;border-bottom:2px solid #E2E8F0;display:flex;align-items:center;gap:0.5rem;position:sticky;top:0">' +
            '<span style="color:#1B4F8A">' + (_catIcons[cat] || '') + '</span>' +
            '<h3 style="font-size:0.83rem;font-weight:700;color:#1B4F8A;margin:0;flex:1">' + cat + '</h3>' +
            '<span style="font-size:0.72rem;color:#94A3B8">' + docs.length + '</span>' +
            (unread > 0 ? '<span style="background:#1B4F8A;color:white;font-size:0.62rem;font-weight:700;padding:1px 6px;border-radius:8px">' + unread + ' nouveau' + (unread > 1 ? 'x' : '') + '</span>' : '') +
            '</div>' +
            '<div style="max-height:280px;overflow-y:auto;padding:0.5rem">' +
            docs.map(renderDocCard).join('') +
            '</div></div>';
    });

    if (!hasGrid) html = '';
    else html += '</div>';

    // Autres documents en ligne simple
    lineCats.forEach(cat => {
        if (!groups[cat]) return;
        const docs = groups[cat];
        const unread = docs.filter(d => !readIds.map(String).includes(String(d.id))).length;
        html += '<div style="background:#F8FAFC;border-radius:10px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:1rem">' +
            '<div style="padding:0.65rem 0.85rem;background:white;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;gap:0.5rem">' +
            '<span style="color:#1B4F8A">' + (_catIcons[cat] || '') + '</span>' +
            '<h3 style="font-size:0.83rem;font-weight:700;color:#1B4F8A;margin:0;flex:1">' + cat + '</h3>' +
            '<span style="font-size:0.72rem;color:#94A3B8">' + docs.length + '</span>' +
            (unread > 0 ? '<span style="background:#1B4F8A;color:white;font-size:0.62rem;font-weight:700;padding:1px 6px;border-radius:8px">' + unread + ' nouveau' + (unread > 1 ? 'x' : '') + '</span>' : '') +
            '</div>' +
            '<div style="max-height:200px;overflow-y:auto">' +
            docs.map(renderDocLine).join('') +
            '</div></div>';
    });

    list.innerHTML = html;
}

function _updateDocItem(id) {
    // Mettre à jour visuellement l'item après lecture
    setTimeout(() => {
        const item = document.getElementById('doc-item-' + id);
        if (item) {
            item.style.borderLeft = '';
            item.style.background = '';
            const badge = item.querySelector('span[style*="NOUVEAU"]');
            if (badge) badge.remove();
        }
        // Recalculer le badge
        const unread = _getUnreadDocs(window._allDocuments || []);
        const navBadge = document.getElementById('badge-documents');
        if (navBadge) {
            if (unread.length > 0) { navBadge.textContent = unread.length; navBadge.style.display = 'inline-block'; }
            else navBadge.style.display = 'none';
        }
    }, 100);
}


async function downloadPDF(type, id, number) {
    const token = localStorage.getItem('vnk-token');
    try {
        const response = await fetch('/api/' + type + '/' + id + '/pdf', { headers: { 'Authorization': 'Bearer ' + token } });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'VNK-' + number + '.pdf';
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); a.remove();
        }
    } catch (error) { console.error('PDF download error:', error); }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);
}

function logout() {
    stopPolling();
    localStorage.removeItem('vnk-token');
    localStorage.removeItem('vnk-user');
    window._allQuotes = window._allInvoices = window._allContracts = undefined;
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('dashboard-section').style.display = 'none';
}

function togglePortalPw() {
    const input = document.getElementById('login-password');
    const btn = document.querySelector('button[onclick="togglePortalPw()"]');
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    if (btn) btn.innerHTML = isHidden
        ? '<svg id="eye-portal" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg id="eye-portal" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// Messages gérés par chat-widget.js

// ═══════════════════════════════════════════════
// MODAL MAISON — remplace alert() et confirm()
// ═══════════════════════════════════════════════
function _ensureModal() {
    if (document.getElementById('vnk-modal')) return;
    const el = document.createElement('div');
    el.id = 'vnk-modal';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.55);backdrop-filter:blur(3px);align-items:center;justify-content:center';
    el.innerHTML = `
        <div id="vnk-modal-box" style="background:white;border-radius:16px;padding:2rem;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);position:relative">
            <div id="vnk-modal-icon" style="text-align:center;margin-bottom:1rem"></div>
            <h3 id="vnk-modal-title" style="font-size:1.05rem;font-weight:700;color:#0F172A;margin-bottom:0.5rem;text-align:center"></h3>
            <p id="vnk-modal-msg" style="font-size:0.88rem;color:#64748B;text-align:center;line-height:1.5;margin-bottom:1.5rem"></p>
            <div id="vnk-modal-stripe" style="margin-bottom:1.25rem;display:none">
                <div id="vnk-card-element" style="padding:0.75rem;border:1.5px solid #E2E8F0;border-radius:8px;background:#F8FAFC"></div>
                <div id="vnk-card-error" style="color:#E74C3C;font-size:0.8rem;margin-top:0.4rem"></div>
            </div>
            <div id="vnk-modal-btns" style="display:flex;gap:0.75rem;justify-content:center"></div>
        </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) _closeModal(); });
}

function _closeModal() {
    const m = document.getElementById('vnk-modal');
    if (m) m.style.display = 'none';
}

// showInfo(title, msg, icon?)
function showInfo(title, msg, icon) {
    _ensureModal();
    const icons = { success: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>', error: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', info: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' };
    document.getElementById('vnk-modal-icon').innerHTML = icons[icon || 'info'] || '';
    document.getElementById('vnk-modal-title').textContent = title;
    document.getElementById('vnk-modal-msg').textContent = msg;
    document.getElementById('vnk-modal-stripe').style.display = 'none';
    document.getElementById('vnk-modal-btns').innerHTML = '<button onclick="_closeModal()" style="padding:0.6rem 1.75rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer">OK</button>';
    document.getElementById('vnk-modal').style.display = 'flex';
}

// showConfirm(title, msg, onConfirm)
function showConfirm(title, msg, onConfirm) {
    _ensureModal();
    document.getElementById('vnk-modal-icon').innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    document.getElementById('vnk-modal-title').textContent = title;
    document.getElementById('vnk-modal-msg').textContent = msg;
    document.getElementById('vnk-modal-stripe').style.display = 'none';
    document.getElementById('vnk-modal-btns').innerHTML =
        '<button onclick="_closeModal()" style="padding:0.6rem 1.5rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer">Annuler</button>' +
        '<button id="vnk-modal-confirm" style="padding:0.6rem 1.5rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer">Confirmer</button>';
    document.getElementById('vnk-modal-confirm').onclick = () => { _closeModal(); onConfirm(); };
    document.getElementById('vnk-modal').style.display = 'flex';
}

// ═══════════════════════════════════════════════
// STRIPE — paiement intégré
// ═══════════════════════════════════════════════
const _stripeKey = 'pk_test_51TErqtRnDD0deTI4BLVRIDRe8Jy1pfud8ibIoAXUgTi89OH7EQOVcn22KeE9DX8sDeTPiJB7lMyfvhRaRHTILbs600iS6ESs4W';
let _stripe = null, _cardElement = null;

function _initStripe() {
    if (_stripe) return;
    if (typeof Stripe !== 'undefined') _stripe = Stripe(_stripeKey);
}

async function payInvoice(invoiceId, amountTtc) {
    _initStripe();
    if (!_stripe) { showInfo('Paiement indisponible', 'Stripe n\'est pas chargé. Rechargez la page.', 'error'); return; }
    const token = localStorage.getItem('vnk-token');
    const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');
    const amount = amountTtc ? formatCurrency(amountTtc) : '...';

    _ensureModal();
    document.getElementById('vnk-modal-icon').innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
    document.getElementById('vnk-modal-title').textContent = 'Paiement sécurisé';
    document.getElementById('vnk-modal-msg').innerHTML =
        '<strong style="font-size:1rem;color:#1B4F8A">' + amount + ' CAD</strong> · TTC · Traitement sécurisé via Stripe';
    document.getElementById('vnk-modal-stripe').style.display = 'block';
    document.getElementById('vnk-card-error').textContent = '';

    // Formulaire de facturation
    document.getElementById('vnk-modal-stripe').innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:0.65rem">
            <img src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg" height="24" alt="Visa" style="height:24px;object-fit:contain">
            <img src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg" height="24" alt="MC" style="height:24px;object-fit:contain">
            <img src="https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg" height="24" alt="Amex" style="height:24px;object-fit:contain">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:0.6rem">
            <div>
                <label style="font-size:0.75rem;color:#64748B;display:block;margin-bottom:3px">Nom sur la carte *</label>
                <input id="vnk-card-name" value="${user.name || ''}" placeholder="Jean Tremblay" style="width:100%;padding:0.5rem 0.65rem;border:1.5px solid #E2E8F0;border-radius:7px;font-size:0.85rem;box-sizing:border-box">
            </div>
            <div>
                <label style="font-size:0.75rem;color:#64748B;display:block;margin-bottom:3px">Courriel *</label>
                <input id="vnk-card-email" value="${user.email || ''}" placeholder="jean@example.com" style="width:100%;padding:0.5rem 0.65rem;border:1.5px solid #E2E8F0;border-radius:7px;font-size:0.85rem;box-sizing:border-box">
            </div>
        </div>
        <div style="margin-bottom:0.6rem">
            <label style="font-size:0.75rem;color:#64748B;display:block;margin-bottom:3px">Numéro de carte *</label>
            <div id="vnk-card-number" style="padding:0.62rem 0.75rem;border:1.5px solid #E2E8F0;border-radius:7px;background:white"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.6rem;margin-bottom:0.6rem">
            <div>
                <label style="font-size:0.75rem;color:#64748B;display:block;margin-bottom:3px">Expiration *</label>
                <div id="vnk-card-expiry" style="padding:0.62rem 0.75rem;border:1.5px solid #E2E8F0;border-radius:7px;background:white"></div>
            </div>
            <div>
                <label style="font-size:0.75rem;color:#64748B;display:block;margin-bottom:3px">CVC *</label>
                <div id="vnk-card-cvc" style="padding:0.62rem 0.75rem;border:1.5px solid #E2E8F0;border-radius:7px;background:white"></div>
            </div>
            <div>
                <label style="font-size:0.75rem;color:#64748B;display:block;margin-bottom:3px">Code postal</label>
                <input id="vnk-card-postal" value="${user.postal_code || ''}" placeholder="G1A 1A1" style="width:100%;padding:0.5rem 0.65rem;border:1.5px solid #E2E8F0;border-radius:7px;font-size:0.85rem;box-sizing:border-box">
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:0.5rem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span style="font-size:0.72rem;color:#94A3B8">Paiement sécurisé SSL · Propulsé par Stripe</span>
        </div>
        <div id="vnk-card-error" style="color:#E74C3C;font-size:0.8rem;min-height:1.2em"></div>`;

    document.getElementById('vnk-modal-btns').innerHTML =
        '<button onclick="_closeModal()" style="padding:0.6rem 1.5rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer">Annuler</button>' +
        '<button id="vnk-pay-btn" style="padding:0.6rem 1.5rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Payer ' + amount + '</button>';
    document.getElementById('vnk-modal').style.display = 'flex';

    // Monter les champs Stripe séparés
    const elements = _stripe.elements();
    const cardStyle = { base: { fontSize: '14px', color: '#1E293B', fontFamily: 'system-ui, sans-serif', '::placeholder': { color: '#CBD5E0' } } };
    const cardNumber = elements.create('cardNumber', { style: cardStyle, showIcon: true });
    const cardExpiry = elements.create('cardExpiry', { style: cardStyle });
    const cardCvc = elements.create('cardCvc', { style: cardStyle });
    cardNumber.mount('#vnk-card-number');
    cardExpiry.mount('#vnk-card-expiry');
    cardCvc.mount('#vnk-card-cvc');
    _cardElement = cardNumber; // référence principale pour confirmCardPayment

    document.getElementById('vnk-pay-btn').onclick = async () => {
        const btn = document.getElementById('vnk-pay-btn');
        const cardName = document.getElementById('vnk-card-name')?.value.trim();
        const cardEmail = document.getElementById('vnk-card-email')?.value.trim();
        const cardPostal = document.getElementById('vnk-card-postal')?.value.trim();
        const errEl = document.getElementById('vnk-card-error');

        if (!cardName) { errEl.textContent = 'Veuillez entrer le nom sur la carte.'; return; }
        if (!cardEmail) { errEl.textContent = 'Veuillez entrer votre courriel.'; return; }

        btn.disabled = true;
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Traitement...';

        try {
            const r = await fetch('/api/payments/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ invoice_id: invoiceId })
            });
            const d = await r.json();
            if (!d.success || !d.clientSecret) {
                errEl.textContent = d.message || 'Erreur lors de la création du paiement.';
                btn.disabled = false;
                btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Payer ' + amount;
                return;
            }
            const { error, paymentIntent } = await _stripe.confirmCardPayment(d.clientSecret, {
                payment_method: {
                    card: _cardElement,
                    billing_details: { name: cardName, email: cardEmail, address: { postal_code: cardPostal, country: 'CA' } }
                }
            });
            if (error) {
                errEl.textContent = error.message;
                btn.disabled = false;
                btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Payer ' + amount;
            } else if (paymentIntent.status === 'succeeded') {
                _closeModal();
                showInfo('Paiement réussi !', 'Votre paiement de ' + amount + ' a été traité avec succès. Un reçu sera envoyé à ' + cardEmail + '.', 'success');
                setTimeout(() => loadAllData(), 2000);
            }
        } catch (e) {
            errEl.textContent = 'Erreur de connexion. Réessayez.';
            btn.disabled = false;
            btn.innerHTML = 'Payer ' + amount;
        }
    };
}

async function acceptQuote(quoteId) {
    showConfirm(
        'Accepter ce devis ?',
        'En acceptant ce devis, un contrat de service vous sera envoyé pour signature électronique.',
        async () => {
            const token = localStorage.getItem('vnk-token');
            const res = await fetch('/api/quotes/' + quoteId + '/accept', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
            if (res.ok) {
                showInfo('Devis accepté !', 'Un contrat vous sera envoyé pour signature prochainement.', 'success');
                loadAllData();
            } else {
                showInfo('Erreur', 'Impossible d\'accepter ce devis. Réessayez.', 'error');
            }
        }
    );
}

async function signContract(contractId, hellosignId, fileUrl) {
    const token = localStorage.getItem('vnk-token');
    const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');

    // Cas 1 — lien direct PDF disponible
    if (fileUrl) {
        showConfirm('Signer ce contrat', 'Vous allez être redirigé vers le document pour le lire et le signer en ligne.', () => window.open(fileUrl, '_blank'));
        return;
    }

    // Cas 2 — HelloSign request ID disponible
    if (hellosignId) {
        try {
            const r = await fetch('/api/contracts/' + contractId + '/signing-url', { headers: { Authorization: 'Bearer ' + token } });
            const d = await r.json();
            if (d.success && d.signingUrl) {
                showConfirm('Signer électroniquement', 'Vous allez être redirigé vers HelloSign pour signer ce contrat de façon légalement reconnue.', () => window.open(d.signingUrl, '_blank'));
                return;
            }
        } catch { }
    }

    // Cas 3 — Aucun lien disponible : informer et rediriger vers messages
    _ensureModal();
    document.getElementById('vnk-modal-icon').innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    document.getElementById('vnk-modal-title').textContent = 'Contrat en préparation';
    document.getElementById('vnk-modal-msg').innerHTML =
        'VNK prépare actuellement votre contrat.<br><br>' +
        'Vous recevrez un courriel à <strong>' + (user.email || 'votre adresse') + '</strong> dès que le document est prêt à signer.<br><br>' +
        'Des questions ? Écrivez-nous directement.';
    document.getElementById('vnk-modal-stripe').style.display = 'none';
    document.getElementById('vnk-modal-btns').innerHTML =
        '<button onclick="_closeModal()" style="padding:0.6rem 1.5rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer">Fermer</button>' +
        '<button onclick="_closeAndOpenChat()" style="padding:0.6rem 1.5rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer">💬 Envoyer un message</button>';
    document.getElementById('vnk-modal').style.display = 'flex';
}

function _closeAndOpenChat() {
    _closeModal();
    const panel = document.getElementById('vnk-chat-panel');
    if (panel && !panel.classList.contains('open') && typeof vnkChatToggle === 'function') vnkChatToggle();
}


const _sortState = {};
let _sortDropdownOpen = null;

const _sortOptions = {
    quotes: [['date-desc', 'Date (récent)'], ['date-asc', 'Date (ancien)'], ['name-asc', 'Nom A→Z'], ['name-desc', 'Nom Z→A'], ['amount-desc', 'Montant ↓'], ['amount-asc', 'Montant ↑']],
    invoices: [['date-desc', 'Date (récent)'], ['date-asc', 'Date (ancien)'], ['name-asc', 'Nom A→Z'], ['name-desc', 'Nom Z→A'], ['amount-desc', 'Montant ↓'], ['amount-asc', 'Montant ↑']],
    contracts: [['date-desc', 'Date (récent)'], ['date-asc', 'Date (ancien)'], ['name-asc', 'Nom A→Z'], ['name-desc', 'Nom Z→A']]
};

function toggleSort(type) {
    const existingDropdown = document.getElementById('sort-dropdown-' + type);
    if (existingDropdown) { existingDropdown.remove(); _sortDropdownOpen = null; return; }
    if (_sortDropdownOpen) {
        const old = document.getElementById('sort-dropdown-' + _sortDropdownOpen);
        if (old) old.remove();
    }
    _sortDropdownOpen = type;
    const btn = document.getElementById(type.slice(0, -1) + '-sort-btn') || document.getElementById(type + '-sort-btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.id = 'sort-dropdown-' + type;
    dropdown.style.cssText = 'position:fixed;z-index:9999;background:white;border:1.5px solid #E2E8F0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;padding:4px 0;top:' + (rect.bottom + 4) + 'px;right:' + (window.innerWidth - rect.right) + 'px';
    const current = _sortState[type] || 'date-desc';
    dropdown.innerHTML = _sortOptions[type].map(([val, label]) =>
        '<div onclick="applySort(\'' + type + '\',\'' + val + '\')" style="padding:8px 14px;font-size:0.83rem;cursor:pointer;color:' + (current === val ? '#1B4F8A' : '#1E293B') + ';font-weight:' + (current === val ? '600' : '400') + ';display:flex;align-items:center;gap:8px" onmouseover="this.style.background=\'#F1F5F9\'" onmouseout="this.style.background=\'transparent\'">' +
        (current === val ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '<span style="width:13px"></span>') +
        label + '</div>'
    ).join('');
    document.body.appendChild(dropdown);
    setTimeout(() => document.addEventListener('click', function _close(e) {
        if (!dropdown.contains(e.target) && e.target !== btn) {
            dropdown.remove(); _sortDropdownOpen = null;
            document.removeEventListener('click', _close);
        }
    }), 0);
}

function applySort(type, val) {
    _sortState[type] = val;
    const dropdown = document.getElementById('sort-dropdown-' + type);
    if (dropdown) { dropdown.remove(); _sortDropdownOpen = null; }
    const labelMap = { 'date-desc': 'Date ↓', 'date-asc': 'Date ↑', 'name-asc': 'Nom A→Z', 'name-desc': 'Nom Z→A', 'amount-desc': 'Montant ↓', 'amount-asc': 'Montant ↑' };
    const labelEl = document.getElementById(type.slice(0, -1) + '-sort-label') || document.getElementById(type + '-sort-label');
    if (labelEl) labelEl.textContent = labelMap[val] || val;
    const btn = document.getElementById(type.slice(0, -1) + '-sort-btn') || document.getElementById(type + '-sort-btn');
    if (btn) btn.classList.toggle('active', val !== 'date-desc');
    if (type === 'quotes') filterQuotes();
    else if (type === 'invoices') filterInvoices();
    else if (type === 'contracts') filterContracts();
}

function _applySort(arr, val, numField) {
    return [...arr].sort((a, b) => {
        if (val === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
        if (val === 'date-asc') return new Date(a.created_at) - new Date(b.created_at);
        if (val === 'name-asc') return (a.title || '').localeCompare(b.title || '');
        if (val === 'name-desc') return (b.title || '').localeCompare(a.title || '');
        if (val === 'amount-desc') return parseFloat(b[numField] || 0) - parseFloat(a[numField] || 0);
        if (val === 'amount-asc') return parseFloat(a[numField] || 0) - parseFloat(b[numField] || 0);
        return 0;
    });
}

function filterQuotes() {
    const search = (document.getElementById('quote-search')?.value || '').toLowerCase();
    const status = document.getElementById('quote-filter')?.value || 'all';
    let list = window._allQuotes || [];
    if (status !== 'all') list = list.filter(q => q.status === status);
    if (search) list = list.filter(q => ((q.quote_number || '') + ' ' + (q.title || '')).toLowerCase().includes(search));
    list = _applySort(list, _sortState.quotes || 'date-desc', 'amount_ttc');
    renderQuotes(list);
}

function filterInvoices() {
    const search = (document.getElementById('invoice-search')?.value || '').toLowerCase();
    const status = document.getElementById('invoice-filter')?.value || 'all';
    let list = window._allInvoices || [];
    if (status !== 'all') list = list.filter(i => i.status === status);
    if (search) list = list.filter(i => ((i.invoice_number || '') + ' ' + (i.title || '')).toLowerCase().includes(search));
    list = _applySort(list, _sortState.invoices || 'date-desc', 'amount_ttc');
    renderInvoices(list);
}

function filterContracts() {
    const search = (document.getElementById('contract-search')?.value || '').toLowerCase();
    const status = document.getElementById('contract-filter')?.value || 'all';
    let list = window._allContracts || [];
    if (status !== 'all') list = list.filter(c => c.status === status || (status === 'pending_signature' && c.status === 'pending'));
    if (search) list = list.filter(c => ((c.contract_number || '') + ' ' + (c.title || '')).toLowerCase().includes(search));
    list = _applySort(list, _sortState.contracts || 'date-desc', 'amount_ttc');
    renderPortalContracts(list);
}