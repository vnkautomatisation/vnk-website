/* ============================================
   VNK Automatisation Inc. - Admin JavaScript
   Version complète Phase 2
   Corrections: polling, contrats, messages bulles
   ============================================ */

let adminToken = null;
let allClients = [];
let allContracts = [], allDisputes = [], allRefunds = [], allExpenses = [], allTaxDecls = [];
let contractFilter = 'all', disputeFilter = 'all';
let adminPollingInterval = null;

// ---------- Confirm modal ----------
function showConfirm(message, onConfirm, onCancel) {
    const existing = document.getElementById('confirm-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `<div style="background:white;border-radius:14px;padding:2rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.25);text-align:center;">
        <div style="width:52px;height:52px;border-radius:50%;background:rgba(27,79,138,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <p style="font-size:0.95rem;color:#333;font-weight:500;margin-bottom:1.5rem;line-height:1.5">${message}</p>
        <div style="display:flex;gap:0.75rem;justify-content:center;">
            <button id="confirm-cancel" style="padding:0.65rem 1.5rem;border-radius:8px;border:1.5px solid #E2E8F0;background:white;color:#666;font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;">Annuler</button>
            <button id="confirm-ok" style="padding:0.65rem 1.5rem;border-radius:8px;border:none;background:#1B4F8A;color:white;font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;">Confirmer</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('confirm-ok').onclick = () => { modal.remove(); if (onConfirm) onConfirm(); };
    document.getElementById('confirm-cancel').onclick = () => { modal.remove(); if (onCancel) onCancel(); };
    modal.onclick = e => { if (e.target === modal) { modal.remove(); if (onCancel) onCancel(); } };
}

// ---------- Toggle password ----------
function togglePw(inputId, btn) {
    const input = document.getElementById(inputId);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.innerHTML = isHidden
        ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// ---------- Login ----------
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('admin-login-error');
    errEl.style.display = 'none';
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Connexion...';
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('admin-email').value,
                password: document.getElementById('admin-password').value
            })
        });
        const data = await res.json();
        if (data.success && data.token) {
            adminToken = data.token;
            localStorage.setItem('vnk-admin-token', data.token);
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-app').style.display = 'flex';
            await loadAllAdmin();
            startAdminPolling(); // ← CORRECTION 1: démarrer le polling après login
        } else {
            errEl.textContent = data.message || 'Identifiants incorrects.';
            errEl.style.display = 'block';
        }
    } catch {
        errEl.textContent = 'Erreur de connexion.';
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Accéder au tableau de bord`;
    }
});

function adminLogout() {
    adminToken = null;
    localStorage.removeItem('vnk-admin-token');
    if (adminPollingInterval) { clearInterval(adminPollingInterval); adminPollingInterval = null; }
    document.getElementById('admin-login').style.display = 'flex';
    document.getElementById('admin-app').style.display = 'none';
}

window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('vnk-admin-token');
    if (saved) {
        adminToken = saved;
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-app').style.display = 'flex';
        loadAllAdmin().then(() => startAdminPolling()); // ← CORRECTION 1: polling au démarrage
    }
    const h = new Date().getHours();
    const g = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    const grEl = document.getElementById('dash-greeting');
    if (grEl) grEl.textContent = `${g}, Yan Verone`;

    const prog = document.getElementById('nm-progress');
    if (prog) prog.addEventListener('input', function () {
        const v = document.getElementById('nm-progress-val');
        const b = document.getElementById('nm-progress-bar');
        if (v) v.textContent = this.value;
        if (b) b.style.width = this.value + '%';
    });

    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
    });
});

// ---------- Polling automatique messages ----------
function startAdminPolling() {
    if (adminPollingInterval) return; // éviter doublons
    adminPollingInterval = setInterval(async () => {
        try {
            const data = await api('/unread-count');
            if (!data.success) return;
            const count = data.count;
            const b = document.getElementById('badge-messages-admin');
            if (b) { b.textContent = count; b.style.display = count ? 'inline' : 'none'; }
            updateAdminFloatBadge(count);
        } catch { }
    }, 30000);
}

function updateAdminFloatBadge(count) {
    let badge = document.getElementById('admin-float-badge');
    if (!badge && count > 0) {
        badge = document.createElement('div');
        badge.id = 'admin-float-badge';
        badge.style.cssText = 'position:fixed;bottom:5rem;right:1.5rem;z-index:9000;background:#E74C3C;color:white;border-radius:50px;padding:0.6rem 1rem;font-size:0.82rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;box-shadow:0 4px 16px rgba(231,76,60,0.35);cursor:pointer;';
        badge.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span id="admin-float-count">${count}</span> nouveau${count > 1 ? 'x' : ''} message${count > 1 ? 's' : ''}`;
        badge.onclick = () => { showSection('messages'); badge.style.display = 'none'; };
        if (!document.getElementById('pulse-style')) {
            const s = document.createElement('style');
            s.id = 'pulse-style';
            s.textContent = '@keyframes vnkpulse{0%,100%{transform:scale(1);}50%{transform:scale(1.04);}}';
            document.head.appendChild(s);
        }
        badge.style.animation = 'vnkpulse 2s infinite';
        document.body.appendChild(badge);
    }
    if (badge) {
        if (count > 0) {
            const el = document.getElementById('admin-float-count');
            if (el) el.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// ---------- API ----------
function authH() { return { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }; }

async function api(path, method = 'GET', body = null) {
    const opts = { method, headers: authH() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api/admin' + path, opts);
    const data = await res.json();
    if (!data.success && (data.message === 'Access denied.' || data.message === 'Invalid token.')) adminLogout();
    return data;
}

async function loadAllAdmin() {
    await Promise.all([
        loadDashboard(), loadClients(), loadMandates(),
        loadQuotes(), loadInvoices(), loadDocuments(),
        loadMessages(), loadPayments(),
        loadContracts(), loadDisputes(), loadRefunds(),
        loadExpenses(), loadTaxDecls()
    ]);
}

// ---------- Dashboard ----------
async function loadDashboard() {
    const data = await api('/dashboard');
    if (!data.success) return;
    const s = data.stats;
    document.getElementById('d-clients').textContent = s.clients;
    document.getElementById('d-mandates').textContent = s.activeMandates;
    document.getElementById('d-unpaid').textContent = s.unpaidInvoices;
    document.getElementById('d-unpaid-amount').textContent = s.unpaidAmount > 0 ? fmt(s.unpaidAmount) : '';
    document.getElementById('d-revenue').textContent = fmt(s.monthRevenue);
    const act = document.getElementById('admin-activity');
    if (!data.activity?.length) {
        act.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;padding:0.5rem 0">Aucune activité récente.</p>';
        return;
    }
    act.innerHTML = data.activity.map(a => `
        <div style="display:flex;align-items:center;gap:0.85rem;padding:0.7rem 0;border-bottom:1px solid var(--border)">
            <div style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${a.type === 'invoice' ? 'var(--warning)' : a.type === 'quote' ? 'var(--primary)' : 'var(--success)'}"></div>
            <div style="flex:1;min-width:0">
                <div style="font-size:0.86rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.description}</div>
                <div style="font-size:0.75rem;color:var(--text-light)">${a.client_name} · ${new Date(a.date).toLocaleDateString('fr-CA')}</div>
            </div>
            ${a.amount ? `<div style="font-size:0.86rem;font-weight:700;color:var(--primary);white-space:nowrap">${fmt(a.amount)}</div>` : ''}
        </div>`).join('');
}

// ---------- Clients ----------
async function loadClients() {
    const data = await api('/clients');
    if (!data.success) return;
    allClients = data.clients || [];
    const b = document.getElementById('badge-clients');
    b.textContent = allClients.length;
    b.style.display = allClients.length ? 'inline' : 'none';
    const list = document.getElementById('clients-list');
    if (list) {
        if (!allClients.length) { list.innerHTML = '<div class="empty-state"><p>Aucun client.</p></div>'; }
        else list.innerHTML = allClients.map(c => `
            <div class="client-card">
                <div class="client-avatar">${initials(c.full_name)}</div>
                <div style="flex:1">
                    <div class="client-name">${c.full_name}
                        <span class="badge badge-${c.is_active ? 'active' : 'expired'}" style="margin-left:0.5rem">${c.is_active ? 'Actif' : 'Inactif'}</span>
                    </div>
                    <div class="client-company">${c.company_name || '—'}</div>
                    <div class="client-meta">
                        <span>${c.email}</span>
                        ${c.phone ? `<span>${c.phone}</span>` : ''}
                        ${c.city ? `<span>${c.city}${c.province ? ', ' + c.province : ''}</span>` : ''}
                        <span>Depuis ${new Date(c.created_at).toLocaleDateString('fr-CA')}</span>
                        ${c.last_login ? `<span>Connexion: ${new Date(c.last_login).toLocaleDateString('fr-CA')}</span>` : ''}
                    </div>
                    ${c.technologies ? `<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.35rem">${c.technologies.split(',').filter(Boolean).map(t => `<span style="font-size:0.68rem;font-weight:600;padding:0.1rem 0.45rem;border-radius:10px;background:var(--light-blue);color:var(--primary)">${t.trim()}</span>`).join('')}</div>` : ''}
                </div>
            </div>`).join('');
    }
    // Remplir tous les selects clients
    ['nm-client', 'nq-client', 'ni-client', 'nd-client', 'nct-client', 'nd2-client', 'nr-client', 'conv-client'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="">Sélectionner un client</option>' +
            allClients.map(c => `<option value="${c.id}">${c.full_name}${c.company_name ? ' — ' + c.company_name : ''}</option>`).join('');
        if (cur) sel.value = cur;
    });
    // Remplir quotes pour contrats
    const qsel = document.getElementById('nct-quote');
    if (qsel) {
        qsel.innerHTML = '<option value="">Aucun</option>';
        // sera rempli après loadQuotes
    }
}

// ---------- Mandates ----------
async function loadMandates() {
    const data = await api('/mandates');
    if (!data.success) return;
    const tbody = document.getElementById('mandates-tbody');
    if (!tbody) return;
    const svc = { 'plc-support': 'Support PLC', audit: 'Audit', documentation: 'Documentation', refactoring: 'Refactorisation' };
    if (!data.mandates.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:2rem">Aucun mandat.</td></tr>'; return; }
    tbody.innerHTML = data.mandates.map(m => `
        <tr>
            <td><div style="font-weight:600">${m.client_name}</div><div style="font-size:0.75rem;color:var(--text-light)">${m.company_name || ''}</div></td>
            <td><div style="font-weight:600">${m.title}</div>${m.notes ? `<div style="font-size:0.75rem;color:var(--text-light);margin-top:2px;font-style:italic">${m.notes.substring(0, 60)}${m.notes.length > 60 ? '…' : ''}</div>` : ''}</td>
            <td>${svc[m.service_type] || m.service_type || '—'}</td>
            <td><span class="badge badge-${m.status}">${statusLabel(m.status)}</span></td>
            <td style="min-width:140px">
                <div style="display:flex;align-items:center;gap:0.5rem">
                    <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${m.progress || 0}%;background:linear-gradient(90deg,var(--primary),var(--secondary));border-radius:3px"></div>
                    </div>
                    <span style="font-size:0.75rem;color:var(--text-light);min-width:30px">${m.progress || 0}%</span>
                </div>
            </td>
            <td style="font-size:0.8rem;color:var(--text-light)">${m.start_date ? new Date(m.start_date).toLocaleDateString('fr-CA') : '—'}</td>
            <td><div class="td-actions">
                <button class="btn btn-sm btn-outline" onclick="openEditMandate(${m.id},'${m.status}',${m.progress || 0},\`${(m.notes || '').replace(/`/g, "'")}\`)">Modifier</button>
            </div></td>
        </tr>`).join('');
    // Remplir selects mandats
    ['nd2-mandate', 'nct-mandate'].forEach(id => {
        const sel = document.getElementById(id); if (!sel) return;
        sel.innerHTML = '<option value="">Aucun</option>' + data.mandates.map(m => `<option value="${m.id}">${m.title}</option>`).join('');
    });
}

// ---------- Quotes ----------
async function loadQuotes() {
    const data = await api('/quotes');
    if (!data.success) return;
    const pending = (data.quotes || []).filter(q => q.status === 'pending').length;
    const b = document.getElementById('badge-quotes-admin');
    b.textContent = pending; b.style.display = pending ? 'inline' : 'none';
    const tbody = document.getElementById('quotes-tbody');
    if (!tbody) return;
    if (!data.quotes.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem">Aucun devis.</td></tr>'; return; }
    tbody.innerHTML = data.quotes.map(q => `
        <tr>
            <td><strong>${q.quote_number}</strong></td>
            <td>${q.client_name}</td>
            <td>${q.title}</td>
            <td style="color:var(--text-light)">${fmt(q.amount_ht)}</td>
            <td style="font-weight:700;color:var(--primary)">${fmt(q.amount_ttc)}</td>
            <td><span class="badge badge-${q.status}">${statusLabel(q.status)}</span></td>
            <td style="font-size:0.8rem;color:var(--text-light)">${q.expiry_date ? new Date(q.expiry_date).toLocaleDateString('fr-CA') : '—'}</td>
            <td><div class="td-actions">
                <a href="/api/quotes/${q.id}/pdf" target="_blank" class="btn btn-sm btn-outline">PDF</a>
                ${q.status === 'pending' ? `<button class="btn btn-sm btn-ghost" onclick="expireQuote(${q.id})">Expirer</button>` : ''}
            </div></td>
        </tr>`).join('');
    // Remplir select quotes pour contrats
    const qsel = document.getElementById('nct-quote');
    if (qsel) qsel.innerHTML = '<option value="">Aucun</option>' + data.quotes.map(q => `<option value="${q.id}">${q.quote_number} — ${q.title}</option>`).join('');
    // Remplir select invoices pour litiges/remboursements après loadInvoices
}

async function expireQuote(id) {
    showConfirm('Marquer ce devis comme expiré ?', async () => {
        await api('/quotes/' + id + '/expire', 'PUT');
        loadQuotes(); showToast('Devis expiré.');
    });
}

// ---------- Invoices ----------
async function loadInvoices() {
    const data = await api('/invoices');
    if (!data.success) return;
    const unpaid = (data.invoices || []).filter(i => i.status === 'unpaid').length;
    const b = document.getElementById('badge-invoices-admin');
    b.textContent = unpaid; b.style.display = unpaid ? 'inline' : 'none';
    const tbody = document.getElementById('invoices-tbody');
    if (!tbody) return;
    if (!data.invoices.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem">Aucune facture.</td></tr>'; return; }
    tbody.innerHTML = data.invoices.map(inv => {
        const overdue = inv.status === 'unpaid' && new Date(inv.due_date) < new Date();
        return `<tr>
            <td><strong>${inv.invoice_number}</strong></td>
            <td>${inv.client_name}</td>
            <td>${inv.title}</td>
            <td style="color:var(--text-light)">${fmt(inv.amount_ht)}</td>
            <td style="font-weight:700;color:var(--primary)">${fmt(inv.amount_ttc)}</td>
            <td><span class="badge badge-${overdue ? 'overdue' : inv.status}">${overdue ? 'En retard' : statusLabel(inv.status)}</span></td>
            <td style="font-size:0.8rem;${overdue ? 'color:var(--error);font-weight:600' : ''}">${inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-CA') : '—'}</td>
            <td><div class="td-actions">
                <a href="/api/invoices/${inv.id}/pdf" target="_blank" class="btn btn-sm btn-outline">PDF</a>
                ${inv.status === 'unpaid' ? `<button class="btn btn-sm btn-success" onclick="markPaid(${inv.id},'${inv.invoice_number}','${fmt(inv.amount_ttc)}')">✓ Payée</button>` : ''}
            </div></td>
        </tr>`;
    }).join('');
    // Remplir select invoices pour litiges et remboursements
    ['nd2-invoice', 'nr-invoice'].forEach(id => {
        const sel = document.getElementById(id); if (!sel) return;
        sel.innerHTML = '<option value="">Aucune</option>' + data.invoices.map(i => `<option value="${i.id}">${i.invoice_number} — ${i.client_name} (${fmt(i.amount_ttc)})</option>`).join('');
    });
}

// ---------- Documents ----------
async function loadDocuments() {
    const data = await api('/documents');
    if (!data.success) return;
    const tbody = document.getElementById('documents-tbody');
    if (!tbody) return;
    const typeL = { pdf: 'PDF', docx: 'Word', zip: 'ZIP', other: 'Document' };
    if (!data.documents.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:2rem">Aucun document.</td></tr>'; return; }
    tbody.innerHTML = data.documents.map(d => `
        <tr>
            <td>${d.client_name}</td>
            <td><div style="font-weight:600">${d.title}</div>${d.description ? `<div style="font-size:0.75rem;color:var(--text-light)">${d.description}</div>` : ''}</td>
            <td><span class="badge badge-accepted">${typeL[d.file_type] || d.file_type}</span></td>
            <td style="font-size:0.8rem;color:var(--text-light)">${d.mandate_title || '—'}</td>
            <td style="font-size:0.8rem;color:var(--text-light)">${new Date(d.created_at).toLocaleDateString('fr-CA')}</td>
            <td><div class="td-actions">
                ${d.file_url ? `<a href="${d.file_url}" target="_blank" class="btn btn-sm btn-outline">Voir</a>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteDocument(${d.id},'${d.title.replace(/'/g, "\\'")}')">Supprimer</button>
            </div></td>
        </tr>`).join('');
}

// ---------- Messages — CORRECTION 2: bulles correctement rendues ----------
async function loadMessages() {
    const data = await api('/messages');
    if (!data.success) return;
    const unread = (data.threads || []).reduce((s, t) => s + (t.unread_count || 0), 0);
    const b = document.getElementById('badge-messages-admin');
    b.textContent = unread; b.style.display = unread ? 'inline' : 'none';
    const thread = document.getElementById('messages-thread');
    if (!thread) return;
    if (!data.threads?.length) {
        thread.innerHTML = '<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>Aucun message.</p></div>';
        return;
    }
    thread.innerHTML = data.threads.map(t => `
        <div class="msg-client-block">
            <div class="msg-client-header" onclick="toggleMessages(${t.client_id})">
                <div class="msg-client-name">${t.client_name}
                    <span style="font-weight:400;color:var(--text-light);font-size:0.8rem"> — ${t.company_name || ''}</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.6rem">
                    ${t.unread_count ? `<span class="msg-unread-badge">${t.unread_count} non lu${t.unread_count > 1 ? 's' : ''}</span>` : ''}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </div>
            <div id="msg-block-${t.client_id}" style="display:none">
                <div class="msg-list" id="msg-list-${t.client_id}" style="max-height:340px;overflow-y:auto;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:0.65rem">
                    ${renderMsgBubbles(t)}
                </div>
                <div class="msg-compose" style="padding:0.85rem 1.25rem;border-top:1px solid var(--border);display:flex;gap:0.65rem;align-items:flex-end">
                    <textarea id="reply-${t.client_id}" rows="2" style="flex:1;padding:0.6rem 0.85rem;border:1.5px solid var(--border);border-radius:8px;font-size:0.85rem;font-family:inherit;resize:none;" placeholder="Répondre en tant que VNK..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAdminMessage(${t.client_id});}"></textarea>
                    <button class="btn btn-primary btn-sm" onclick="sendAdminMessage(${t.client_id})">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Envoyer
                    </button>
                </div>
            </div>
        </div>`).join('');
}

function renderMsgBubbles(t) {
    if (!t.messages?.length) return '<p style="color:var(--text-light);font-size:0.82rem;text-align:center;padding:1rem">Aucun message.</p>';
    return t.messages.map(m => `
        <div style="display:flex;flex-direction:column;align-items:${m.sender === 'client' ? 'flex-start' : 'flex-end'}">
            <div style="font-size:0.7rem;color:var(--text-light);margin-bottom:0.15rem;font-weight:600">${m.sender === 'client' ? t.client_name : 'VNK Automatisation'}</div>
            <div style="max-width:78%;padding:0.65rem 1rem;border-radius:10px;font-size:0.85rem;line-height:1.55;${m.sender === 'client' ? 'background:var(--light-blue);color:var(--text);border-bottom-left-radius:3px' : 'background:var(--primary);color:white;border-bottom-right-radius:3px'}">${m.content}</div>
            <div style="font-size:0.68rem;color:var(--text-light);margin-top:0.2rem">${new Date(m.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>`).join('');
}

function toggleMessages(id) {
    const el = document.getElementById('msg-block-' + id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') {
        const l = document.getElementById('msg-list-' + id);
        if (l) setTimeout(() => l.scrollTop = l.scrollHeight, 50);
    }
}

async function sendAdminMessage(clientId) {
    const input = document.getElementById('reply-' + clientId);
    const content = input.value.trim();
    if (!content) return;
    const btn = input.nextElementSibling;
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    const data = await api('/messages/' + clientId, 'POST', { content });
    if (data.success) { input.value = ''; await loadMessages(); toggleMessages(clientId); showToast('Message envoyé', 'success'); }
    else showToast(data.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Envoyer`; }
}

// ---------- Payments ----------
async function loadPayments() {
    const data = await api('/payments');
    if (!data.success) return;
    document.getElementById('p-total-paid').textContent = fmt(data.totalPaid || 0);
    document.getElementById('p-total-unpaid').textContent = fmt(data.totalUnpaid || 0);
    document.getElementById('p-total-invoiced').textContent = fmt(data.totalInvoiced || 0);
    const tbody = document.getElementById('payments-tbody');
    if (!tbody) return;
    if (!data.invoices?.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem">Aucune facture.</td></tr>'; return; }
    tbody.innerHTML = data.invoices.map(inv => {
        const overdue = inv.status === 'unpaid' && new Date(inv.due_date) < new Date();
        return `<tr>
            <td><strong>${inv.invoice_number}</strong></td>
            <td>${inv.client_name}</td>
            <td style="color:var(--text-light)">${fmt(inv.amount_ht)}</td>
            <td style="font-weight:700;color:var(--primary)">${fmt(inv.amount_ttc)}</td>
            <td><span class="badge badge-${overdue ? 'overdue' : inv.status}">${overdue ? 'En retard' : statusLabel(inv.status)}</span></td>
            <td style="font-size:0.8rem">${inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-CA') : '—'}</td>
            <td style="font-size:0.8rem;color:var(--success);font-weight:600">${inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('fr-CA') : '—'}</td>
            <td>${inv.status === 'unpaid'
                ? `<button class="btn btn-sm btn-success" onclick="markPaid(${inv.id},'${inv.invoice_number}','${fmt(inv.amount_ttc)}')">✓ Confirmer</button>`
                : `<span style="color:var(--success);font-size:0.8rem;font-weight:600">✓ Payée</span>`
            }</td>
        </tr>`;
    }).join('');
}

// ============================================
// CONTRATS — CORRECTION 3: table contracts
// ============================================
async function loadContracts() {
    const data = await api('/contracts').catch(() => ({ success: false }));
    if (!data.success) {
        // Table peut ne pas encore exister — afficher message informatif
        const tbody = document.getElementById('contracts-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem">⚠️ Table contracts non trouvée — exécutez phase1_schema.sql dans pgAdmin.</td></tr>';
        return;
    }
    allContracts = data.contracts || [];
    const pending = allContracts.filter(c => c.status === 'draft' || c.status === 'pending').length;
    const b = document.getElementById('badge-contracts');
    if (b) { b.textContent = pending; b.style.display = pending ? 'inline' : 'none'; }
    renderContracts();
}

function renderContracts() {
    const search = (document.getElementById('contracts-search')?.value || '').toLowerCase();
    let list = [...allContracts];
    if (contractFilter !== 'all') list = list.filter(c => c.status === contractFilter);
    if (search) list = list.filter(c => (c.client_name + ' ' + c.title + ' ' + c.contract_number).toLowerCase().includes(search));
    const tbody = document.getElementById('contracts-tbody');
    if (!tbody) return;
    const sl = { draft: 'Brouillon', pending: 'En attente signature', pending_signature: 'En attente signature', viewed: 'Consulté', signed: 'Signé', cancelled: 'Annulé' };
    const bc = { draft: 'badge-expired', pending: 'badge-pending', pending_signature: 'badge-pending', viewed: 'badge-pending', signed: 'badge-paid', cancelled: 'badge-overdue' };
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem">Aucun contrat.</td></tr>'; return; }
    tbody.innerHTML = list.map(c => `<tr>
        <td><strong>${c.contract_number}</strong></td>
        <td>${c.client_name}<br><span style="font-size:0.73rem;color:var(--text-light)">${c.company_name || ''}</span></td>
        <td>${c.title}</td>
        <td style="font-size:0.8rem">${c.mandate_title || c.quote_number || '—'}</td>
        <td><span class="badge ${bc[c.status] || 'badge-expired'}">${sl[c.status] || c.status}</span></td>
        <td style="font-size:0.8rem">${new Date(c.created_at).toLocaleDateString('fr-CA')}</td>
        <td style="font-size:0.8rem;color:var(--success)">${c.signed_at ? new Date(c.signed_at).toLocaleDateString('fr-CA') : '—'}</td>
        <td><div class="td-actions">
            <div style="position:relative;display:inline-block">
                <button class="btn btn-sm btn-outline" onclick="toggleContractMenu(event,${c.id})" title="Actions" style="padding:0.3rem 0.5rem">⋮</button>
                <div id="cmenu-${c.id}" style="display:none;position:absolute;right:0;top:100%;background:white;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:200;min-width:170px;padding:4px 0">
                    <a href="/api/contracts/${c.id}/pdf" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:0.82rem;color:#1E293B;text-decoration:none;cursor:pointer" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Prévisualiser PDF
                    </a>
                    ${c.file_url ? `<a href="${c.file_url}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:0.82rem;color:#1E293B;text-decoration:none" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Fichier joint
                    </a>` : ''}
                    ${c.status !== 'signed' ? `<button onclick="resendSignature(${c.id});toggleContractMenu(event,${c.id})" style="display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:0.82rem;color:#1E293B;background:none;border:none;width:100%;text-align:left;cursor:pointer" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        Renvoyer signature
                    </button>` : ''}
                    ${c.status !== 'signed' ? `<div style="border-top:1px solid #E2E8F0;margin:4px 0"></div>
                    <button onclick="signContract(${c.id});toggleContractMenu(event,${c.id})" style="display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:0.82rem;color:#27AE60;background:none;border:none;width:100%;text-align:left;cursor:pointer" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Marquer signé
                    </button>` : ''}
                </div>
            </div>
        </div></td>
    </tr>`).join('');
}

function filterContracts() { renderContracts(); }

function toggleContractMenu(e, id) {
    e.stopPropagation();
    // Fermer tous les autres menus ouverts
    document.querySelectorAll('[id^="cmenu-"]').forEach(m => { if (m.id !== `cmenu-${id}`) m.style.display = 'none'; });
    const menu = document.getElementById(`cmenu-${id}`);
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
// Fermer les menus en cliquant ailleurs
document.addEventListener('click', () => {
    document.querySelectorAll('[id^="cmenu-"]').forEach(m => m.style.display = 'none');
});
function setContractFilter(f, btn) {
    contractFilter = f;
    btn.closest('.filter-tabs').querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderContracts();
}

async function createContract() {
    const d = await api('/contracts', 'POST', {
        client_id: vv('nct-client'), mandate_id: vv('nct-mandate') || null,
        quote_id: vv('nct-quote') || null, title: vv('nct-title'),
        content: vv('nct-content'), file_url: vv('nct-url')
    });
    if (d.success) { closeModal('modal-new-contract'); loadContracts(); showToast('Contrat créé !', 'success'); }
    else showToast(d.message, 'error');
}

async function signContract(id) {
    showConfirm('Confirmer que ce contrat a été signé ?', async () => {
        const d = await api('/contracts/' + id + '/sign', 'PUT');
        if (d.success) { loadContracts(); showToast('Contrat signé !', 'success'); }
        else showToast(d.message, 'error');
    });
}

// ============================================
// LITIGES
// ============================================
async function loadDisputes() {
    const data = await api('/disputes').catch(() => ({ success: false }));
    if (!data.success) return;
    allDisputes = data.disputes || [];
    const open = allDisputes.filter(d => d.status === 'open' || d.status === 'in_progress').length;
    const b = document.getElementById('badge-disputes');
    if (b) { b.textContent = open; b.style.display = open ? 'inline' : 'none'; }
    renderDisputes();
}

function renderDisputes() {
    const search = (document.getElementById('disputes-search')?.value || '').toLowerCase();
    let list = [...allDisputes];
    if (disputeFilter !== 'all') list = list.filter(d => d.status === disputeFilter);
    if (search) list = list.filter(d => (d.client_name + ' ' + d.title).toLowerCase().includes(search));
    const tbody = document.getElementById('disputes-tbody');
    if (!tbody) return;
    const pColors = { low: 'var(--success)', medium: 'var(--warning)', high: 'var(--error)' };
    const pLabels = { low: 'Faible', medium: 'Moyenne', high: 'Élevée' };
    const sColors = { open: 'badge-overdue', in_progress: 'badge-pending', resolved: 'badge-paid', closed: 'badge-expired' };
    const sLabels = { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' };
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem">Aucun litige.</td></tr>'; return; }
    tbody.innerHTML = list.map(d => `<tr>
        <td><strong>${d.client_name}</strong><br><span style="font-size:0.73rem;color:var(--text-light)">${d.company_name || ''}</span></td>
        <td><div style="font-weight:600">${d.title}</div>${d.resolution ? `<div style="font-size:0.73rem;color:var(--text-light);font-style:italic;margin-top:2px">${d.resolution}</div>` : ''}</td>
        <td><span style="font-size:0.72rem;font-weight:700;color:${pColors[d.priority] || 'var(--text-light)'}">${pLabels[d.priority] || d.priority}</span></td>
        <td><span class="badge ${sColors[d.status] || 'badge-expired'}">${sLabels[d.status] || d.status}</span></td>
        <td style="font-size:0.8rem">${d.invoice_number || '—'}</td>
        <td style="font-size:0.8rem">${new Date(d.opened_at).toLocaleDateString('fr-CA')}</td>
        <td style="font-size:0.8rem;color:var(--success)">${d.resolved_at ? new Date(d.resolved_at).toLocaleDateString('fr-CA') : '—'}</td>
        <td><div class="td-actions">
            ${d.status !== 'resolved' && d.status !== 'closed' ? `<button class="btn btn-sm btn-outline" onclick="openResolveDispute(${d.id})">Traiter</button>` : '<span style="color:var(--success);font-size:0.78rem">✓</span>'}
        </div></td>
    </tr>`).join('');
}

function filterDisputes() { renderDisputes(); }
function setDisputeFilter(f, btn) {
    disputeFilter = f;
    btn.closest('.filter-tabs').querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDisputes();
}

async function createDispute() {
    const d = await api('/disputes', 'POST', {
        client_id: vv('nd2-client'), invoice_id: vv('nd2-invoice') || null,
        mandate_id: vv('nd2-mandate') || null, title: vv('nd2-title'),
        description: vv('nd2-desc'), priority: vv('nd2-priority')
    });
    if (d.success) { closeModal('modal-new-dispute'); loadDisputes(); showToast('Litige ouvert !', 'error'); }
    else showToast(d.message, 'error');
}

function openResolveDispute(id) {
    document.getElementById('rd-id').value = id;
    openModal('modal-resolve-dispute');
}

async function resolveDispute() {
    const id = vv('rd-id');
    const d = await api('/disputes/' + id, 'PUT', { status: vv('rd-status'), resolution: vv('rd-resolution') });
    if (d.success) { closeModal('modal-resolve-dispute'); loadDisputes(); showToast('Litige mis à jour !', 'success'); }
    else showToast(d.message, 'error');
}

// ============================================
// REMBOURSEMENTS
// ============================================
async function loadRefunds() {
    const data = await api('/refunds').catch(() => ({ success: false }));
    if (!data.success) return;
    allRefunds = data.refunds || [];
    renderRefunds();
}

function renderRefunds() {
    const tbody = document.getElementById('refunds-tbody');
    if (!tbody) return;
    const sl = { pending: 'En attente', processed: 'Traité', cancelled: 'Annulé' };
    const bc = { pending: 'badge-pending', processed: 'badge-paid', cancelled: 'badge-overdue' };
    if (!allRefunds.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem">Aucun remboursement.</td></tr>'; return; }
    tbody.innerHTML = allRefunds.map(r => `<tr>
        <td><strong>${r.refund_number}</strong></td>
        <td>${r.client_name}</td>
        <td style="font-size:0.82rem;max-width:200px">${r.reason}</td>
        <td>${fmt(r.amount)}</td>
        <td style="font-weight:700;color:var(--error)">${fmt(r.total_amount)}</td>
        <td><span class="badge ${bc[r.status] || 'badge-expired'}">${sl[r.status] || r.status}</span></td>
        <td style="font-size:0.8rem">${new Date(r.created_at).toLocaleDateString('fr-CA')}</td>
        <td><div class="td-actions">
            ${r.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="processRefund(${r.id})">✓ Confirmer</button>` : '<span style="color:var(--success);font-size:0.78rem">✓</span>'}
        </div></td>
    </tr>`).join('');
}

function calcRefundTaxes() {
    const ht = parseFloat(document.getElementById('nr-amount').value) || 0;
    const tps = ht * 0.05, tvq = ht * 0.09975, ttc = ht + tps + tvq;
    document.getElementById('nr-tax-preview').style.display = ht ? 'block' : 'none';
    document.getElementById('nr-ht').textContent = fmt(ht);
    document.getElementById('nr-tps').textContent = fmt(tps);
    document.getElementById('nr-tvq').textContent = fmt(tvq);
    document.getElementById('nr-ttc').textContent = fmt(ttc);
}

async function createRefund() {
    const d = await api('/refunds', 'POST', {
        client_id: vv('nr-client'), invoice_id: vv('nr-invoice') || null,
        reason: vv('nr-reason'), amount: parseFloat(vv('nr-amount')), notes: vv('nr-notes')
    });
    if (d.success) { closeModal('modal-new-refund'); loadRefunds(); showToast('Remboursement créé !', 'success'); }
    else showToast(d.message, 'error');
}

async function processRefund(id) {
    showConfirm('Confirmer ce remboursement comme traité ?', async () => {
        const d = await api('/refunds/' + id + '/process', 'PUT');
        if (d.success) { loadRefunds(); showToast('Remboursement confirmé !', 'success'); }
        else showToast(d.message, 'error');
    });
}

// ============================================
// DÉPENSES
// ============================================
async function loadExpenses() {
    const data = await api('/expenses').catch(() => ({ success: false }));
    if (!data.success) return;
    allExpenses = data.expenses || [];
    const t = data.totals || {};
    const expTotal = document.getElementById('exp-total');
    const expTps = document.getElementById('exp-tps');
    const expTvq = document.getElementById('exp-tvq');
    if (expTotal) expTotal.textContent = fmt(t.total_ht);
    if (expTps) expTps.textContent = fmt(t.total_tps);
    if (expTvq) expTvq.textContent = fmt(t.total_tvq);
    renderExpenses();
}

function renderExpenses() {
    const search = (document.getElementById('expenses-search')?.value || '').toLowerCase();
    const year = document.getElementById('exp-year-filter')?.value || '';
    let list = [...allExpenses];
    if (search) list = list.filter(e => (e.title + ' ' + (e.vendor || '') + ' ' + (e.category || '')).toLowerCase().includes(search));
    if (year) list = list.filter(e => e.expense_date && e.expense_date.startsWith(year));
    const tbody = document.getElementById('expenses-tbody');
    if (!tbody) return;
    const catLabels = { logiciel: 'Logiciels', materiel: 'Matériel', telecom: 'Télécom', formation: 'Formation', marketing: 'Marketing', transport: 'Transport', bureau: 'Bureau', comptable: 'Comptable/Légal', assurance: 'Assurance', autre: 'Autre' };
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:2rem">Aucune dépense.</td></tr>'; return; }
    tbody.innerHTML = list.map(e => `<tr>
        <td style="font-size:0.82rem">${new Date(e.expense_date).toLocaleDateString('fr-CA')}</td>
        <td><strong>${e.title}</strong>${e.notes ? `<br><span style="font-size:0.73rem;color:var(--text-light)">${e.notes}</span>` : ''}</td>
        <td><span class="badge badge-active" style="background:rgba(46,117,182,0.1);color:var(--secondary)">${catLabels[e.category] || e.category || '—'}</span></td>
        <td style="font-size:0.82rem">${e.vendor || '—'}</td>
        <td style="font-weight:700">${fmt(e.amount)}</td>
        <td style="color:var(--success);font-weight:600">${fmt(e.tps_paid)}</td>
        <td style="color:var(--success);font-weight:600">${fmt(e.tvq_paid)}</td>
        <td><div class="td-actions">
            ${e.receipt_url ? `<a href="${e.receipt_url}" target="_blank" class="btn btn-sm btn-outline">Reçu</a>` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteExpense(${e.id})">Suppr.</button>
        </div></td>
    </tr>`).join('');
}

function filterExpenses() { renderExpenses(); }

async function createExpense() {
    const d = await api('/expenses', 'POST', {
        title: vv('nex-title'), category: vv('nex-category'), amount: parseFloat(vv('nex-amount')),
        tps_paid: parseFloat(vv('nex-tps')) || 0, tvq_paid: parseFloat(vv('nex-tvq')) || 0,
        vendor: vv('nex-vendor'), receipt_url: vv('nex-receipt'),
        expense_date: vv('nex-date'), notes: vv('nex-notes')
    });
    if (d.success) { closeModal('modal-new-expense'); loadExpenses(); showToast('Dépense enregistrée !', 'success'); }
    else showToast(d.message, 'error');
}

async function deleteExpense(id) {
    showConfirm('Supprimer cette dépense ?', async () => {
        const d = await api('/expenses/' + id, 'DELETE');
        if (d.success) { loadExpenses(); showToast('Dépense supprimée.', 'info'); }
        else showToast(d.message, 'error');
    });
}

// ============================================
// DÉCLARATIONS FISCALES
// ============================================
async function loadTaxDecls() {
    const data = await api('/tax-declarations').catch(() => ({ success: false }));
    if (!data.success) return;
    allTaxDecls = data.declarations || [];
    renderTaxDecls();
    renderTaxDeclSummary(data.quarterSummary || []);
}

function renderTaxDeclSummary() {
    const year = new Date().getFullYear();
    const el = document.getElementById('taxdecl-year');
    if (el) el.textContent = year;
    // Calculer depuis les factures payées de l'année
    // Récupérer les invoices depuis le DOM (déjà chargées)
    const tbody = document.getElementById('taxdecl-quarters-tbody');
    if (!tbody) return;
    const qNames = ['T1 (Jan–Mar)', 'T2 (Avr–Jun)', 'T3 (Jul–Sep)', 'T4 (Oct–Déc)'];
    const qDates = [
        { start: `${year}-01-01`, end: `${year}-03-31` },
        { start: `${year}-04-01`, end: `${year}-06-30` },
        { start: `${year}-07-01`, end: `${year}-09-30` },
        { start: `${year}-10-01`, end: `${year}-12-31` }
    ];
    tbody.innerHTML = qNames.map((name, i) => `<tr>
        <td><strong>${year} — ${name}</strong></td>
        <td><span style="font-size:0.78rem;color:var(--text-light)">Calculé depuis factures payées</span></td>
        <td>—</td><td>—</td><td>—</td>
        <td><span class="badge badge-expired">Non calculé</span></td>
        <td><button class="btn btn-sm btn-outline" onclick="quickCreateDecl(${year},${i + 1},'${name}','${qDates[i].start}','${qDates[i].end}')">Générer</button></td>
    </tr>`).join('');
    // Charger les vrais chiffres via API
    fetch('/api/admin/tax-declarations', { headers: authH() })
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const qs = data.quarterSummary || [];
            if (!qs.length) return;
            tbody.innerHTML = qNames.map((name, i) => {
                const q = qs.find(x => parseInt(x.quarter) === (i + 1) && parseInt(x.year) === year) || { revenue_ht: 0, tps: 0, tvq: 0 };
                const total = parseFloat(q.tps || 0) + parseFloat(q.tvq || 0);
                return `<tr>
                    <td><strong>${year} — ${name}</strong></td>
                    <td style="font-weight:700">${fmt(q.revenue_ht || 0)}</td>
                    <td style="color:var(--primary);font-weight:700">${fmt(q.tps || 0)}</td>
                    <td style="color:var(--primary);font-weight:700">${fmt(q.tvq || 0)}</td>
                    <td style="color:var(--primary);font-weight:800">${fmt(total)}</td>
                    <td>${parseFloat(q.revenue_ht || 0) > 0 ? '<span class="badge badge-active">Données dispo</span>' : '<span class="badge badge-expired">Aucune donnée</span>'}</td>
                    <td>${parseFloat(q.revenue_ht || 0) > 0 ? `<button class="btn btn-sm btn-outline" onclick="quickCreateDecl(${year},${i + 1},'${name}','${qDates[i].start}','${qDates[i].end}')">Enregistrer</button>` : '—'}</td>
                </tr>`;
            }).join('');
        }).catch(() => { });
    // Résumé annuel
    fetch('/api/admin/invoices', { headers: authH() })
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const paid = (data.invoices || []).filter(i => i.status === 'paid' && new Date(i.paid_at || 0).getFullYear() === year);
            const ht = paid.reduce((s, i) => s + parseFloat(i.amount_ht || 0), 0);
            const tps = paid.reduce((s, i) => s + parseFloat(i.tps_amount || 0), 0);
            const tvq = paid.reduce((s, i) => s + parseFloat(i.tvq_amount || 0), 0);
            const tdHt = document.getElementById('td-ht');
            const tdTps = document.getElementById('td-tps');
            const tdTvq = document.getElementById('td-tvq');
            const tdTotal = document.getElementById('td-total');
            if (tdHt) tdHt.textContent = fmt(ht);
            if (tdTps) tdTps.textContent = fmt(tps);
            if (tdTvq) tdTvq.textContent = fmt(tvq);
            if (tdTotal) tdTotal.textContent = fmt(tps + tvq);
        }).catch(() => { });
    // Dépenses annuelles
    fetch('/api/admin/expenses', { headers: authH() })
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const t = data.totals || {};
            const tdExp = document.getElementById('td-expenses');
            const tdExpTps = document.getElementById('td-exp-tps');
            const tdExpTvq = document.getElementById('td-exp-tvq');
            if (tdExp) tdExp.textContent = fmt(t.total_ht || 0);
            if (tdExpTps) tdExpTps.textContent = fmt(t.total_tps || 0);
            if (tdExpTvq) tdExpTvq.textContent = fmt(t.total_tvq || 0);
        }).catch(() => { });
}

async function quickCreateDecl(year, quarter, label, start, end) {
    const d = await api('/tax-declarations', 'POST', {
        period_type: 'quarterly', period_label: `T${quarter} ${year} — ${label}`,
        period_start: start, period_end: end, notes: ''
    });
    if (d.success) { loadTaxDecls(); showToast(`Déclaration T${quarter} ${year} enregistrée !`, 'success'); }
    else showToast(d.message, 'error');
}

function renderTaxDecls() {
    const tbody = document.getElementById('taxdecl-tbody');
    if (!tbody) return;
    const sl = { draft: 'Brouillon', submitted: 'Soumise', filed: 'Déposée' };
    const bc = { draft: 'badge-expired', submitted: 'badge-pending', filed: 'badge-paid' };
    if (!allTaxDecls.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-light);padding:2rem">Aucune déclaration enregistrée.</td></tr>'; return; }
    tbody.innerHTML = allTaxDecls.map(d => `<tr>
        <td><strong>${d.period_label}</strong></td>
        <td><span style="font-size:0.78rem">${d.period_type === 'quarterly' ? 'Trimestrielle' : 'Annuelle'}</span></td>
        <td style="font-weight:700">${fmt(d.total_revenue_ht)}</td>
        <td style="color:var(--primary);font-weight:700">${fmt(d.total_tps)}</td>
        <td style="color:var(--primary);font-weight:700">${fmt(d.total_tvq)}</td>
        <td style="color:var(--primary);font-weight:800">${fmt(d.total_taxes)}</td>
        <td><span class="badge ${bc[d.status] || 'badge-expired'}">${sl[d.status] || d.status}</span></td>
        <td style="font-size:0.8rem">${d.submitted_at ? new Date(d.submitted_at).toLocaleDateString('fr-CA') : '—'}</td>
        <td><div class="td-actions">
            ${d.status === 'draft' ? `<button class="btn btn-sm btn-success" onclick="submitDecl(${d.id})">Soumettre</button>` : '<span style="color:var(--success);font-size:0.78rem">✓</span>'}
        </div></td>
    </tr>`).join('');
}

async function createTaxDecl() {
    const d = await api('/tax-declarations', 'POST', {
        period_type: vv('ntd-type'), period_label: vv('ntd-label'),
        period_start: vv('ntd-start'), period_end: vv('ntd-end'), notes: vv('ntd-notes')
    });
    if (d.success) { closeModal('modal-new-taxdecl'); loadTaxDecls(); showToast('Déclaration créée !', 'success'); }
    else showToast(d.message, 'error');
}

async function submitDecl(id) {
    showConfirm('Marquer cette déclaration comme soumise à Revenu Canada/Québec ?', async () => {
        const d = await api('/tax-declarations/' + id + '/submit', 'PUT');
        if (d.success) { loadTaxDecls(); showToast('Déclaration soumise !', 'success'); }
        else showToast(d.message, 'error');
    });
}

// ============================================
// ACTIONS EXISTANTES
// ============================================
async function createClient() {
    const techs = [...document.querySelectorAll('#nc-tech-checkboxes input:checked')].map(i => i.value).join(',');
    const d = await api('/clients', 'POST', {
        full_name: vv('nc-name'), email: vv('nc-email'), password: vv('nc-password'),
        company_name: vv('nc-company'), phone: vv('nc-phone'), address: vv('nc-address'),
        city: vv('nc-city'), province: vv('nc-province'), postal_code: vv('nc-postal'),
        sector: vv('nc-sector'), technologies: techs, internal_notes: vv('nc-notes')
    });
    if (d.success) {
        closeModal('modal-new-client');
        ['nc-name', 'nc-company', 'nc-email', 'nc-phone', 'nc-password', 'nc-address', 'nc-city', 'nc-postal', 'nc-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.querySelectorAll('#nc-tech-checkboxes input').forEach(cb => cb.checked = false);
        loadClients(); showToast('Client créé avec succès !', 'success');
    } else showToast(d.message, 'error');
}

async function createMandate() {
    if (!vv('nm-client') || !vv('nm-title')) { showToast('Client et titre requis', 'error'); return; }
    const d = await api('/mandates', 'POST', {
        client_id: vv('nm-client'), title: vv('nm-title'), description: vv('nm-desc'),
        service_type: vv('nm-type'), status: vv('nm-status'),
        progress: parseInt(vv('nm-progress') || '0'),
        start_date: vv('nm-start') || null, end_date: vv('nm-end') || null, notes: vv('nm-notes')
    });
    if (d.success) { closeModal('modal-new-mandate'); loadMandates(); loadDashboard(); showToast('Mandat créé !', 'success'); }
    else showToast(d.message, 'error');
}

function openEditMandate(id, status, progress, notes) {
    document.getElementById('em-id').value = id;
    document.getElementById('em-status').value = status;
    document.getElementById('em-progress').value = progress;
    const pv = document.getElementById('em-progress-val');
    const pb = document.getElementById('em-progress-bar');
    if (pv) pv.textContent = progress;
    if (pb) pb.style.width = progress + '%';
    document.getElementById('em-notes').value = notes;
    openModal('modal-edit-mandate');
}

async function updateMandate() {
    const d = await api('/mandates/' + vv('em-id'), 'PUT', {
        status: vv('em-status'), progress: parseInt(vv('em-progress')), notes: vv('em-notes')
    });
    if (d.success) { closeModal('modal-edit-mandate'); loadMandates(); loadDashboard(); showToast('Mandat mis à jour !', 'success'); }
    else showToast(d.message, 'error');
}

async function createQuote() {
    const ht = parseFloat(vv('nq-amount'));
    if (!vv('nq-client') || !vv('nq-title') || !ht) { showToast('Remplissez les champs obligatoires', 'error'); return; }
    const d = await api('/quotes', 'POST', {
        client_id: vv('nq-client'), title: vv('nq-title'), description: vv('nq-desc'),
        amount_ht: ht, expiry_days: parseInt(vv('nq-days'))
    });
    if (d.success) { closeModal('modal-new-quote'); loadQuotes(); loadDashboard(); showToast('Devis créé !', 'success'); }
    else showToast(d.message, 'error');
}

async function createInvoice() {
    const ht = parseFloat(vv('ni-amount'));
    if (!vv('ni-client') || !vv('ni-title') || !ht) { showToast('Remplissez les champs obligatoires', 'error'); return; }
    const d = await api('/invoices', 'POST', {
        client_id: vv('ni-client'), title: vv('ni-title'), description: vv('ni-desc'),
        amount_ht: ht, due_days: parseInt(vv('ni-days'))
    });
    if (d.success) { closeModal('modal-new-invoice'); loadInvoices(); loadPayments(); loadDashboard(); showToast('Facture créée !', 'success'); }
    else showToast(d.message, 'error');
}

async function loadClientMandates() {
    const clientId = vv('nd-client');
    const sel = document.getElementById('nd-mandate');
    sel.innerHTML = '<option value="">Aucun</option>';
    if (!clientId) return;
    const data = await api('/mandates?client_id=' + clientId);
    if (data.success) data.mandates.forEach(m => { sel.innerHTML += `<option value="${m.id}">${m.title}</option>`; });
}

async function createDocument() {
    const clientId = vv('nd-client'), title = vv('nd-title'), url = vv('nd-url');
    if (!clientId || !title || !url) { showToast('Client, titre et URL requis', 'error'); return; }
    const d = await api('/documents', 'POST', {
        client_id: clientId, mandate_id: vv('nd-mandate') || null,
        title, description: vv('nd-desc'),
        file_type: vv('nd-type'), file_name: vv('nd-filename') || title, file_url: url
    });
    if (d.success) { closeModal('modal-new-document'); loadDocuments(); showToast('Document déposé !', 'success'); }
    else showToast(d.message, 'error');
}

function markPaid(invoiceId, invoiceNumber, amount) {
    showConfirm(`Confirmer le paiement de la facture <strong>${invoiceNumber}</strong> pour <strong>${amount}</strong> ?`, async () => {
        const d = await api('/invoices/' + invoiceId + '/mark-paid', 'PUT');
        if (d.success) { loadInvoices(); loadPayments(); loadDashboard(); showToast('Facture payée !', 'success'); }
        else showToast(d.message, 'error');
    });
}

function deleteDocument(id, title) {
    showConfirm(`Supprimer définitivement <strong>${title}</strong> ?`, async () => {
        const d = await api('/documents/' + id, 'DELETE');
        if (d.success) { loadDocuments(); showToast('Document supprimé.', 'info'); }
        else showToast(d.message, 'error');
    });
}

// Nouvelle conversation depuis messagerie admin
async function startConversation() {
    const cid = vv('conv-client');
    const content = vv('conv-message');
    if (!cid || !content) { showToast('Client et message requis', 'error'); return; }
    const d = await api('/messages/' + cid, 'POST', { content });
    if (d.success) {
        closeModal('modal-new-conversation');
        document.getElementById('conv-message').value = '';
        await loadMessages();
        showSection('messages');
        showToast('Conversation démarrée !', 'success');
    } else showToast(d.message, 'error');
}

// ---------- Tax calculator ----------
function calcTaxes(p) {
    const ht = parseFloat(document.getElementById(p + '-amount').value) || 0;
    const tps = ht * 0.05, tvq = ht * 0.09975, ttc = ht + tps + tvq;
    document.getElementById(p + '-tax-preview').style.display = ht ? 'block' : 'none';
    document.getElementById(p + '-ht').textContent = fmt(ht);
    document.getElementById(p + '-tps').textContent = fmt(tps);
    document.getElementById(p + '-tvq').textContent = fmt(tvq);
    document.getElementById(p + '-ttc').textContent = fmt(ttc);
}

// ---------- Navigation ----------
function showSection(name) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
    const sec = document.getElementById('section-' + name);
    if (sec) sec.classList.add('active');
    document.querySelectorAll('.sidebar-item').forEach(b => {
        if (b.getAttribute('onclick') === `showSection('${name}')`) b.classList.add('active');
    });
}

// ---------- Modals ----------
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ---------- Helpers ----------
function vv(id) { return document.getElementById(id)?.value || ''; }
function fmt(v) { return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v || 0); }
function initials(n) { return (n || '?').split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase(); }
function statusLabel(s) {
    return { active: 'En cours', pending: 'En attente', completed: 'Complété', paused: 'En pause', paid: 'Payée', unpaid: 'Non payée', accepted: 'Accepté', expired: 'Expiré', declined: 'Refusé', overdue: 'En retard', in_progress: 'En cours', open: 'Ouvert', resolved: 'Résolu', closed: 'Fermé' }[s] || s;
}
function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerHTML = msg;
    t.className = `toast show toast-${type}`;
    clearTimeout(t._to);
    t._to = setTimeout(() => t.classList.remove('show'), 3200);
}