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
            renderQuotes(window._allQuotes);
            if (window._allQuotes.length > 0) showBadge('badge-quotes', window._allQuotes.length);
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
            renderDocuments(docsArr);
            if (docsArr.length > 0) showBadge('badge-documents', docsArr.length);
        }
        if (mandates) {
            const mArr = mandates.mandates || [];
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
            const pending = window._allContracts.filter(c => c.status === 'pending_signature').length;
            if (pending > 0) showBadge('badge-contracts', pending);
        }
        if (messages) {
            renderMessages(messages.messages || []);
            const unread = (messages.messages || []).filter(m => !m.is_read && m.sender === 'vnk').length;
            if (el('stat-messages')) el('stat-messages').textContent = unread;
            if (unread > 0) { showBadge('badge-messages', unread); updateMessageBadge(unread); }
            else updateMessageBadge(0);
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
    const titles = { profile: 'Mon profil', dashboard: 'Tableau de bord', mandates: 'Mes mandats', quotes: 'Mes devis', invoices: 'Mes factures', contracts: 'Mes contrats', documents: 'Mes documents', messages: 'Messagerie' };
    const mobileTitle = document.getElementById('mobile-tab-title');
    if (mobileTitle) mobileTitle.textContent = titles[tabName] || '';
    localStorage.setItem('vnk-portal-tab', tabName);
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
    if (!mandates.length) { list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><p>Aucun mandat actif pour l\'instant.</p><a href="contact.html" class="btn btn-outline btn-sm">Démarrer un projet</a></div>'; return; }
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
        return '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:1rem 1.25rem;margin-bottom:0.75rem;background:white">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:0.6rem">' +
            '<div style="flex:1">' +
            '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;flex-wrap:wrap">' +
            '<strong style="font-size:0.9rem;color:#1B4F8A">' + q.quote_number + '</strong>' +
            '<span style="background:' + color + '22;color:' + color + ';font-size:0.72rem;font-weight:600;padding:2px 8px;border-radius:4px">' + (sl[q.status] || q.status) + '</span>' +
            (svc ? '<span style="background:#EBF5FB;color:#1B4F8A;font-size:0.72rem;padding:2px 8px;border-radius:4px">' + svc + '</span>' : '') +
            '</div>' +
            '<div style="font-size:0.88rem;font-weight:600;color:#1E293B">' + q.title + '</div>' +
            (q.description ? '<div style="font-size:0.8rem;color:#64748B;margin-top:2px">' + q.description + '</div>' : '') +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0">' +
            '<div style="font-size:1.05rem;font-weight:700;color:#1B4F8A">' + formatCurrency(q.amount_ttc) + '</div>' +
            '<div style="font-size:0.7rem;color:#94A3B8">TTC</div>' +
            '</div></div>' +
            '<div style="display:flex;gap:1.5rem;font-size:0.75rem;color:#64748B;margin-bottom:0.6rem;flex-wrap:wrap">' +
            '<span>Émis : ' + new Date(q.created_at).toLocaleDateString('fr-CA') + '</span>' +
            (q.expiry_date ? '<span>Expire : ' + new Date(q.expiry_date).toLocaleDateString('fr-CA') + '</span>' : '') +
            '</div>' +
            '<div style="background:#F8FAFC;border-radius:6px;padding:0.4rem 0.75rem;display:flex;gap:1.5rem;font-size:0.75rem;color:#64748B;margin-bottom:0.6rem;flex-wrap:wrap">' +
            '<span>HT : <strong style="color:#1E293B">' + formatCurrency(q.amount_ht) + '</strong></span>' +
            '<span>TPS : ' + formatCurrency(q.tps_amount) + '</span>' +
            '<span>TVQ : ' + formatCurrency(q.tvq_amount) + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;justify-content:flex-end">' +
            '<button class="btn btn-outline btn-sm" onclick="downloadPDF(\'quotes\',' + q.id + ',\'' + q.quote_number + '\')">PDF</button>' +
            (q.status === 'pending' ? '<button class="btn btn-primary btn-sm" onclick="acceptQuote(' + q.id + ')">Accepter</button>' : '') +
            '</div></div>';
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
        return '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:1rem 1.25rem;margin-bottom:0.75rem;background:white;' + (isPaid ? 'border-left:3px solid #27AE60' : (isOverdue ? 'border-left:3px solid #E74C3C' : '')) + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:0.6rem">' +
            '<div style="flex:1">' +
            '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;flex-wrap:wrap">' +
            '<strong style="font-size:0.9rem;color:#1B4F8A">' + inv.invoice_number + '</strong>' +
            '<span style="background:' + color + '22;color:' + color + ';font-size:0.72rem;font-weight:600;padding:2px 8px;border-radius:4px">' + (sl[inv.status] || inv.status) + '</span>' +
            '</div>' +
            '<div style="font-size:0.88rem;font-weight:600;color:#1E293B">' + inv.title + '</div>' +
            (inv.description ? '<div style="font-size:0.8rem;color:#64748B;margin-top:2px">' + inv.description + '</div>' : '') +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0">' +
            '<div style="font-size:1.05rem;font-weight:700;color:' + (isPaid ? '#27AE60' : '#1B4F8A') + '">' + formatCurrency(inv.amount_ttc) + '</div>' +
            '<div style="font-size:0.7rem;color:#94A3B8">TTC</div>' +
            '</div></div>' +
            '<div style="display:flex;gap:1.5rem;font-size:0.75rem;color:#64748B;margin-bottom:0.6rem;flex-wrap:wrap">' +
            '<span>Émise : ' + new Date(inv.created_at).toLocaleDateString('fr-CA') + '</span>' +
            (inv.due_date ? '<span>Échéance : <strong style="color:' + (isOverdue ? '#E74C3C' : 'inherit') + '">' + new Date(inv.due_date).toLocaleDateString('fr-CA') + '</strong></span>' : '') +
            (inv.paid_at ? '<span style="color:#27AE60">Payée le : ' + new Date(inv.paid_at).toLocaleDateString('fr-CA') + '</span>' : '') +
            '</div>' +
            '<div style="background:#F8FAFC;border-radius:6px;padding:0.4rem 0.75rem;display:flex;gap:1.5rem;font-size:0.75rem;color:#64748B;margin-bottom:0.6rem;flex-wrap:wrap">' +
            '<span>HT : <strong style="color:#1E293B">' + formatCurrency(inv.amount_ht) + '</strong></span>' +
            '<span>TPS : ' + formatCurrency(inv.tps_amount) + '</span>' +
            '<span>TVQ : ' + formatCurrency(inv.tvq_amount) + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;justify-content:flex-end">' +
            '<button class="btn btn-outline btn-sm" onclick="downloadPDF(\'invoices\',' + inv.id + ',\'' + inv.invoice_number + '\')">PDF</button>' +
            (inv.status === 'unpaid' || inv.status === 'overdue' ? '<button class="btn btn-primary btn-sm" onclick="payInvoice(' + inv.id + ')">Payer</button>' : '') +
            '</div></div>';
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
    if (!contracts || !contracts.length) { list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Aucun contrat disponible.</p></div>'; return; }
    const sl = { draft: 'Brouillon', pending: 'En attente de signature', pending_signature: 'En attente de signature', viewed: 'Consulté', signed: 'Signé' };
    const sc = { draft: '#94A3B8', pending: '#D97706', pending_signature: '#D97706', viewed: '#2E86AB', signed: '#27AE60' };
    list.innerHTML = contracts.map(c => {
        const color = sc[c.status] || '#94A3B8';
        const ns = c.status === 'pending_signature';
        const is = c.status === 'signed';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:0.75rem;background:white;' + (ns ? 'border-left:3px solid #D97706;' : '') + '">' +
            '<div style="flex:1"><div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.3rem">' +
            '<strong style="font-size:0.9rem">' + c.contract_number + '</strong>' +
            '<span style="background:' + color + '22;color:' + color + ';font-size:0.72rem;font-weight:600;padding:2px 8px;border-radius:4px">' + (sl[c.status] || c.status) + '</span></div>' +
            '<div style="font-size:0.85rem;color:#1E293B;margin-bottom:0.2rem">' + c.title + '</div>' +
            '<div style="font-size:0.75rem;color:#94A3B8">' + (c.quote_number ? 'Devis ' + c.quote_number + ' · ' : '') + new Date(c.created_at).toLocaleDateString('fr-CA') + (c.signed_at ? ' · Signé le ' + new Date(c.signed_at).toLocaleDateString('fr-CA') : '') + '</div>' +
            (ns ? '<div style="margin-top:0.4rem;font-size:0.78rem;color:#D97706;font-weight:600">⚠ Ce contrat requiert votre signature</div>' : '') +
            '</div><div style="display:flex;flex-direction:column;gap:0.4rem;margin-left:1rem">' +
            '<a href="/api/contracts/' + c.id + '/pdf" target="_blank" style="display:flex;align-items:center;gap:5px;padding:0.4rem 0.9rem;border:1.5px solid #1B4F8A;border-radius:6px;color:#1B4F8A;font-size:0.78rem;font-weight:600;text-decoration:none;white-space:nowrap"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Voir</a>' +
            (ns ? '<button onclick="signContract(' + c.id + ')" style="display:flex;align-items:center;gap:5px;padding:0.4rem 0.9rem;border:none;border-radius:6px;background:#D97706;color:white;font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Signer</button>' : '') +
            (is ? '<a href="/api/contracts/' + c.id + '/pdf" download style="display:flex;align-items:center;gap:5px;padding:0.4rem 0.9rem;border:1.5px solid #27AE60;border-radius:6px;color:#27AE60;font-size:0.78rem;font-weight:600;text-decoration:none"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Télécharger</a>' : '') +
            '</div></div>';
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

async function signContract(contractId) {
    const token = localStorage.getItem('vnk-token');
    try {
        const r = await fetch('/api/contracts/' + contractId + '/signing-url', { headers: { 'Authorization': 'Bearer ' + token } });
        const d = await r.json();
        if (d.success && d.signingUrl) window.open(d.signingUrl, '_blank');
        else alert('Lien de signature indisponible. Contactez VNK à vnkautomatisation@gmail.com');
    } catch { alert('Erreur. Contactez VNK à vnkautomatisation@gmail.com'); }
}

function renderDocuments(documents) {
    const list = document.getElementById('documents-list');
    if (!list) return;
    if (!documents.length) { list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg><p>Aucun document disponible pour l\'instant.</p><p style="font-size:0.8rem;color:var(--color-text-light)">Les rapports et livrables apparaîtront ici une fois votre mandat démarré.</p></div>'; return; }
    list.innerHTML = documents.map(doc => {
        const size = doc.file_size ? (doc.file_size > 1048576 ? (doc.file_size / 1048576).toFixed(1) + ' Mo' : Math.round(doc.file_size / 1024) + ' Ko') : '';
        return '<div class="portal-list-item"><div style="flex:1"><div class="portal-item-title">' + doc.title + '</div><div class="portal-item-meta"><span>' + new Date(doc.created_at).toLocaleDateString('fr-CA') + '</span>' + (size ? '<span>' + size + '</span>' : '') + '</div></div><div class="portal-item-actions">' + (doc.file_url ? '<a href="' + doc.file_url + '" target="_blank" class="btn btn-primary btn-sm">Télécharger</a>' : '<span style="font-size:0.78rem;color:var(--color-text-light)">Bientôt disponible</span>') + '</div></div>';
    }).join('');
}

function renderMessages(messages) {
    const list = document.getElementById('messages-list');
    if (!list) return;
    if (!messages.length) { list.innerHTML = '<p class="portal-empty">Aucun message. Envoyez votre premier message ci-dessous.</p>'; return; }
    list.innerHTML = messages.map(m => '<div style="display:flex;flex-direction:column;align-items:' + (m.sender === 'client' ? 'flex-end' : 'flex-start') + '"><div style="font-size:0.72rem;color:var(--color-text-light);margin-bottom:0.2rem">' + (m.sender === 'client' ? 'Vous' : 'VNK Automatisation') + '</div><div class="portal-message-bubble portal-message-' + (m.sender === 'client' ? 'client' : 'vnk') + '">' + m.content + '</div><div class="portal-message-time">' + new Date(m.created_at).toLocaleString('fr-CA') + '</div></div>').join('');
    list.scrollTop = list.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;
    const token = localStorage.getItem('vnk-token');
    const sendBtn = document.querySelector('.portal-message-compose .btn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Envoi...'; }
    try {
        const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ content }) });
        if (res.ok) {
            input.value = '';
            const r = await fetch('/api/messages', { headers: { 'Authorization': 'Bearer ' + token } });
            if (r.ok) { const d = await r.json(); renderMessages(d.messages || []); }
        }
    } catch (error) { console.error('Send message error:', error); }
    finally { if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Envoyer'; } }
}

async function acceptQuote(quoteId) {
    const token = localStorage.getItem('vnk-token');
    if (!confirm('Voulez-vous accepter ce devis ? Un contrat vous sera envoyé pour signature.')) return;
    try {
        const res = await fetch('/api/quotes/' + quoteId + '/accept', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) loadAllData();
    } catch (error) { console.error('Accept quote error:', error); }
}

async function payInvoice(invoiceId) {
    const token = localStorage.getItem('vnk-token');
    try {
        const res = await fetch('/api/payments/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ invoiceId })
        });
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            alert('Paiement en ligne bientôt disponible. Contactez VNK à vnkautomatisation@gmail.com pour arranger le paiement.');
        }
    } catch (error) {
        alert('Paiement en ligne bientôt disponible. Contactez VNK à vnkautomatisation@gmail.com');
    }
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

function updateMessageBadge(count) {
    let badge = document.getElementById('vnk-float-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'vnk-float-badge';
        badge.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9000;background:#1B4F8A;color:white;border-radius:50px;padding:0.6rem 1rem;font-size:0.85rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;box-shadow:0 4px 16px rgba(27,79,138,0.35);cursor:pointer;transition:all 0.2s';
        badge.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span id="vnk-float-badge-count">1</span>';
        badge.onclick = () => { showTab('messages'); badge.style.display = 'none'; };
        document.body.appendChild(badge);
    }
    const countEl = document.getElementById('vnk-float-badge-count');
    if (countEl) countEl.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}