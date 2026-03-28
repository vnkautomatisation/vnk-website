/* ============================================
   VNK Automatisation Inc. - Portal JavaScript
   ============================================ */

// ---------- Toggle sidebar mobile ----------
function togglePortalSidebar() {
    const sidebar = document.querySelector('.portal-sidebar');
    const overlay = document.getElementById('portal-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}

// ---------- Login ----------
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    const token = localStorage.getItem('vnk-token');
    if (token) showDashboard();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const loginBtn = document.getElementById('login-btn');
        const loginError = document.getElementById('login-error');
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

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
        } catch (error) {
            loginError.textContent = 'Erreur de connexion. Veuillez réessayer.';
            loginError.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Se connecter';
        }
    });
});

// ---------- Show dashboard ----------
function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    // IMPORTANT: grid sur desktop, flex sur mobile
    document.getElementById('dashboard-section').style.display = 'grid';

    const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');

    // Initiales
    const initials = (user.name || 'VNK').split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase();

    // Sidebar desktop
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    const sidebarName = document.getElementById('sidebar-name');
    const sidebarCompany = document.getElementById('sidebar-company');
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (sidebarName) sidebarName.textContent = user.name || '';
    if (sidebarCompany) sidebarCompany.textContent = user.company || '';

    // Avatar mobile topbar
    const mobileAvatar = document.getElementById('mobile-avatar');
    if (mobileAvatar) mobileAvatar.textContent = initials.substring(0, 2);

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const greetingEl = document.getElementById('dashboard-greeting');
    if (greetingEl) greetingEl.textContent = `${greeting}, ${(user.name || '').split(' ')[0]} !`;

    loadAllData();
}

// ---------- Load all data ----------
async function loadAllData() {
    const token = localStorage.getItem('vnk-token');
    if (!token) return;

    try {
        const dashRes = await fetch('/api/clients/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (dashRes.ok) {
            const data = await dashRes.json();
            document.getElementById('stat-mandates').textContent = data.activeMandates || 0;
            document.getElementById('stat-quotes').textContent = data.pendingQuotes || 0;
            document.getElementById('stat-invoices').textContent = data.pendingInvoices || 0;
            if (data.pendingQuotes > 0) showBadge('badge-quotes', data.pendingQuotes);
            if (data.pendingInvoices > 0) showBadge('badge-invoices', data.pendingInvoices);
            if (data.activeMandates > 0) showBadge('badge-mandates', data.activeMandates);
            renderActivity(data.recentActivity || []);
        }

        const quotesRes = await fetch('/api/quotes', { headers: { 'Authorization': `Bearer ${token}` } });
        if (quotesRes.ok) { const data = await quotesRes.json(); renderQuotes(data.quotes || []); }

        const invoicesRes = await fetch('/api/invoices', { headers: { 'Authorization': `Bearer ${token}` } });
        if (invoicesRes.ok) { const data = await invoicesRes.json(); renderInvoices(data.invoices || []); }

        const messagesRes = await fetch('/api/messages', { headers: { 'Authorization': `Bearer ${token}` } });
        if (messagesRes.ok) {
            const data = await messagesRes.json();
            renderMessages(data.messages || []);
            const unread = (data.messages || []).filter(m => !m.is_read && m.sender === 'vnk').length;
            document.getElementById('stat-messages').textContent = unread;
            if (unread > 0) showBadge('badge-messages', unread);
        }

        const docsRes = await fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } });
        if (docsRes.ok) { const data = await docsRes.json(); renderDocuments(data.documents || []); }

        const mandatesRes = await fetch('/api/mandates', { headers: { 'Authorization': `Bearer ${token}` } });
        if (mandatesRes.ok) { const data = await mandatesRes.json(); renderMandates(data.mandates || []); }

    } catch (error) {
        console.log('Data loading error:', error);
    }
}

// ---------- Tab navigation ----------
function showTab(tabName) {
    document.querySelectorAll('.portal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.portal-nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.querySelectorAll('.portal-nav-item').forEach(btn => {
        if (btn.getAttribute('onclick') === `showTab('${tabName}')`) btn.classList.add('active');
    });

    // Fermer sidebar mobile
    const sidebar = document.querySelector('.portal-sidebar');
    const overlay = document.getElementById('portal-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');

    // Titre mobile
    const titles = {
        dashboard: 'Tableau de bord', mandates: 'Mes mandats',
        quotes: 'Mes devis', invoices: 'Mes factures',
        documents: 'Mes documents', messages: 'Messagerie'
    };
    const mobileTitle = document.getElementById('mobile-tab-title');
    if (mobileTitle) mobileTitle.textContent = titles[tabName] || '';

    window.scrollTo(0, 0);
}

// ---------- Badge helper ----------
function showBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) { badge.style.display = 'inline-block'; badge.textContent = count; }
}

// ---------- Render Activity ----------
function renderActivity(activities) {
    const list = document.getElementById('activity-list');
    if (!activities.length) {
        list.innerHTML = '<p class="portal-empty">Aucune activité récente.</p>';
        return;
    }

    const icons = {
        invoice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
        quote: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E07820" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        mandate: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
        document: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E44AD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>'
    };

    const typeLabels = {
        invoice: 'Facture',
        quote: 'Devis',
        mandate: 'Mandat',
        document: 'Document'
    };

    const bgColors = {
        invoice: 'rgba(27,79,138,0.07)',
        quote: 'rgba(224,120,32,0.07)',
        mandate: 'rgba(39,174,96,0.07)',
        document: 'rgba(142,68,173,0.07)'
    };

    list.innerHTML = activities.map(a => {
        const icon = icons[a.type] || icons.mandate;
        const label = typeLabels[a.type] || 'Activité';
        const bg = bgColors[a.type] || bgColors.mandate;
        const date = new Date(a.date).toLocaleDateString('fr-CA', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        return `
        <div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid var(--color-border)">
            <div style="width:34px;height:34px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
                ${icon}
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-size:0.88rem;font-weight:600;color:var(--color-text);margin-bottom:0.2rem">${a.description}</div>
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                    <span style="font-size:0.72rem;font-weight:600;color:white;background:var(--color-primary);padding:0.1rem 0.5rem;border-radius:10px">${label}</span>
                    ${a.amount ? `<span style="font-size:0.78rem;font-weight:700;color:var(--color-primary)">${new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(a.amount)}</span>` : ''}
                    ${a.status ? `<span style="font-size:0.72rem;color:var(--color-text-light)">${a.status}</span>` : ''}
                </div>
                <div style="font-size:0.72rem;color:var(--color-text-light);margin-top:0.25rem">${date}</div>
            </div>
        </div>`;
    }).join('');
}

// ---------- Render Mandates ----------
function renderMandates(mandates) {
    const list = document.getElementById('mandates-list');
    if (!mandates.length) {
        list.innerHTML = `<div class="portal-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <p>Aucun mandat actif pour l'instant.</p>
            <a href="contact.html" class="btn btn-outline btn-sm">Démarrer un projet</a>
        </div>`; return;
    }
    const statusLabels = { 'active': 'En cours', 'pending': 'En attente', 'completed': 'Complété', 'paused': 'En pause' };
    const serviceLabels = { 'plc-support': 'Support PLC', 'audit': 'Audit technique', 'documentation': 'Documentation', 'refactoring': 'Refactorisation' };
    list.innerHTML = mandates.map(m => `
        <div class="portal-list-item">
            <div style="flex:1">
                <div class="portal-item-title">${m.title}</div>
                <div class="portal-item-desc">${m.description || ''}</div>
                <div class="portal-item-meta">
                    ${m.service_type ? `<span style="background:var(--color-light-blue);color:var(--color-primary);padding:0.15rem 0.5rem;border-radius:10px;font-size:0.72rem;font-weight:600">${serviceLabels[m.service_type] || m.service_type}</span>` : ''}
                    <span>Début: ${new Date(m.start_date || m.created_at).toLocaleDateString('fr-CA')}</span>
                    ${m.end_date ? `<span>Fin prévue: ${new Date(m.end_date).toLocaleDateString('fr-CA')}</span>` : ''}
                </div>
                <div class="portal-progress">
                    <div class="portal-progress-label"><span>Progression</span><span>${m.progress || 0}%</span></div>
                    <div class="portal-progress-bar"><div class="portal-progress-fill" style="width:${m.progress || 0}%"></div></div>
                </div>
                ${m.notes ? `<div style="margin-top:0.75rem;padding:0.6rem 0.75rem;background:var(--color-light-blue);border-radius:6px;font-size:0.82rem;color:var(--color-primary);border-left:3px solid var(--color-primary)"><strong>Note de VNK :</strong> ${m.notes}</div>` : ''}
            </div>
            <div class="portal-item-actions">
                <span class="portal-status portal-status-${m.status}">${statusLabels[m.status] || m.status}</span>
            </div>
        </div>`).join('');
}

// ---------- Render Quotes ----------
function renderQuotes(quotes) {
    const list = document.getElementById('quotes-list');
    if (!quotes.length) {
        list.innerHTML = `<div class="portal-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p>Aucun devis disponible.</p>
        </div>`; return;
    }
    const statusLabels = { pending: 'En attente', accepted: 'Accepté', expired: 'Expiré' };
    const statusClass = { pending: 'pending', accepted: 'accepted', expired: 'expired' };
    list.innerHTML = quotes.map(q => `
        <div class="portal-list-item">
            <div style="flex:1">
                <div class="portal-item-title">${q.quote_number} — ${q.title}</div>
                <div class="portal-item-desc">${q.description || ''}</div>
                <div class="portal-item-meta">
                    <span>Émis: ${new Date(q.created_at).toLocaleDateString('fr-CA')}</span>
                    <span>Expire: ${new Date(q.expiry_date).toLocaleDateString('fr-CA')}</span>
                </div>
                <div style="margin-top:0.5rem;display:flex;gap:0.75rem;font-size:0.8rem;color:var(--color-text-light);flex-wrap:wrap">
                    <span>Sous-total: ${formatCurrency(q.amount_ht)}</span>
                    <span>TPS: ${formatCurrency(q.tps_amount)}</span>
                    <span>TVQ: ${formatCurrency(q.tvq_amount)}</span>
                </div>
            </div>
            <div class="portal-item-actions">
                <span class="portal-item-amount">${formatCurrency(q.amount_ttc)}</span>
                <span class="portal-status portal-status-${statusClass[q.status] || 'pending'}">${statusLabels[q.status] || q.status}</span>
                <div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;justify-content:flex-end">
                    <button class="btn btn-outline btn-sm" onclick="downloadPDF('quotes', ${q.id}, '${q.quote_number}')">PDF</button>
                    ${q.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="acceptQuote(${q.id})">Accepter</button>` : ''}
                </div>
            </div>
        </div>`).join('');
}

// ---------- Render Invoices ----------
function renderInvoices(invoices) {
    const list = document.getElementById('invoices-list');
    if (!invoices.length) {
        list.innerHTML = `<div class="portal-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <p>Aucune facture disponible.</p>
        </div>`; return;
    }
    const unpaid = invoices.filter(i => i.status === 'unpaid');
    const paid = invoices.filter(i => i.status === 'paid');
    let html = '';
    if (unpaid.length) {
        html += `<div style="margin-bottom:0.75rem;font-size:0.82rem;font-weight:700;color:var(--color-error);text-transform:uppercase;letter-spacing:0.5px">${unpaid.length} facture${unpaid.length > 1 ? 's' : ''} non payée${unpaid.length > 1 ? 's' : ''}</div>`;
        html += unpaid.map(inv => {
            const isOverdue = new Date(inv.due_date) < new Date();
            const statusClass = isOverdue ? 'unpaid' : 'pending';
            const statusLabel = isOverdue ? 'En retard' : 'Non payée';
            const borderColor = isOverdue ? 'var(--color-error)' : '#E07820';
            return `<div class="portal-list-item" style="border-left:3px solid ${borderColor}">
                <div style="flex:1">
                    <div class="portal-item-title">${inv.invoice_number} — ${inv.title}</div>
                    <div class="portal-item-desc">${inv.description || ''}</div>
                    <div class="portal-item-meta">
                        <span>Émise: ${new Date(inv.created_at).toLocaleDateString('fr-CA')}</span>
                        <span ${isOverdue ? 'style="color:var(--color-error);font-weight:600"' : ''}>Échéance: ${new Date(inv.due_date).toLocaleDateString('fr-CA')}</span>
                    </div>
                    <div style="margin-top:0.4rem;display:flex;gap:0.75rem;font-size:0.78rem;color:var(--color-text-light);flex-wrap:wrap">
                        <span>Sous-total: ${formatCurrency(inv.amount_ht)}</span>
                        <span>TPS: ${formatCurrency(inv.tps_amount)}</span>
                        <span>TVQ: ${formatCurrency(inv.tvq_amount)}</span>
                    </div>
                </div>
                <div class="portal-item-actions">
                    <span class="portal-item-amount">${formatCurrency(inv.amount_ttc)}</span>
                    <span class="portal-status portal-status-${statusClass}">${statusLabel}</span>
                    <div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;justify-content:flex-end">
                        <button class="btn btn-outline btn-sm" onclick="downloadPDF('invoices', ${inv.id}, '${inv.invoice_number}')">PDF</button>
                        <button class="btn btn-primary btn-sm" onclick="payInvoice(${inv.id}, ${inv.amount_ttc})">Payer</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    if (paid.length) {
        html += `<div style="margin-top:1.5rem;margin-bottom:0.75rem;font-size:0.82rem;font-weight:700;color:var(--color-success);text-transform:uppercase;letter-spacing:0.5px">Factures payées (${paid.length})</div>`;
        html += paid.map(inv => `
            <div class="portal-list-item" style="border-left:3px solid var(--color-success);opacity:0.85">
                <div style="flex:1">
                    <div class="portal-item-title">${inv.invoice_number} — ${inv.title}</div>
                    <div class="portal-item-meta"><span>Payée: ${inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('fr-CA') : '--'}</span></div>
                </div>
                <div class="portal-item-actions">
                    <span class="portal-item-amount">${formatCurrency(inv.amount_ttc)}</span>
                    <span class="portal-status portal-status-paid">Payée</span>
                    <button class="btn btn-outline btn-sm" onclick="downloadPDF('invoices', ${inv.id}, '${inv.invoice_number}')" style="margin-top:0.5rem">PDF</button>
                </div>
            </div>`).join('');
    }
    list.innerHTML = html;
}

// ---------- Render Documents ----------
function renderDocuments(documents) {
    const list = document.getElementById('documents-list');
    if (!documents.length) {
        list.innerHTML = `<div class="portal-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            <p>Aucun document disponible pour l'instant.</p>
            <p style="font-size:0.8rem;color:var(--color-text-light)">Les rapports et livrables apparaîtront ici une fois votre mandat démarré.</p>
        </div>`; return;
    }
    const fileIcons = {
        pdf: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        doc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2E75B6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        docx: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2E75B6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        zip: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
        default: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>'
    };
    const typeLabels = { pdf: 'Rapport PDF', doc: 'Document Word', docx: 'Document Word', zip: 'Archive ZIP', default: 'Document' };
    list.innerHTML = documents.map(doc => {
        const ext = (doc.file_type || (doc.file_name || '').split('.').pop() || 'default').toLowerCase();
        const icon = fileIcons[ext] || fileIcons.default;
        const typeLabel = typeLabels[ext] || typeLabels.default;
        const size = doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : '';
        return `<div class="portal-list-item">
            <div style="display:flex;align-items:center;gap:0.75rem;flex:1">
                <div style="flex-shrink:0">${icon}</div>
                <div>
                    <div class="portal-item-title">${doc.title}</div>
                    <div class="portal-item-desc">${doc.description || ''}</div>
                    <div class="portal-item-meta">
                        <span style="background:var(--color-light-blue);color:var(--color-primary);padding:0.15rem 0.5rem;border-radius:10px;font-size:0.72rem;font-weight:600">${typeLabel}</span>
                        ${doc.mandate_title ? `<span>Mandat: ${doc.mandate_title}</span>` : ''}
                        <span>${new Date(doc.created_at).toLocaleDateString('fr-CA')}</span>
                        ${size ? `<span>${size}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="portal-item-actions">
                ${doc.file_url ? `<a href="${doc.file_url}" target="_blank" class="btn btn-primary btn-sm">Télécharger</a>` : '<span style="font-size:0.78rem;color:var(--color-text-light)">Bientôt disponible</span>'}
            </div>
        </div>`;
    }).join('');
}

// ---------- Render Messages ----------
function renderMessages(messages) {
    const list = document.getElementById('messages-list');
    if (!messages.length) { list.innerHTML = '<p class="portal-empty">Aucun message. Envoyez votre premier message ci-dessous.</p>'; return; }
    list.innerHTML = messages.map(m => `
        <div style="display:flex;flex-direction:column;align-items:${m.sender === 'client' ? 'flex-end' : 'flex-start'}">
            <div style="font-size:0.72rem;color:var(--color-text-light);margin-bottom:0.2rem">${m.sender === 'client' ? 'Vous' : 'VNK Automatisation'}</div>
            <div class="portal-message-bubble portal-message-${m.sender === 'client' ? 'client' : 'vnk'}">${m.content}</div>
            <div class="portal-message-time">${new Date(m.created_at).toLocaleString('fr-CA')}</div>
        </div>`).join('');
    list.scrollTop = list.scrollHeight;
}

// ---------- Send message ----------
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;
    const token = localStorage.getItem('vnk-token');
    const sendBtn = document.querySelector('.portal-message-compose .btn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Envoi...'; }
    try {
        const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            input.value = '';
            const messagesRes = await fetch('/api/messages', { headers: { 'Authorization': `Bearer ${token}` } });
            if (messagesRes.ok) { const data = await messagesRes.json(); renderMessages(data.messages || []); }
        }
    } catch (error) { console.error('Send message error:', error); }
    finally { if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Envoyer'; } }
}

// ---------- Accept quote ----------
async function acceptQuote(quoteId) {
    const token = localStorage.getItem('vnk-token');
    if (!confirm('Voulez-vous accepter ce devis ? Un contrat vous sera envoyé pour signature.')) return;
    try {
        const res = await fetch(`/api/quotes/${quoteId}/accept`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) loadAllData();
    } catch (error) { console.error('Accept quote error:', error); }
}

// ---------- Download PDF ----------
async function downloadPDF(type, id, number) {
    const token = localStorage.getItem('vnk-token');
    try {
        const response = await fetch(`/api/${type}/${id}/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `VNK-${number}.pdf`;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); a.remove();
        }
    } catch (error) { console.error('PDF download error:', error); }
}

// ---------- Currency helper ----------
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

// ---------- Logout ----------
function logout() {
    localStorage.removeItem('vnk-token');
    localStorage.removeItem('vnk-user');
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('dashboard-section').style.display = 'none';
}

function togglePortalPw() {
    const input = document.getElementById('login-password');
    const eye = document.getElementById('eye-portal');
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    if (eye) {
        eye.innerHTML = isHidden
            ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
            : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
}

/* ============================================
VNK — Badge messages flottant côté client
À ajouter dans portal.js
============================================ */

// ---------- Polling messages automatique ----------
// Appeler cette fonction dans portal.js après le login

let messagePollingInterval = null;

function startMessagePolling() {
    // Vérifier toutes les 30 secondes
    messagePollingInterval = setInterval(async () => {
        try {
            const token = localStorage.getItem('vnk-token');
            if (!token) { stopMessagePolling(); return; }
            const res = await fetch('/api/messages', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!data.success) return;
            const unread = data.messages.filter(m => m.sender === 'vnk' && !m.is_read).length;
            updateMessageBadge(unread);
            // Mettre à jour le badge dans la sidebar
            const badge = document.getElementById('badge-messages');
            if (badge) { badge.textContent = unread; badge.style.display = unread ? 'inline' : 'none'; }
        } catch (err) {
            console.warn('Polling error:', err);
        }
    }, 30000);
}

function stopMessagePolling() {
    if (messagePollingInterval) { clearInterval(messagePollingInterval); messagePollingInterval = null; }
}

function updateMessageBadge(count) {
    // Badge flottant sur toutes les pages
    let badge = document.getElementById('vnk-float-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'vnk-float-badge';
        badge.style.cssText = `
            position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9000;
            background: #1B4F8A; color: white; border-radius: 50px;
            padding: 0.6rem 1rem; font-size: 0.85rem; font-weight: 700;
            display: flex; align-items: center; gap: 0.5rem;
            box-shadow: 0 4px 16px rgba(27,79,138,0.35); cursor: pointer;
            transition: all 0.2s;
        `;
        badge.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span id="vnk-float-badge-count">1</span>
        `;
        badge.onclick = () => { showTab('messages'); badge.style.display = 'none'; };
        document.body.appendChild(badge);
    }
    if (count > 0) {
        document.getElementById('vnk-float-badge-count').textContent = count;
        badge.style.display = 'flex';
        // Notification sonore légère
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 520; gain.gain.value = 0.1;
            osc.start(); osc.stop(ctx.currentTime + 0.15);
        } catch { }
    } else {
        badge.style.display = 'none';
    }
}