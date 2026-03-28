/* ============================================
   VNK Admin - JavaScript
   ============================================ */

let adminToken = null;
let allClients = [];

// ---------- Show/hide password ----------
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
            body: JSON.stringify({ email: document.getElementById('admin-email').value, password: document.getElementById('admin-password').value })
        });
        const data = await res.json();
        if (data.success && data.token) {
            adminToken = data.token;
            localStorage.setItem('vnk-admin-token', data.token);
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-app').style.display = 'flex';
            loadAllAdmin();
        } else {
            errEl.textContent = data.message || 'Identifiants incorrects.';
            errEl.style.display = 'block';
        }
    } catch { errEl.textContent = 'Erreur de connexion.'; errEl.style.display = 'block'; }
    finally { btn.disabled = false; btn.textContent = 'Accéder au tableau de bord'; }
});

function adminLogout() {
    adminToken = null;
    localStorage.removeItem('vnk-admin-token');
    document.getElementById('admin-login').style.display = 'flex';
    document.getElementById('admin-app').style.display = 'none';
}

window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('vnk-admin-token');
    if (saved) { adminToken = saved; document.getElementById('admin-login').style.display = 'none'; document.getElementById('admin-app').style.display = 'flex'; loadAllAdmin(); }
    const h = new Date().getHours();
    const g = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    document.getElementById('dash-greeting').textContent = `${g}, Yan Verone`;

    // Progress slider sync
    document.getElementById('nm-progress').addEventListener('input', function () {
        document.getElementById('nm-progress-bar').style.width = this.value + '%';
    });
});

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
    await Promise.all([loadDashboard(), loadClients(), loadMandates(), loadQuotes(), loadInvoices(), loadDocuments(), loadMessages(), loadPayments()]);
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
    if (!data.activity?.length) { act.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;padding:0.5rem 0">Aucune activité récente.</p>'; return; }
    act.innerHTML = data.activity.map(a => `
        <div style="display:flex;align-items:center;gap:0.85rem;padding:0.65rem 0;border-bottom:1px solid var(--border)">
            <div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${a.type === 'invoice' ? 'var(--warning)' : a.type === 'quote' ? 'var(--primary)' : 'var(--success)'}"></div>
            <div style="flex:1;min-width:0">
                <div style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.description}</div>
                <div style="font-size:0.75rem;color:var(--text-light)">${a.client_name} · ${new Date(a.date).toLocaleDateString('fr-CA')}</div>
            </div>
            ${a.amount ? `<div style="font-size:0.85rem;font-weight:700;color:var(--primary);white-space:nowrap">${fmt(a.amount)}</div>` : ''}
        </div>`).join('');
}

// ---------- Clients ----------
async function loadClients() {
    const data = await api('/clients');
    if (!data.success) return;
    allClients = data.clients || [];
    const b = document.getElementById('badge-clients');
    b.textContent = allClients.length; b.style.display = allClients.length ? 'inline' : 'none';
    const list = document.getElementById('clients-list');
    if (!allClients.length) { list.innerHTML = '<div class="empty-state"><p>Aucun client.</p></div>'; return; }
    list.innerHTML = allClients.map(c => `
        <div class="client-card">
            <div class="client-avatar">${initials(c.full_name)}</div>
            <div style="flex:1">
                <div class="client-name">${c.full_name} <span class="badge badge-${c.is_active ? 'active' : 'expired'}" style="margin-left:0.5rem">${c.is_active ? 'Actif' : 'Inactif'}</span></div>
                <div class="client-company">${c.company_name || '—'}</div>
                <div class="client-meta">
                    <span>${c.email}</span>
                    ${c.phone ? `<span>${c.phone}</span>` : ''}
                    <span>Depuis ${new Date(c.created_at).toLocaleDateString('fr-CA')}</span>
                    ${c.last_login ? `<span>Dernière connexion : ${new Date(c.last_login).toLocaleDateString('fr-CA')}</span>` : ''}
                </div>
            </div>
        </div>`).join('');
    ['nm-client', 'nq-client', 'ni-client', 'nd-client'].forEach(id => {
        const sel = document.getElementById(id); if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="">Sélectionner un client</option>' + allClients.map(c => `<option value="${c.id}">${c.full_name}${c.company_name ? ' — ' + c.company_name : ''}</option>`).join('');
        if (cur) sel.value = cur;
    });
}

// ---------- Mandates ----------
async function loadMandates() {
    const data = await api('/mandates');
    if (!data.success) return;
    const tbody = document.getElementById('mandates-tbody');
    const svc = { 'plc-support': 'Support PLC', 'audit': 'Audit', 'documentation': 'Documentation', 'refactoring': 'Refactorisation' };
    if (!data.mandates.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:2rem">Aucun mandat.</td></tr>'; return; }
    tbody.innerHTML = data.mandates.map(m => `
        <tr>
            <td><div style="font-weight:600">${m.client_name}</div><div style="font-size:0.75rem;color:var(--text-light)">${m.company_name || ''}</div></td>
            <td><div style="font-weight:600">${m.title}</div>${m.notes ? `<div style="font-size:0.75rem;color:var(--text-light);margin-top:2px">${m.notes.substring(0, 60)}${m.notes.length > 60 ? '…' : ''}</div>` : ''}</td>
            <td>${svc[m.service_type] || m.service_type || '—'}</td>
            <td><span class="badge badge-${m.status}">${statusLabel(m.status)}</span></td>
            <td style="min-width:130px">
                <div style="display:flex;align-items:center;gap:0.5rem">
                    <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${m.progress || 0}%;background:linear-gradient(90deg,var(--primary),var(--secondary));border-radius:3px"></div></div>
                    <span style="font-size:0.75rem;color:var(--text-light);min-width:28px">${m.progress || 0}%</span>
                </div>
            </td>
            <td style="font-size:0.8rem;color:var(--text-light)">${m.start_date ? new Date(m.start_date).toLocaleDateString('fr-CA') : '—'}</td>
            <td><div class="td-actions"><button class="btn btn-sm btn-outline" onclick="openEditMandate(${m.id},'${m.status}',${m.progress || 0},\`${(m.notes || '').replace(/`/g, "'")}\`)">Modifier</button></div></td>
        </tr>`).join('');
}

// ---------- Quotes ----------
async function loadQuotes() {
    const data = await api('/quotes');
    if (!data.success) return;
    const pending = (data.quotes || []).filter(q => q.status === 'pending').length;
    const b = document.getElementById('badge-quotes-admin'); b.textContent = pending; b.style.display = pending ? 'inline' : 'none';
    const tbody = document.getElementById('quotes-tbody');
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
            <td><div class="td-actions"><a href="/api/quotes/${q.id}/pdf" target="_blank" class="btn btn-sm btn-outline">PDF</a></div></td>
        </tr>`).join('');
}

// ---------- Invoices ----------
async function loadInvoices() {
    const data = await api('/invoices');
    if (!data.success) return;
    const unpaid = (data.invoices || []).filter(i => i.status === 'unpaid').length;
    const b = document.getElementById('badge-invoices-admin'); b.textContent = unpaid; b.style.display = unpaid ? 'inline' : 'none';
    const tbody = document.getElementById('invoices-tbody');
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
                ${inv.status === 'unpaid' ? `<button class="btn btn-sm btn-success" onclick="markPaid(${inv.id})">✓ Payée</button>` : ''}
            </div></td>
        </tr>`;
    }).join('');
}

// ---------- Documents ----------
async function loadDocuments() {
    const data = await api('/documents');
    if (!data.success) return;
    const tbody = document.getElementById('documents-tbody');
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
                <button class="btn btn-sm btn-danger" onclick="deleteDocument(${d.id})">Supprimer</button>
            </div></td>
        </tr>`).join('');
}

// ---------- Messages ----------
async function loadMessages() {
    const data = await api('/messages');
    if (!data.success) return;
    const unread = (data.threads || []).reduce((s, t) => s + (t.unread_count || 0), 0);
    const b = document.getElementById('badge-messages-admin'); b.textContent = unread; b.style.display = unread ? 'inline' : 'none';
    const thread = document.getElementById('messages-thread');
    if (!data.threads?.length) { thread.innerHTML = '<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>Aucun message.</p></div>'; return; }
    thread.innerHTML = data.threads.map(t => `
        <div class="msg-client-block">
            <div class="msg-client-header" onclick="toggleMessages(${t.client_id})">
                <div class="msg-client-name">
                    ${t.client_name}
                    <span style="font-weight:400;color:var(--text-light);font-size:0.8rem"> — ${t.company_name || ''}</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.6rem">
                    ${t.unread_count ? `<span class="msg-unread-badge">${t.unread_count} non lu${t.unread_count > 1 ? 's' : ''}</span>` : ''}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </div>
            <div id="msg-${t.client_id}" style="display:none">
                <div class="msg-list" id="msg-list-${t.client_id}">
                    ${(t.messages || []).map(m => `
                        <div class="msg-row msg-row-${m.sender}">
                            <div class="msg-sender-label">${m.sender === 'client' ? t.client_name : 'VNK Automatisation'}</div>
                            <div class="msg-bubble msg-bubble-${m.sender}">${m.content}</div>
                            <div class="msg-time">${new Date(m.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</div>
                        </div>`).join('')}
                </div>
                <div class="msg-compose">
                    <textarea id="reply-${t.client_id}" rows="2" placeholder="Répondre en tant que VNK..."></textarea>
                    <button class="btn btn-primary btn-sm" onclick="sendAdminMessage(${t.client_id})">Envoyer</button>
                </div>
            </div>
        </div>`).join('');
}

function toggleMessages(id) {
    const el = document.getElementById('msg-' + id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') { const l = document.getElementById('msg-list-' + id); if (l) l.scrollTop = l.scrollHeight; }
}

async function sendAdminMessage(clientId) {
    const input = document.getElementById('reply-' + clientId);
    const content = input.value.trim(); if (!content) return;
    const data = await api('/messages/' + clientId, 'POST', { content });
    if (data.success) { input.value = ''; loadMessages(); showToast('Message envoyé', 'success'); }
    else showToast(data.message, 'error');
}

// ---------- Payments ----------
async function loadPayments() {
    const data = await api('/payments');
    if (!data.success) return;
    document.getElementById('p-total-paid').textContent = fmt(data.totalPaid || 0);
    document.getElementById('p-total-unpaid').textContent = fmt(data.totalUnpaid || 0);
    document.getElementById('p-total-invoiced').textContent = fmt(data.totalInvoiced || 0);
    const tbody = document.getElementById('payments-tbody');
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
            <td style="font-size:0.8rem;color:var(--success)">${inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('fr-CA') : '—'}</td>
            <td>${inv.status === 'unpaid' ? `<button class="btn btn-sm btn-success" onclick="markPaid(${inv.id})">✓ Confirmer</button>` : `<span style="color:var(--success);font-size:0.8rem;font-weight:600">✓ Payée</span>`}</td>
        </tr>`;
    }).join('');
}

// ---------- Create / Update ----------
async function createClient() {
    const name = document.getElementById('nc-name').value.trim();
    const email = document.getElementById('nc-email').value.trim();
    const password = document.getElementById('nc-password').value;
    if (!name || !email || !password) { showToast('Remplissez les champs obligatoires', 'error'); return; }
    const data = await api('/clients', 'POST', { full_name: name, email, password, company_name: document.getElementById('nc-company').value, phone: document.getElementById('nc-phone').value });
    if (data.success) { closeModal('modal-new-client'); loadClients(); showToast('Client créé avec succès !', 'success');['nc-name', 'nc-company', 'nc-email', 'nc-phone', 'nc-password'].forEach(id => document.getElementById(id).value = ''); }
    else showToast(data.message, 'error');
}

async function createMandate() {
    const data = await api('/mandates', 'POST', { client_id: document.getElementById('nm-client').value, title: document.getElementById('nm-title').value, description: document.getElementById('nm-desc').value, service_type: document.getElementById('nm-type').value, status: document.getElementById('nm-status').value, progress: parseInt(document.getElementById('nm-progress').value), start_date: document.getElementById('nm-start').value || null, end_date: document.getElementById('nm-end').value || null, notes: document.getElementById('nm-notes').value });
    if (data.success) { closeModal('modal-new-mandate'); loadMandates(); loadDashboard(); showToast('Mandat créé !', 'success'); }
    else showToast(data.message, 'error');
}

function openEditMandate(id, status, progress, notes) {
    document.getElementById('em-id').value = id;
    document.getElementById('em-status').value = status;
    document.getElementById('em-progress').value = progress;
    document.getElementById('em-progress-val').textContent = progress;
    document.getElementById('em-progress-bar').style.width = progress + '%';
    document.getElementById('em-notes').value = notes;
    openModal('modal-edit-mandate');
}

async function updateMandate() {
    const data = await api('/mandates/' + document.getElementById('em-id').value, 'PUT', { status: document.getElementById('em-status').value, progress: parseInt(document.getElementById('em-progress').value), notes: document.getElementById('em-notes').value });
    if (data.success) { closeModal('modal-edit-mandate'); loadMandates(); loadDashboard(); showToast('Mandat mis à jour !', 'success'); }
    else showToast(data.message, 'error');
}

async function createQuote() {
    const ht = parseFloat(document.getElementById('nq-amount').value);
    if (!document.getElementById('nq-client').value || !document.getElementById('nq-title').value || !ht) { showToast('Remplissez les champs obligatoires', 'error'); return; }
    const data = await api('/quotes', 'POST', { client_id: document.getElementById('nq-client').value, title: document.getElementById('nq-title').value, description: document.getElementById('nq-desc').value, amount_ht: ht, expiry_days: parseInt(document.getElementById('nq-days').value) });
    if (data.success) { closeModal('modal-new-quote'); loadQuotes(); loadDashboard(); showToast('Devis créé !', 'success'); }
    else showToast(data.message, 'error');
}

async function createInvoice() {
    const ht = parseFloat(document.getElementById('ni-amount').value);
    if (!document.getElementById('ni-client').value || !document.getElementById('ni-title').value || !ht) { showToast('Remplissez les champs obligatoires', 'error'); return; }
    const data = await api('/invoices', 'POST', { client_id: document.getElementById('ni-client').value, title: document.getElementById('ni-title').value, description: document.getElementById('ni-desc').value, amount_ht: ht, due_days: parseInt(document.getElementById('ni-days').value) });
    if (data.success) { closeModal('modal-new-invoice'); loadInvoices(); loadPayments(); loadDashboard(); showToast('Facture créée !', 'success'); }
    else showToast(data.message, 'error');
}

async function loadClientMandates() {
    const clientId = document.getElementById('nd-client').value;
    const sel = document.getElementById('nd-mandate');
    sel.innerHTML = '<option value="">Aucun</option>';
    if (!clientId) return;
    const data = await api('/mandates?client_id=' + clientId);
    if (data.success) data.mandates.forEach(m => { sel.innerHTML += `<option value="${m.id}">${m.title}</option>`; });
}

async function createDocument() {
    const clientId = document.getElementById('nd-client').value;
    const title = document.getElementById('nd-title').value.trim();
    const url = document.getElementById('nd-url').value.trim();
    if (!clientId || !title || !url) { showToast('Client, titre et URL requis', 'error'); return; }
    const data = await api('/documents', 'POST', { client_id: clientId, mandate_id: document.getElementById('nd-mandate').value || null, title, description: document.getElementById('nd-desc').value, file_type: document.getElementById('nd-type').value, file_name: document.getElementById('nd-filename').value || title, file_url: url });
    if (data.success) { closeModal('modal-new-document'); loadDocuments(); showToast('Document déposé !', 'success'); }
    else showToast(data.message, 'error');
}

async function markPaid(id) {
    if (!confirm('Confirmer le paiement manuel de cette facture ?')) return;
    const data = await api('/invoices/' + id + '/mark-paid', 'PUT');
    if (data.success) { loadInvoices(); loadPayments(); loadDashboard(); showToast('Facture marquée comme payée !', 'success'); }
    else showToast(data.message, 'error');
}

async function deleteDocument(id) {
    if (!confirm('Supprimer ce document définitivement ?')) return;
    const data = await api('/documents/' + id, 'DELETE');
    if (data.success) { loadDocuments(); showToast('Document supprimé.', 'info'); }
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
    document.getElementById('section-' + name).classList.add('active');
    document.querySelectorAll('.sidebar-item').forEach(b => {
        if (b.getAttribute('onclick') === `showSection('${name}')`) b.classList.add('active');
    });
}

// ---------- Modals ----------
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

// ---------- Helpers ----------
function fmt(v) { return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v || 0); }
function initials(n) { return (n || '?').split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase(); }
function statusLabel(s) { return { active: 'En cours', pending: 'En attente', completed: 'Complété', paused: 'En pause', paid: 'Payée', unpaid: 'Non payée', accepted: 'Accepté', expired: 'Expiré', declined: 'Refusé', overdue: 'En retard' }[s] || s; }
function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show toast-${type}`;
    clearTimeout(t._to);
    t._to = setTimeout(() => t.classList.remove('show'), 3200);
}