// @ts-nocheck
/* ============================================
   VNK Automatisation Inc. — Portal JavaScript
   Version complète — Mars 2026
   ============================================ */


// ── Helper anti-flash : ne mettre à jour le DOM que si le contenu a changé ──
function _safeSetHTML(el, html) {
    if (!el) return;
    if (el.innerHTML !== html) {
        el.style.opacity = '0.6';
        el.style.transition = 'opacity 0.15s';
        requestAnimationFrame(() => {
            el.innerHTML = html;
            el.style.opacity = '1';
        });
    }
}

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
    // Vider le mot de passe — le navigateur ne doit pas le mémoriser
    const pwEl = document.getElementById('login-password');
    if (pwEl) pwEl.value = '';
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
    const dash = document.getElementById('dashboard-section');
    dash.style.display = 'grid';

    // Mettre à jour l'UI depuis le localStorage d'abord (rapide)
    _updateSidebarFromUser(JSON.parse(localStorage.getItem('vnk-user') || '{}'));

    // Puis recharger depuis l'API pour avoir les données fraîches + avatar
    _refreshUserFromAPI();

    loadAllData();
    startPolling();

    // Restaurer onglet + état des filtres/recherches
    const savedTab = (window.VNKState ? window.VNKState.get('tab') : null) || localStorage.getItem('vnk-portal-tab');
    if (savedTab && savedTab !== 'dashboard') showTab(savedTab);
}

async function _refreshUserFromAPI() {
    const token = localStorage.getItem('vnk-token');
    if (!token) return;
    try {
        const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) return;
        const d = await r.json();
        if (d.success && d.user) {
            // Fusionner avec le localStorage
            const existing = JSON.parse(localStorage.getItem('vnk-user') || '{}');
            const merged = { ...existing, ...d.user };
            localStorage.setItem('vnk-user', JSON.stringify(merged));
            _updateSidebarFromUser(merged);
        }
    } catch { }
}

function _updateSidebarFromUser(user) {
    const name = user.name || user.full_name || 'VNK';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const el = (id) => document.getElementById(id);

    // Avatar — image si disponible, sinon initiales
    const avatarEl = el('sidebar-avatar');
    if (avatarEl) {
        if (user.avatar_url) {
            avatarEl.style.padding = '0';
            avatarEl.style.overflow = 'hidden';
            avatarEl.innerHTML = `<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${name}">`;
        } else {
            avatarEl.style.padding = '';
            avatarEl.innerHTML = initials;
        }
    }
    if (el('sidebar-name')) el('sidebar-name').textContent = name;
    if (el('sidebar-company')) el('sidebar-company').textContent = user.company || user.company_name || '';
    if (el('mobile-avatar')) {
        const mobileAvatar = el('mobile-avatar');
        if (user.avatar_url) {
            mobileAvatar.style.padding = '0';
            mobileAvatar.style.overflow = 'hidden';
            mobileAvatar.innerHTML = `<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${name}">`;
        } else {
            mobileAvatar.innerHTML = initials;
        }
    }
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    if (el('dashboard-greeting')) el('dashboard-greeting').textContent = greeting + ', ' + name.split(' ')[0] + ' !';
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
    // Helper : ne rerender que si les données ont changé
    function _hasChanged(newArr, oldArr, key) {
        if (!newArr || !oldArr) return true;
        if (newArr.length !== oldArr.length) return true;
        // Comparer id + status + is_read + updated_at pour détecter tout changement
        const sig = arr => JSON.stringify(arr.map(x => [x[key], x.status || '', x.is_read || '', x.updated_at || '', x.progress || ''].join('|')));
        return sig(newArr) !== sig(oldArr);
    }
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
            // Toujours mettre à jour les badges — showBadge gère le masquage si count=0
            showBadge('badge-quotes', dash.pendingQuotes || 0);
            showBadge('badge-invoices', dash.pendingInvoices || 0);
            showBadge('badge-mandates', dash.activeMandates || 0);
            showBadge('badge-contracts', dash.pendingContracts || 0);
            showBadge('badge-documents', dash.unreadDocuments || 0);
            renderActivity(dash.recentActivity || []);
        }
        if (quotes) {
            const _newQuotes = quotes.quotes || [];
            window._allQuotes = _newQuotes; filterQuotes(); // Respecte le filtre actif
            const pendingQuotes = window._allQuotes.filter(q => q.status === 'pending');
            showBadge('badge-quotes', pendingQuotes.length);
        } else {
            const qlist = el('quotes-list');
            if (qlist) qlist.innerHTML = '<div style="padding:1rem;background:#FEF3C7;border-radius:8px;border-left:3px solid #D97706;font-size:0.85rem;color:#92400E"><strong>Session expirée.</strong> <a href="#" onclick="logout()" style="color:#92400E">Reconnectez-vous</a> pour voir vos devis.</div>';
        }
        if (invoices) {
            const _newInvoices = invoices.invoices || [];
            window._allInvoices = _newInvoices; filterInvoices(); // Respecte le filtre actif
            const unpaid = window._allInvoices.filter(i => i.status === 'unpaid' || i.status === 'overdue').length;
            showBadge('badge-invoices', unpaid);
        }
        if (docs) {
            const docsArr = docs.documents || [];
            const _newAllDocs = _buildDocumentsList(docsArr, window._allInvoices || [], window._allContracts || [], window._allQuotes || []);
            window._allDocuments = _newAllDocs; renderDocuments(window._allDocuments);
            // Utiliser is_read de la DB — plus fiable que localStorage
            // Compter seulement les vrais docs DB non lus (pas les synthétiques)
            const unreadDocs = docsArr.filter(d => d.is_read === false || d.is_read === null);
            showBadge('badge-documents', unreadDocs.length);
            // Notifier si nouveaux documents
            if (unreadDocs.length > 0) {
                unreadDocs.forEach(d => {
                    if (typeof pushPortalNotif === 'function') {
                        pushPortalNotif('document', 'Nouveau document : ' + d.title, 'documents');
                    }
                });
            }
        }
        if (mandates) {
            const mArr = mandates.mandates || [];
            window._allMandates = mArr; filterMandates();
            const activeMandates = mArr.filter(m => m.status === 'active' || m.status === 'in_progress').length;
            showBadge('badge-mandates', activeMandates);
        }
        if (contracts) {
            const _newContracts = contracts.contracts || [];
            window._allContracts = _newContracts; filterContracts(); // Respecte le filtre actif
            const pending = window._allContracts.filter(c => c.status === 'pending_signature' || c.status === 'pending' || c.status === 'draft').length;
            showBadge('badge-contracts', pending);
        }
        if (messages) {
            const msgs = messages.messages || [];
            // Utiliser last-seen-id (comme chat-widget.js) — is_read en DB n'est plus fiable
            const lastSeenId = parseInt(localStorage.getItem('vnk-chat-last-seen-id') || '0');
            const unread = msgs.filter(m => m.sender === 'vnk' && m.id > lastSeenId).length;
            const prevUnread = parseInt(el('stat-messages')?.textContent || '0');
            if (el('stat-messages')) el('stat-messages').textContent = unread;
            if (typeof vnkChatNotify === 'function') vnkChatNotify(msgs, unread);
            // Notification si nouveau message VNK (id plus grand que ce qu'on connaissait)
            if (unread > prevUnread) {
                const lastVnk = msgs.filter(m => m.sender === 'vnk' && m.id > lastSeenId).pop();
                if (typeof vnkNotif !== 'undefined') vnkNotif.newMessage('VNK Automatisation', lastVnk?.content?.substring(0, 80));
                if (typeof pushPortalNotif === 'function') pushPortalNotif('message',
                    'Nouveau message de VNK' + (lastVnk ? ' : ' + lastVnk.content.substring(0, 60) + (lastVnk.content.length > 60 ? '…' : '') : ''),
                    null
                );
            }
        }

        // Mettre à jour le panel "Actions requises"
        _updateActionsRequired();

        // Mettre à jour l'avatar sidebar seulement (pas toute la page profil)
        await _refreshUserFromAPI();
    } catch (error) { console.log('Data loading error:', error); }
}


/* ═══════════════════════════════════════════
   PAGINATION — système universel
   Affiche 25 items par page sur tous les onglets
═══════════════════════════════════════════ */
const PAGE_SIZE = 10;
const _PAGE_SIZE = PAGE_SIZE;
const _pageState = { quotes: 1, invoices: 1, mandates: 1, contracts: 1, documents: 1 };

function _paginate(arr, tab) {
    const page = _pageState[tab] || 1;
    const total = arr.length;
    const pages = Math.ceil(total / PAGE_SIZE);
    const slice = arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return { slice, page, pages, total };
}

function _renderPager(tab, pages, page, total, containerEl) {
    if (!containerEl) return;
    // Trouver ou créer un div de pagination séparé — ne jamais vider le container principal
    const pagerId = 'pager-' + tab;
    let pager = document.getElementById(pagerId);
    if (!pager) {
        pager = document.createElement('div');
        pager.id = pagerId;
        containerEl.parentNode?.insertBefore(pager, containerEl.nextSibling);
    }
    if (pages <= 1) { pager.innerHTML = ''; return; }
    const from = (page - 1) * _PAGE_SIZE + 1;
    const to = Math.min(page * _PAGE_SIZE, total);

    // Max 3 numéros : prev, current, next + ... aux extrêmes
    let numBtns = '';
    const showFirst = page > 2;
    const showLast = page < pages - 1;
    if (showFirst) {
        numBtns += '<button onclick="_goPage(\'' + tab + '\',1)" style="' + _pagerBtn(false) + '">1</button>';
        if (page > 3) numBtns += '<span style="padding:0 4px;color:#94A3B8;font-size:0.8rem">…</span>';
    }
    for (let p = Math.max(1, page - 1); p <= Math.min(pages, page + 1); p++) {
        numBtns += '<button onclick="_goPage(\'' + tab + '\',' + p + ')" style="' + _pagerBtn(p === page) + '">' + p + '</button>';
    }
    if (showLast) {
        if (page < pages - 2) numBtns += '<span style="padding:0 4px;color:#94A3B8;font-size:0.8rem">…</span>';
        numBtns += '<button onclick="_goPage(\'' + tab + '\',' + pages + ')" style="' + _pagerBtn(false) + '">' + pages + '</button>';
    }

    pager.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid #E2E8F0';
    pager.innerHTML = '<span style="font-size:0.75rem;color:#94A3B8">' + from + '–' + to + ' sur ' + total + '</span>'
        + '<div style="display:flex;align-items:center;gap:0.25rem">'
        + '<button onclick="_goPage(\'' + tab + '\',' + (page - 1) + ')" ' + (page <= 1 ? 'disabled' : '') + ' style="' + _pagerBtn(false) + '">&lsaquo;</button>'
        + numBtns
        + '<button onclick="_goPage(\'' + tab + '\',' + (page + 1) + ')" ' + (page >= pages ? 'disabled' : '') + ' style="' + _pagerBtn(false) + '">&rsaquo;</button>'
        + '</div>';
}


function _pagerBtn(active) {
    return 'min-width:32px;height:32px;border:1.5px solid ' + (active ? '#1B4F8A' : '#E2E8F0')
        + ';background:' + (active ? '#1B4F8A' : 'white')
        + ';color:' + (active ? 'white' : '#475569')
        + ';border-radius:6px;cursor:' + (active ? 'default' : 'pointer')
        + ';font-size:0.8rem;font-weight:600;font-family:inherit';
}

function _goPage(tab, page) {
    if (page < 1) return;
    _pageState[tab] = page;
    window.scrollTo(0, 100);
    if (tab === 'invoices_history') { _pageState.invoices_history = page; filterInvoices(); return; }
    if (tab === 'quotes') filterQuotes();
    else if (tab === 'invoices') filterInvoices();
    else if (tab === 'mandates') filterMandates();
    else if (tab === 'contracts') filterContracts();
    else if (tab === 'documents') filterDocuments();
}

/* ─────────────────────────────────────────────
   ACTIONS REQUISES — panel droit
   Agrège les items urgents de tous les onglets
───────────────────────────────────────────── */
function _updateActionsRequired() {
    const container = document.getElementById('portal-actions-required');
    if (!container) return;

    const items = [];

    // Devis en attente d'acceptation
    (window._allQuotes || [])
        .filter(q => q.status === 'pending')
        .forEach(q => {
            items.push({
                label: 'Devis',
                labelColor: '#D97706',
                bgColor: '#FEF3C7',
                borderColor: '#F59E0B',
                title: q.quote_number + ' — ' + q.title,
                btnText: 'Accepter',
                btnColor: '#D97706',
                action: 'acceptQuote(' + q.id + ')'
            });
        });

    // Factures en retard ou impayées
    (window._allInvoices || [])
        .filter(i => i.status === 'unpaid' || i.status === 'overdue')
        .forEach(i => {
            const isOverdue = i.status === 'overdue';
            items.push({
                label: isOverdue ? 'En retard' : 'Facture',
                labelColor: isOverdue ? '#DC2626' : '#D97706',
                bgColor: isOverdue ? '#FEF2F2' : '#FEF3C7',
                borderColor: isOverdue ? '#EF4444' : '#F59E0B',
                title: i.invoice_number + ' — ' + formatCurrency(i.amount_ttc),
                btnText: 'Payer',
                btnColor: isOverdue ? '#DC2626' : '#D97706',
                action: 'payInvoice(' + i.id + ',' + i.amount_ttc + ')'
            });
        });

    // Contrats en attente de signature
    (window._allContracts || [])
        .filter(c => c.status === 'pending' || c.status === 'pending_signature')
        .forEach(c => {
            items.push({
                label: 'Signature requise',
                labelColor: '#7C3AED',
                bgColor: '#F5F3FF',
                borderColor: '#8B5CF6',
                title: c.contract_number + ' — ' + c.title,
                btnText: 'Signer',
                btnColor: '#7C3AED',
                action: 'signContract(' + c.id + ',' + JSON.stringify(c.hellosign_request_id || '') + ',' + JSON.stringify(c.file_url || '') + ')'
            });
        });

    if (!items.length) {
        container.innerHTML = '<div class="portal-action-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Tout est à jour</div>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div style="background:${item.bgColor};border:1px solid ${item.borderColor};border-left:3px solid ${item.labelColor};border-radius:8px;padding:0.75rem;margin-bottom:0.6rem">
            <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${item.labelColor};margin-bottom:0.25rem">${item.label}</div>
            <div style="font-size:0.82rem;font-weight:600;color:#1E293B;margin-bottom:0.5rem;line-height:1.4">${item.title}</div>
            <button onclick="${item.action}" style="display:flex;align-items:center;justify-content:center;gap:0.35rem;width:100%;padding:0.4rem;border:none;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;background:${item.btnColor};color:white;font-family:inherit">${item.btnText}</button>
        </div>
    `).join('');
}

// ═══════════════════════════════════════════════════════════
// WEBSOCKET + POLLING HYBRIDE
// WS si dispo, sinon polling 10s actif / 60s arrière-plan
// ═══════════════════════════════════════════════════════════
let _pollingInterval = null;
let _pollingActive = false;
let _wsPortal = null;
let _wsReconnectTimer = null;
let _wsReconnectDelay = 2000;
let _wsPingInterval = null;
const WS_MAX_RECONNECT = 30000;

function startPolling() {
    if (_pollingActive) return;
    _pollingActive = true;
    _connectPortalWS();
    // Démarrer le polling fallback immédiatement en parallèle
    // Si WS réussit, le polling sera plus espacé
    _fallbackPoll();
    document.addEventListener('visibilitychange', _onPortalTabVisible);
    // Init notifications au démarrage
    setTimeout(() => { _updatePortalBellDot(); renderPortalNotifPanel(); }, 300);
}

function stopPolling() {
    _pollingActive = false;
    document.removeEventListener('visibilitychange', _onPortalTabVisible);
    _disconnectPortalWS();
    if (_pollingInterval) { clearTimeout(_pollingInterval); _pollingInterval = null; }
}

function _connectPortalWS() {
    if (!_pollingActive) return;
    const token = localStorage.getItem('vnk-token');
    if (!token) { _fallbackPoll(); return; }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try { _wsPortal = new WebSocket(proto + '//' + location.host + '/ws'); } catch (e) { _fallbackPoll(); return; }

    _wsPortal.onopen = () => {
        _wsReconnectDelay = 2000;
        _wsPortal.send(JSON.stringify({ type: 'auth', token }));
        clearInterval(_wsPingInterval);
        _wsPingInterval = setInterval(() => {
            if (_wsPortal && _wsPortal.readyState === WebSocket.OPEN)
                _wsPortal.send(JSON.stringify({ type: 'ping' }));
        }, 25000);
        loadAllData();
    };
    _wsPortal.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === 'pong' || msg.type === 'authenticated') return;
        if (msg.type === 'event') _handlePortalWsEvent(msg.event, msg.data || {});
    };
    _wsPortal.onclose = () => {
        clearInterval(_wsPingInterval);
        if (_pollingActive) {
            // Si délai max atteint → fallback polling HTTP
            if (_wsReconnectDelay >= WS_MAX_RECONNECT) {
                _fallbackPoll();
            } else {
                _schedulePortalReconnect();
            }
        }
    };
    _wsPortal.onerror = () => { clearInterval(_wsPingInterval); _fallbackPoll(); };
}

function _disconnectPortalWS() {
    clearInterval(_wsPingInterval); clearTimeout(_wsReconnectTimer);
    if (_wsPortal) { _wsPortal.onclose = null; _wsPortal.close(); _wsPortal = null; }
}

function _schedulePortalReconnect() {
    if (!_pollingActive) return;
    _wsReconnectTimer = setTimeout(() => {
        _wsReconnectDelay = Math.min(_wsReconnectDelay * 2, WS_MAX_RECONNECT);
        _connectPortalWS();
    }, _wsReconnectDelay);
}

function _fallbackPoll() {
    if (!_pollingActive) return;
    async function _poll() {
        if (!_pollingActive) return;
        await loadAllData();
        _pollingInterval = setTimeout(_poll, document.hidden ? 30000 : 5000);
    }
    _pollingInterval = setTimeout(_poll, 2000); // Premier poll rapide
}

async function _onPortalTabVisible() {
    if (!document.hidden && _pollingActive) {
        if (_wsPortal && _wsPortal.readyState === WebSocket.OPEN) { await loadAllData(); }
        else if (!_wsPortal || _wsPortal.readyState === WebSocket.CLOSED) { clearTimeout(_wsReconnectTimer); _connectPortalWS(); }
    }
}

function _handlePortalWsEvent(event, data) {
    const fmtCA = (v) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v) || 0);
    switch (event) {
        case 'new_message_vnk':
            loadAllData();
            pushPortalNotif('message', 'Nouveau message de VNK' + (data.content ? ' : ' + data.content.substring(0, 60) + (data.content.length > 60 ? '…' : '') : ''), null);
            if (typeof vnkNotif !== 'undefined') vnkNotif.sound();
            break;
        case 'new_quote':
            loadAllData();
            pushPortalNotif('quote', 'Nouveau devis disponible' + (data.title ? ' — ' + data.title : '') + ' à accepter', 'quotes');
            showDot('dot-quotes', true); break;
        case 'quote_accepted':
            loadAllData();
            pushPortalNotif('contract', 'Devis accepté — Contrat ' + (data.contract_number || '') + ' généré', 'contracts');
            showDot('dot-contracts', true); break;
        case 'new_invoice':
            loadAllData();
            pushPortalNotif('invoice', 'Nouvelle facture' + (data.invoice_number ? ' ' + data.invoice_number : '') + (data.amount_ttc ? ' — ' + fmtCA(data.amount_ttc) : '') + ' à régler', 'invoices');
            showDot('dot-invoices', true);
            if (typeof vnkNotif !== 'undefined') vnkNotif.sound();
            break;
        case 'invoice_paid':
            loadAllData();
            pushPortalNotif('payment', 'Paiement confirmé' + (data.invoice_number ? ' — Facture ' + data.invoice_number : ''), 'invoices');
            showDot('dot-invoices', false); break;
        case 'contract_signed':
            loadAllData();
            pushPortalNotif('contract', 'Contrat' + (data.contract && data.contract.contract_number ? ' ' + data.contract.contract_number : '') + ' signé — disponible dans vos documents', 'contracts');
            showDot('dot-contracts', true);
            if (data.auto_invoice) { pushPortalNotif('invoice', 'Facture ' + data.auto_invoice.invoice_number + ' générée', 'invoices'); showDot('dot-invoices', true); if (typeof vnkNotif !== 'undefined') vnkNotif.sound(); }
            break;
        case 'mandate_updated': case 'mandate_created':
            loadAllData();
            if (data.status === 'completed') pushPortalNotif('mandate', 'Mandat « ' + (data.title || '') + ' » terminé', 'mandates');
            else if (event === 'mandate_created') { pushPortalNotif('mandate', 'Nouveau mandat : « ' + (data.title || '') + ' »', 'mandates'); showDot('dot-mandates', true); }
            break;
        default: loadAllData();
    }
}

function showDot(id, active) { const d = document.getElementById(id); if (d) d.style.display = active ? 'block' : 'none'; }

// ═══════════════════════════════════════════════════════════
// SYSTÈME NOTIFICATIONS PORTAIL
// ═══════════════════════════════════════════════════════════
const PORTAL_NOTIF_KEY = 'vnk-portal-notifs';
function _loadPortalNotifs() { try { return JSON.parse(localStorage.getItem(PORTAL_NOTIF_KEY) || '[]'); } catch { return []; } }
function _savePortalNotifs(list) { localStorage.setItem(PORTAL_NOTIF_KEY, JSON.stringify(list.slice(0, 40))); }

const PORTAL_NOTIF_CFG = {
    message: { bg: '#EBF3FA', icon: '#1B4F8A', svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    quote: { bg: '#FEF3C7', icon: '#D97706', svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
    contract: { bg: '#EDE9FE', icon: '#7C3AED', svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>' },
    invoice: { bg: '#FEE2E2', icon: '#DC2626', svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>' },
    payment: { bg: '#D1FAE5', icon: '#059669', svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' },
    mandate: { bg: '#E0F2FE', icon: '#0284C7', svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    system: { bg: '#F1F5F9', icon: '#64748B', svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/></svg>' },
};

function pushPortalNotif(type, text, tab) {
    const list = _loadPortalNotifs();
    if (list.find(n => n.text === text && (Date.now() - new Date(n.ts).getTime()) < 30000)) return;
    list.unshift({ id: Date.now(), type, text, tab: tab || null, read: false, ts: new Date().toISOString() });
    _savePortalNotifs(list);
    renderPortalNotifPanel();
    _updatePortalBellDot();
    if (typeof vnkNotif !== 'undefined') vnkNotif.sound();
}

function _relTime(iso) {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60000) return "À l'instant";
    if (d < 3600000) return Math.floor(d / 60000) + ' min';
    if (d < 86400000) return Math.floor(d / 3600000) + ' h';
    return Math.floor(d / 86400000) + ' j';
}

function renderPortalNotifPanel() {
    const container = document.getElementById('portal-notif-list');
    const empty = document.getElementById('portal-notif-empty');
    if (!container) return;
    Array.from(container.children).forEach(c => { if (c.id !== 'portal-notif-empty') c.remove(); });
    const list = _loadPortalNotifs();
    if (!list.length) { if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';
    list.forEach(n => {
        const cfg = PORTAL_NOTIF_CFG[n.type] || PORTAL_NOTIF_CFG.system;
        const el = document.createElement('div');
        el.className = 'portal-notif-item' + (n.read ? '' : ' unread');
        el.innerHTML = '<div class="portal-notif-icon" style="background:' + cfg.bg + ';color:' + cfg.icon + '">' + cfg.svg + '</div>'
            + '<div class="portal-notif-body"><div class="portal-notif-text">' + n.text + '</div><div class="portal-notif-time">' + _relTime(n.ts) + '</div></div>'
            + (!n.read ? '<div class="portal-notif-unread-dot"></div>' : '');
        el.onclick = () => {
            const all = _loadPortalNotifs(); const idx = all.findIndex(x => x.id === n.id);
            if (idx !== -1) { all[idx].read = true; _savePortalNotifs(all); }
            el.classList.remove('unread'); const dot = el.querySelector('.portal-notif-unread-dot'); if (dot) dot.remove();
            _updatePortalBellDot();
            if (n.tab) { closePortalNotifPanel(); showTab(n.tab); }
        };
        container.appendChild(el);
    });
}

function _updatePortalBellDot() {
    const unread = _loadPortalNotifs().filter(n => !n.read).length;
    const dot = document.getElementById('portal-notif-bell-dot');
    if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
}

function togglePortalNotifPanel() {
    const panel = document.getElementById('portal-notif-panel');
    if (!panel) return;
    if (panel.classList.contains('open')) closePortalNotifPanel();
    else { panel.classList.add('open'); renderPortalNotifPanel(); }
}
function closePortalNotifPanel() { const p = document.getElementById('portal-notif-panel'); if (p) p.classList.remove('open'); }
function markAllPortalNotifsRead() { _savePortalNotifs(_loadPortalNotifs().map(n => ({ ...n, read: true }))); renderPortalNotifPanel(); _updatePortalBellDot(); }
function clearAllPortalNotifs() { _savePortalNotifs([]); renderPortalNotifPanel(); _updatePortalBellDot(); }

document.addEventListener('click', (e) => {
    const panel = document.getElementById('portal-notif-panel');
    const btn = document.querySelector('.portal-notif-btn');
    if (panel && panel.classList.contains('open') && !panel.contains(e.target) && btn && !btn.contains(e.target)) closePortalNotifPanel();
});

/* ─────────────────────────────────────────────
   refreshPortal — bouton Actualiser fonctionnel
   Anime le bouton, recharge les données, retire l'animation
───────────────────────────────────────────── */
async function refreshPortal(btn) {
    if (!btn || btn.classList.contains('loading')) return;
    btn.classList.add('loading');
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin-refresh 0.8s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.36"/></svg> Actualisation...';
    try {
        await loadAllData();
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> À jour';
        btn.style.color = '#16A34A';
    } finally {
        setTimeout(() => {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            btn.style.color = '';
        }, 1200);
    }
}

/* ─────────────────────────────────────────────
   showTab — gère les headers gelés + panel droit
───────────────────────────────────────────── */
function showTab(tabName) {
    // 1. Switcher les contenus
    document.querySelectorAll('.portal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.portal-nav-item').forEach(n => n.classList.remove('active'));

    const tab = document.getElementById('tab-' + tabName);
    if (tab) tab.classList.add('active');

    document.querySelectorAll('.portal-nav-item').forEach(btn => {
        if (btn.getAttribute('onclick') === "showTab('" + tabName + "')") btn.classList.add('active');
    });

    // 2. Switcher les headers gelés
    document.querySelectorAll('.portal-tab-header').forEach(h => h.style.display = 'none');
    const activeHeader = document.getElementById('header-' + tabName);
    if (activeHeader) activeHeader.style.display = 'block';

    // 3. Panel actions rapides — visible seulement sur dashboard
    // On cache aussi la colonne de grille pour éviter le vide blanc
    const actionPanel = document.getElementById('portal-action-panel');
    const dashboardGrid = document.getElementById('dashboard-section');
    if (actionPanel) {
        if (tabName === 'dashboard') {
            actionPanel.style.display = 'flex';
            if (dashboardGrid) dashboardGrid.style.gridTemplateColumns = '240px 1fr 320px';
        } else {
            actionPanel.style.display = 'none';
            if (dashboardGrid) dashboardGrid.style.gridTemplateColumns = '240px 1fr';
        }
    }

    // 4. Fermer sidebar mobile
    const sidebar = document.querySelector('.portal-sidebar');
    const overlay = document.getElementById('portal-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');

    // 5. Titre mobile
    const titles = {
        profile: 'Mon profil',
        dashboard: 'Tableau de bord',
        mandates: 'Mes mandats',
        quotes: 'Mes devis',
        invoices: 'Mes factures',
        contracts: 'Mes contrats',
        documents: 'Mes documents'
    };
    const mobileTitle = document.getElementById('mobile-tab-title');
    if (mobileTitle) mobileTitle.textContent = titles[tabName] || '';

    // 6. Persister l'onglet
    localStorage.setItem('vnk-portal-tab', tabName);

    // 7. Charger le profil quand on l'ouvre — données fraîches
    if (tabName === 'profile') {
        renderProfile(JSON.parse(localStorage.getItem('vnk-user') || '{}'));
        _refreshUserFromAPI().then(() => {
            renderProfile(JSON.parse(localStorage.getItem('vnk-user') || '{}'));
        });
    }

    // 8. Documents — afficher seulement, ne PAS marquer lu automatiquement
    // Les docs sont marqués lus uniquement quand le client clique sur prévisualiser/télécharger
    if (tabName === 'documents') {
        if (window._allDocuments?.length) renderDocuments(window._allDocuments);
    }

    // 8. Remonter en haut du contenu
    const content = document.querySelector('.portal-main-content');
    if (content) content.scrollTop = 0;
}

function showBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) {
        if (count && count > 0) { badge.style.display = 'inline-block'; badge.textContent = count; }
        else { badge.style.display = 'none'; badge.textContent = '0'; }
    }
    // Sync dot
    const dotId = id.replace('badge-', 'dot-');
    if (typeof showDot === 'function') showDot(dotId, count > 0);
}

function renderProfile(user) {
    const el = document.getElementById('profile-content');
    if (!el) return;
    const name = user.name || user.full_name || '—';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatarSrc = user.avatar_url;

    el.innerHTML = `
        <div style="max-width:680px;margin:0 auto">

            <!-- AVATAR + NOM -->
            <div style="background:white;border-radius:16px;border:1px solid #E2E8F0;padding:2rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:1.5rem">
                <div style="position:relative;flex-shrink:0">
                    <div id="profile-avatar-preview" style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#1B4F8A,#2E75B6);display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;color:white;border:3px solid #E2E8F0">
                        ${avatarSrc ? '<img src="' + avatarSrc + '" style="width:100%;height:100%;object-fit:cover" alt="' + name + '">' : initials}
                    </div>
                    <label for="avatar-upload" style="position:absolute;bottom:0;right:0;width:26px;height:26px;background:#1B4F8A;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid white" title="Changer l'avatar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        <input type="file" id="avatar-upload" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
                    </label>
                </div>
                <div style="flex:1">
                    <div style="font-size:1.15rem;font-weight:800;color:#0F172A;margin-bottom:0.15rem">${name}</div>
                    <div style="font-size:0.875rem;color:#64748B;margin-bottom:0.75rem">${user.email || ''}</div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        ${(user.company || user.company_name) ? '<span style="background:#EBF5FB;color:#1B4F8A;font-size:0.75rem;font-weight:600;padding:3px 10px;border-radius:20px">' + (user.company || user.company_name) + '</span>' : ''}
                        ${user.sector ? '<span style="background:#F0FDF4;color:#16A34A;font-size:0.75rem;font-weight:600;padding:3px 10px;border-radius:20px">' + user.sector + '</span>' : ''}
                    </div>
                </div>
                <span id="avatar-upload-status" style="font-size:0.78rem;color:#27AE60;display:none;margin-left:auto">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Sauvegardé
                </span>
            </div>

            <!-- INFORMATIONS — mode lecture -->
            <div id="profile-info-view" style="background:white;border-radius:16px;border:1px solid #E2E8F0;padding:1.5rem;margin-bottom:1.25rem">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
                    <h3 style="font-size:0.8rem;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:.05em">Informations du compte</h3>
                    <button onclick="showProfileEdit()" style="font-size:0.8rem;color:#1B4F8A;background:none;border:none;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;transition:background 0.15s" onmouseenter="this.style.background='#EBF5FB'" onmouseleave="this.style.background='none'">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Modifier mes informations
                    </button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
                    ${_profileRow('Nom complet', name)}
                    ${_profileRow('Courriel', user.email)}
                    ${_profileRow('Entreprise', user.company || user.company_name)}
                    ${_profileRow('Téléphone', user.phone)}
                    ${_profileRow('Adresse', user.address)}
                    ${_profileRow('Ville', user.city ? user.city + (user.province ? ', ' + user.province : '') + (user.postal_code ? '  ' + user.postal_code : '') : null)}
                    ${_profileRow('Secteur', user.sector)}
                    ${_profileRow('Technologies', user.technologies)}
                    ${_profileRow('Membre depuis', user.created_at ? new Date(user.created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null)}
                </div>
            </div>

            <!-- INFORMATIONS — mode édition (caché par défaut) -->
            <div id="profile-info-edit" style="display:none;background:white;border-radius:16px;border:2px solid #1B4F8A;padding:1.5rem;margin-bottom:1.25rem">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
                    <h3 style="font-size:0.8rem;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:.05em">Modifier mes informations</h3>
                    <button onclick="hideProfileEdit()" style="font-size:0.8rem;color:#64748B;background:none;border:none;cursor:pointer;font-weight:600;padding:4px 8px;border-radius:6px" onmouseenter="this.style.background='#F1F5F9'" onmouseleave="this.style.background='none'">Annuler</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
                    ${_editField('edit-fname', 'Prénom', (name.split(' ')[0] || ''), 'text')}
                    ${_editField('edit-lname', 'Nom de famille', (name.split(' ').slice(1).join(' ') || ''), 'text')}
                    ${_editField('edit-phone', 'Téléphone', user.phone || '', 'tel')}
                    ${_editField('edit-address', 'Adresse', user.address || '', 'text')}
                    ${_editField('edit-city', 'Ville', user.city || '', 'text')}
                    ${_editField('edit-province', 'Province', user.province || 'QC', 'text')}
                    ${_editField('edit-postal', 'Code postal', user.postal_code || '', 'text')}
                </div>
                <div id="profile-edit-msg" style="font-size:0.8rem;margin-bottom:0.75rem;display:none"></div>
                <div style="display:flex;gap:0.75rem">
                    <button onclick="saveProfileInfo()" style="padding:0.55rem 1.5rem;background:linear-gradient(135deg,#1B4F8A,#2E75B6);color:white;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit">Enregistrer les modifications</button>
                    <button onclick="hideProfileEdit()" style="padding:0.55rem 1rem;background:#F1F5F9;color:#64748B;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button>
                </div>
            </div>

            <!-- MOT DE PASSE — mode lecture -->
            <div id="profile-pw-view" style="background:white;border-radius:16px;border:1px solid #E2E8F0;padding:1.5rem">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <div>
                        <h3 style="font-size:0.8rem;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.25rem">Mot de passe</h3>
                        <p style="font-size:0.82rem;color:#94A3B8">Dernière modification : inconnue</p>
                    </div>
                    <button onclick="showPasswordEdit()" style="font-size:0.8rem;color:#1B4F8A;background:none;border:none;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;transition:background 0.15s" onmouseenter="this.style.background='#EBF5FB'" onmouseleave="this.style.background='none'">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Modifier mon mot de passe
                    </button>
                </div>
            </div>

            <!-- MOT DE PASSE — mode édition (caché par défaut) -->
            <div id="profile-pw-edit" style="display:none;background:white;border-radius:16px;border:2px solid #1B4F8A;padding:1.5rem;margin-top:0">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
                    <h3 style="font-size:0.8rem;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:.05em">Modifier le mot de passe</h3>
                    <button onclick="hidePasswordEdit()" style="font-size:0.8rem;color:#64748B;background:none;border:none;cursor:pointer;font-weight:600;padding:4px 8px;border-radius:6px" onmouseenter="this.style.background='#F1F5F9'" onmouseleave="this.style.background='none'">Annuler</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;align-items:end;margin-bottom:1rem">
                    ${_editField('pw-current', 'Mot de passe actuel', '', 'password')}
                    ${_editField('pw-new', 'Nouveau mot de passe', '', 'password')}
                    ${_editField('pw-confirm', 'Confirmer', '', 'password')}
                </div>
                <div id="pw-msg" style="font-size:0.8rem;margin-bottom:0.75rem;display:none"></div>
                <div style="display:flex;gap:0.75rem">
                    <button onclick="changePassword()" style="padding:0.55rem 1.5rem;background:linear-gradient(135deg,#1B4F8A,#2E75B6);color:white;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit">Changer le mot de passe</button>
                    <button onclick="hidePasswordEdit()" style="padding:0.55rem 1rem;background:#F1F5F9;color:#64748B;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button>
                </div>
            </div>
        </div>`;
}

function _profileRow(label, value) {
    if (!value) return '';
    return `<div style="background:#F8FAFC;border-radius:8px;padding:0.65rem 0.85rem">
        <div style="font-size:0.7rem;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${label}</div>
        <div style="font-size:0.875rem;font-weight:600;color:#1E293B">${value}</div>
    </div>`;
}

function _editField(id, label, value, type) {
    return `<div>
        <label style="font-size:0.78rem;color:#64748B;display:block;margin-bottom:4px;font-weight:500">${label}</label>
        <input id="${id}" type="${type}" value="${value}" style="width:100%;padding:0.55rem 0.75rem;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.875rem;box-sizing:border-box;font-family:inherit;outline:none;transition:border-color 0.15s" onfocus="this.style.borderColor='#1B4F8A'" onblur="this.style.borderColor='#E2E8F0'">
    </div>`;
}

function showProfileEdit() {
    document.getElementById('profile-info-view').style.display = 'none';
    document.getElementById('profile-info-edit').style.display = 'block';
    document.getElementById('profile-info-edit').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hideProfileEdit() {
    document.getElementById('profile-info-edit').style.display = 'none';
    document.getElementById('profile-info-view').style.display = 'block';
}
function showPasswordEdit() {
    document.getElementById('profile-pw-view').style.display = 'none';
    document.getElementById('profile-pw-edit').style.display = 'block';
    document.getElementById('profile-pw-edit').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hidePasswordEdit() {
    document.getElementById('profile-pw-edit').style.display = 'none';
    document.getElementById('profile-pw-view').style.display = 'block';
}

async function saveProfileInfo() {
    const token = localStorage.getItem('vnk-token');
    if (!token) return;
    const fname = document.getElementById('edit-fname')?.value.trim() || '';
    const lname = document.getElementById('edit-lname')?.value.trim() || '';
    const fullName = (fname + ' ' + lname).trim();
    const payload = {
        full_name: fullName || undefined,
        phone: document.getElementById('edit-phone')?.value.trim() || undefined,
        address: document.getElementById('edit-address')?.value.trim() || undefined,
        city: document.getElementById('edit-city')?.value.trim() || undefined,
        province: document.getElementById('edit-province')?.value.trim() || undefined,
        postal_code: document.getElementById('edit-postal')?.value.trim() || undefined,
    };
    const msg = document.getElementById('profile-edit-msg');
    if (msg) { msg.style.display = 'block'; msg.style.color = '#64748B'; msg.textContent = 'Enregistrement...'; }
    try {
        const r = await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (d.success) {
            const merged = { ...JSON.parse(localStorage.getItem('vnk-user') || '{}'), ...d.user };
            if (fullName) merged.name = fullName;
            localStorage.setItem('vnk-user', JSON.stringify(merged));
            _updateSidebarFromUser(merged);
            if (msg) { msg.style.color = '#16A34A'; msg.textContent = 'Modifications enregistrées !'; }
            setTimeout(() => { hideProfileEdit(); renderProfile(merged); }, 1200);
        } else {
            if (msg) { msg.style.color = '#DC2626'; msg.textContent = d.message || 'Erreur'; }
        }
    } catch {
        if (msg) { msg.style.color = '#DC2626'; msg.textContent = 'Erreur réseau'; }
    }
}


async function uploadAvatar(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const token = localStorage.getItem('vnk-token');
    if (!token) return;

    // Redimensionner et encoder en base64
    const reader = new FileReader();
    reader.onload = async (e) => {
        // Créer canvas pour redimensionner à 200x200
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const size = 200;
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            // Centrer et rogner en carré
            const scale = Math.max(size / img.width, size / img.height);
            const x = (size - img.width * scale) / 2;
            const y = (size - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            const b64 = canvas.toDataURL('image/jpeg', 0.85);

            // Aperçu immédiat
            const preview = document.getElementById('profile-avatar-preview');
            if (preview) preview.innerHTML = `<img src="${b64}" style="width:100%;height:100%;object-fit:cover" alt="avatar">`;
            _updateSidebarFromUser({ ...JSON.parse(localStorage.getItem('vnk-user') || '{}'), avatar_url: b64 });

            try {
                const r = await fetch('/api/auth/update-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                    body: JSON.stringify({ avatar_url: b64 })
                });
                const d = await r.json();
                if (d.success) {
                    const merged = { ...JSON.parse(localStorage.getItem('vnk-user') || '{}'), ...d.user, avatar_url: b64 };
                    localStorage.setItem('vnk-user', JSON.stringify(merged));
                    const status = document.getElementById('avatar-upload-status');
                    if (status) { status.style.display = 'block'; setTimeout(() => status.style.display = 'none', 3000); }
                }
            } catch { }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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
        if (d.success) { msg.textContent = 'Mot de passe changé.'; msg.style.color = '#27AE60';['pw-current', 'pw-new', 'pw-confirm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
        else { msg.textContent = d.message || 'Erreur.'; msg.style.color = '#E74C3C'; }
    } catch { msg.textContent = 'Erreur de connexion.'; msg.style.color = '#E74C3C'; }
}

function renderActivity(activities) {
    const list = document.getElementById('activity-list');
    if (!list) return;
    if (!activities.length) { list.innerHTML = '<p class="portal-empty">Aucune activité récente.</p>'; return; }
    const icons = {
        invoice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
        quote: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E07820" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        mandate: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
    };
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

function filterMandates() {
    const search = (document.getElementById('mandate-search')?.value || '').toLowerCase();
    const status = document.getElementById('mandate-filter')?.value || 'all';
    let list = window._allMandates || [];
    if (status !== 'all') list = list.filter(m => m.status === status);
    if (search) { list = list.filter(m => ((m.title || '') + ' ' + (m.description || '')).toLowerCase().includes(search)); _pageState.mandates = 1; }
    window._filteredMandates = list;
    const { slice, page, pages, total } = _paginate(list, 'mandates');
    renderMandates(slice);
    let mPager = document.getElementById('pager-mandates');
    if (!mPager) {
        mPager = document.createElement('div');
        mPager.id = 'pager-mandates';
        const mList = document.getElementById('mandates-list');
        if (mList) mList.parentNode?.insertBefore(mPager, mList.nextSibling);
    }
    _renderPager('mandates', pages, page, total, mPager);
}



function _vnkShowNote(btn) {
    const note = btn.getAttribute('data-note') || btn.dataset.note || '';
    const ex = document.getElementById('vnk-note-modal');
    if (ex) ex.remove();
    const m = document.createElement('div');
    m.id = 'vnk-note-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,18,35,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem';
    m.innerHTML = '<div style="background:white;border-radius:14px;padding:1.5rem;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '<span style="font-size:0.9rem;font-weight:700;color:#0F2D52">Note de VNK</span>' +
        '</div>' +
        '<button onclick="document.getElementById(\'vnk-note-modal\').remove()" style="background:#F1F5F9;border:none;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:1rem;color:#64748B">×</button>' +
        '</div>' +
        '<p style="font-size:0.88rem;color:#334155;line-height:1.6;margin:0 0 1.25rem">' + note + '</p>' +
        '<button onclick="document.getElementById(\'vnk-note-modal\').remove()" style="width:100%;padding:0.6rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer">Fermer</button>' +
        '</div>';
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
}

function _vnkTableStyles() {
    if (document.getElementById('vnk-table-styles')) return '';
    const s = document.createElement('style');
    s.id = 'vnk-table-styles';
    s.textContent = [
        '.vnk-table{width:100%;border-collapse:collapse;font-size:0.82rem}',
        '.vnk-table thead tr{border-bottom:1.5px solid #E2E8F0}',
        '.vnk-table thead th{padding:7px 10px;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;text-align:left;white-space:nowrap}',
        '.vnk-table thead th.right{text-align:right}',
        '.vnk-table tbody tr{border-bottom:0.5px solid #F1F5F9;transition:background 0.1s}',
        '.vnk-table tbody tr:hover{background:#F8FAFF}',
        '.vnk-table tbody tr:last-child{border-bottom:none}',
        '.vnk-table td{padding:8px 10px;color:#1E293B;vertical-align:middle}',
        '.vnk-table td.num{font-weight:700;color:#1B4F8A;white-space:nowrap;min-width:115px}',
        '.vnk-table td.title{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.vnk-table td.date{color:#94A3B8;white-space:nowrap;font-size:0.77rem}',
        '.vnk-table td.amount{text-align:right;font-weight:700;white-space:nowrap}',
        '.vnk-table td.actions{text-align:right;white-space:nowrap}',
        '.vnk-badge{display:inline-block;font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap}',
        '.vnk-action-btn{background:white;border:1px solid #E2E8F0;border-radius:6px;padding:3px 9px;font-size:0.75rem;font-weight:600;cursor:pointer;color:#64748B;font-family:inherit;margin-left:3px}',
        '.vnk-action-btn:hover{border-color:#1B4F8A;color:#1B4F8A}',
        '.vnk-action-btn.primary{background:#1B4F8A;color:white;border-color:#1B4F8A}',
        '.vnk-action-btn.primary:hover{background:#164070}',
        '.vnk-section-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:0.75rem;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;cursor:pointer;user-select:none}',
        '.vnk-section-header:hover{background:#F1F5F9}',
        '.vnk-progress-bar{height:4px;background:#E2E8F0;border-radius:2px;margin-top:4px;overflow:hidden}',
        '.vnk-progress-fill{height:100%;background:#1B4F8A;border-radius:2px}',
        '.vnk-table-wrap{border:1px solid #E2E8F0;border-radius:10px;overflow:hidden}',
        '.vnk-empty{padding:3rem 1rem;text-align:center;color:#94A3B8;font-size:0.85rem}'
    ].join('');
    document.head.appendChild(s);
    return '';
}

function renderMandates(mandates) {
    const list = document.getElementById('mandates-list');
    if (!list) return;
    if (!mandates || !mandates.length) {
        list.innerHTML = _vnkTableStyles() + '<div class="vnk-empty">Aucun mandat actif pour l\'instant.</div>';
        return;
    }
    const stl = { active: 'En cours', in_progress: 'En cours', pending: 'En attente', completed: 'Complété', paused: 'En pause' };
    const stc = { active: '#27AE60', in_progress: '#27AE60', pending: '#D97706', completed: '#1B4F8A', paused: '#94A3B8' };
    const svl = { 'plc-support': 'Support PLC', audit: 'Audit technique', documentation: 'Documentation', refactoring: 'Refactorisation' };
    const rows = mandates.map(m => {
        const color = stc[m.status] || '#94A3B8';
        const label = stl[m.status] || m.status;
        const prog = m.progress || 0;
        return `<tr>
            <td class="num">${m.mandate_number || ('MND-' + m.id)}</td>
            <td class="title">
                <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.title}</div>
                ${m.service_type ? '<div style="font-size:0.72rem;color:#94A3B8;margin-top:1px">' + (svl[m.service_type] || m.service_type) + '</div>' : ''}
            </td>
            <td class="date">${new Date(m.start_date || m.created_at).toLocaleDateString('fr-CA')}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;min-width:120px">
                    <div class="vnk-progress-bar" style="flex:1"><div class="vnk-progress-fill" style="width:${prog}%"></div></div>
                    <span style="font-size:0.72rem;font-weight:700;color:#1B4F8A;min-width:30px">${prog}%</span>
                </div>
            </td>
            <td style="text-align:center"><span class="vnk-badge" style="background:${color}18;color:${color}">${label}</span></td>
            <td class="actions">${m.notes ? (function (note) { return '<button class="vnk-action-btn" onclick="_vnkShowNote(this)" data-note="' + note.replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '" title="Note VNK">Note</button>' })(m.notes) : ''}</td>
        </tr>`;
    }).join('');
    const mHead = '<thead><tr><th>Numéro</th><th>Mandat</th><th>Début</th><th>Progression</th><th style="text-align:center">Statut</th><th></th></tr></thead>';
    list.innerHTML = _vnkTableStyles() + '<div class="vnk-table-wrap"><table class="vnk-table">' + mHead + '<tbody>' + rows + '</tbody></table></div>';
}




/* ─────────────────────────────────────────────
   PAGINATION — affiche N items par page
───────────────────────────────────────────── */

function _renderPagination(containerId, totalItems, currentPage, onPageChange) {
    const totalPages = Math.ceil(totalItems / _PAGE_SIZE);
    if (totalPages <= 1) return '';
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
            pages.push(p);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }
    return `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:1rem;padding-top:0.75rem;border-top:1px solid #E2E8F0">
        <span style="font-size:0.78rem;color:#94A3B8">${totalItems} élément${totalItems > 1 ? 's' : ''}</span>
        <div style="display:flex;gap:0.25rem;align-items:center">
            <button onclick="${onPageChange}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} 
                style="padding:4px 10px;border:1.5px solid ${currentPage <= 1 ? '#E2E8F0' : '#1B4F8A'};border-radius:6px;background:white;color:${currentPage <= 1 ? '#CBD5E0' : '#1B4F8A'};cursor:${currentPage <= 1 ? 'default' : 'pointer'};font-size:0.8rem;font-weight:600;font-family:inherit">
                Préc.
            </button>
            ${pages.map(p => p === '...'
        ? '<span style="padding:4px 6px;color:#94A3B8">…</span>'
        : '<button onclick="' + onPageChange + '(' + p + ')" style="padding:4px 10px;border:1.5px solid ' + (p === currentPage ? '#1B4F8A' : '#E2E8F0') + ';border-radius:6px;background:' + (p === currentPage ? '#1B4F8A' : 'white') + ';color:' + (p === currentPage ? 'white' : '#64748B') + ';cursor:pointer;font-size:0.8rem;font-weight:600;font-family:inherit">' + p + '</button>'
    ).join('')}
            <button onclick="${onPageChange}(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}
                style="padding:4px 10px;border:1.5px solid ${currentPage >= totalPages ? '#E2E8F0' : '#1B4F8A'};border-radius:6px;background:white;color:${currentPage >= totalPages ? '#CBD5E0' : '#1B4F8A'};cursor:${currentPage >= totalPages ? 'default' : 'pointer'};font-size:0.8rem;font-weight:600;font-family:inherit">
                Suiv.
            </button>
        </div>
    </div>`;
}

// Pages courantes par onglet
let _pageQuotes = 1, _pageInvoices = 1, _pageMandates = 1, _pageContracts = 1, _pageDocuments = 1;
function _goPageQuotes(p) { _pageQuotes = p; renderQuotes(window._allQuotes || []); }
function _goPageInvoices(p) { _pageInvoices = p; renderInvoices(window._allInvoices || []); }
function _goPageMandates(p) { _pageMandates = p; renderMandates(window._allMandates || []); }
function _goPageContracts(p) { _pageContracts = p; renderPortalContracts(window._allContracts || []); }
function _goPageDocuments(p) { _pageDocuments = p; renderDocuments(window._allDocuments || []); }

function renderQuotes(quotes) {
    const list = document.getElementById('quotes-list');
    if (!list) return;
    if (!quotes || !quotes.length) {
        list.innerHTML = _vnkTableStyles() + '<div class="vnk-empty">Aucun devis disponible.</div>';
        return;
    }
    const sc = { pending: '#D97706', accepted: '#27AE60', expired: '#E74C3C', draft: '#94A3B8', cancelled: '#94A3B8' };
    const sl = { pending: 'En attente', accepted: 'Accepté', expired: 'Expiré', draft: 'Brouillon', cancelled: 'Annulé' };
    const actives = quotes.filter(q => q.status === 'pending' || q.status === 'draft');
    const archived = quotes.filter(q => q.status !== 'pending' && q.status !== 'draft');

    const makeRows = arr => arr.map(q => {
        const color = sc[q.status] || '#94A3B8';
        const isPending = q.status === 'pending';
        return '<tr>' +
            '<td class="num">' + q.quote_number + '</td>' +
            '<td class="title">' + (q.title || '—') + '</td>' +
            '<td class="date">' + new Date(q.created_at).toLocaleDateString('fr-CA') + '</td>' +
            '<td class="date">' + (q.expiry_date ? new Date(q.expiry_date).toLocaleDateString('fr-CA') : '—') + '</td>' +
            '<td style="text-align:center"><span class="vnk-badge" style="background:' + color + '18;color:' + color + '">' + (sl[q.status] || q.status) + '</span></td>' +
            '<td class="amount">' + formatCurrency(q.amount_ttc) + '</td>' +
            '<td class="actions">' +
            '<button class="vnk-action-btn" onclick="downloadPDF(\'quotes\',' + q.id + ',\'' + q.quote_number + '\')">PDF</button>' +
            (isPending ? ' <button class="vnk-action-btn primary" onclick="acceptQuote(' + q.id + ')">Accepter</button>' : '') +
            '</td></tr>';
    }).join('');

    const thead = '<thead><tr><th>Numéro</th><th>Titre</th><th>Émis</th><th>Expire</th><th style="text-align:center">Statut</th><th class="right">Montant TTC</th><th></th></tr></thead>';
    const isOpen = true; // Toujours ouvert
    let html = _vnkTableStyles() + '<div class="vnk-table-wrap">';

    if (actives.length) {
        html += '<table class="vnk-table">' + thead + '<tbody>' + makeRows(actives) + '</tbody></table>';
    }

    if (archived.length) {
        html += '<div class="vnk-section-header" onclick="(function(el){const b=el.nextElementSibling;const open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';localStorage.setItem(\'vnk-quotes-arch-open\',open?\'0\':\'1\');el.querySelector(\'svg\').style.transform=open?\'rotate(0deg)\':\'rotate(180deg)\';})(this)">' +
            '<span>Archivés (' + archived.length + ')</span>' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;transform:' + (isOpen ? 'rotate(180deg)' : 'rotate(0deg)') + '"><polyline points="6 9 12 15 18 9"/></svg>' +
            '</div>' +
            '<div style="display:' + (isOpen ? 'block' : 'none') + '">' +
            '<table class="vnk-table">' + thead + '<tbody>' + makeRows(archived) + '</tbody></table>' +
            '</div>';
    }

    html += '</div>';
    list.innerHTML = html;
}


function filterQuotes() {
    const search = (document.getElementById('quote-search')?.value || '').toLowerCase();
    const status = document.getElementById('quote-filter')?.value || 'all';
    let list = window._allQuotes || [];
    if (status !== 'all') list = list.filter(q => q.status === status);
    if (search) { list = list.filter(q => ((q.quote_number || '') + ' ' + (q.title || '')).toLowerCase().includes(search)); _pageState.quotes = 1; }
    list = _applySort(list, _sortState.quotes || 'date-desc', 'amount_ttc');
    window._filteredQuotes = list;
    const { slice, page, pages, total } = _paginate(list, 'quotes');
    renderQuotes(slice);
    let qPager = document.getElementById('pager-quotes');
    if (!qPager) {
        qPager = document.createElement('div');
        qPager.id = 'pager-quotes';
        const qList = document.getElementById('quotes-list');
        if (qList) qList.parentNode?.insertBefore(qPager, qList.nextSibling);
    }
    _renderPager('quotes', pages, page, total, qPager);
}

function renderInvoices(invoices) {
    const list = document.getElementById('invoices-list');
    if (!list) return;
    if (!invoices.length) { list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg><p>Aucune facture disponible.</p></div>'; return; }
    const sl = { unpaid: 'Non payée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' };
    const sc = { unpaid: '#D97706', paid: '#27AE60', overdue: '#E74C3C', cancelled: '#94A3B8' };
    const renderI = inv => {
        const color = sc[inv.status] || '#94A3B8';
        const isPaid = inv.status === 'paid';
        const isOverdue = inv.status === 'overdue';
        return '<div class="portal-list-item" style="' + (isPaid ? 'border-left:3px solid #27AE60' : isOverdue ? 'border-left:3px solid #E74C3C' : '') + '">' +
            '<div style="flex:1">' +
            '<div class="portal-item-title">' + inv.invoice_number + ' — ' + inv.title + '</div>' +
            (inv.description ? '<div class="portal-item-desc">' + inv.description + '</div>' : '') +
            '<div class="portal-item-meta">' +
            '<span>Émise : ' + new Date(inv.created_at).toLocaleDateString('fr-CA') + '</span>' +
            (inv.due_date ? '<span>Échéance : <strong style="color:' + (isOverdue ? '#E74C3C' : 'inherit') + '">' + new Date(inv.due_date).toLocaleDateString('fr-CA') + '</strong></span>' : '') +
            (inv.paid_at ? '<span style="color:#27AE60">Payée le : ' + new Date(inv.paid_at).toLocaleDateString('fr-CA') + '</span>' : '') +
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
    };

    const actives = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled');
    const historique = invoices.filter(i => i.status === 'paid' || i.status === 'cancelled');
    let html = '';

    if (actives.length) {
        html += actives.map(renderI).join('');
    } else {
        html += '<div style="padding:1rem;font-size:0.85rem;color:#94A3B8;text-align:center;background:#F8FAFC;border-radius:8px">Aucune facture en attente</div>';
    }

    if (historique.length) {
        const isOpen = localStorage.getItem('vnk-invoices-history-open') === '1';
        html += '<div style="margin-top:1.25rem;border-top:1.5px solid #E2E8F0;padding-top:1rem">' +
            '<button id="vnk-history-toggle" onclick="_toggleInvoiceHistory()" style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;font-weight:600;color:#64748B;background:none;border:none;cursor:pointer;padding:0;margin-bottom:0.75rem">' +
            '<svg id="vnk-history-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;transform:' + (isOpen ? 'rotate(180deg)' : 'rotate(0deg)') + '"><polyline points="6 9 12 15 18 9"/></svg>' +
            'Historique — payées (' + historique.length + ')' +
            '</button>' +
            '<div id="vnk-history-body" style="display:' + (isOpen ? 'block' : 'none') + ';opacity:0.8">' +
            historique.map(renderI).join('') +
            '</div></div>';
    }

    list.innerHTML = html;
}

function _toggleInvoiceHistory() {
    const body = document.getElementById('vnk-history-body');
    const chevron = document.getElementById('vnk-history-chevron');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    localStorage.setItem('vnk-invoices-history-open', isOpen ? '0' : '1');
}

function filterInvoices() {
    const search = (document.getElementById('invoice-search')?.value || '').toLowerCase();
    const status = document.getElementById('invoice-filter')?.value || 'all';
    let list = window._allInvoices || [];
    if (status !== 'all') list = list.filter(i => i.status === status);
    if (search) { list = list.filter(i => ((i.invoice_number || '') + ' ' + (i.title || '')).toLowerCase().includes(search)); _pageState.invoices = 1; _pageState.invoices_history = 1; }
    list = _applySort(list, _sortState.invoices || 'date-desc', 'amount_ttc');
    window._filteredInvoices = list;

    const actives = list.filter(i => i.status !== 'paid' && i.status !== 'cancelled');
    const historique = list.filter(i => i.status === 'paid' || i.status === 'cancelled');

    if (!('invoices_history' in _pageState)) _pageState.invoices_history = 1;

    const { slice: activeSlice, page: aPage, pages: aPages, total: aTotal } = _paginate(actives, 'invoices');
    const hPage = _pageState.invoices_history || 1;
    const hPages = Math.ceil(historique.length / PAGE_SIZE);
    const histSlice = historique.slice((hPage - 1) * PAGE_SIZE, hPage * PAGE_SIZE);

    renderInvoicesV2(activeSlice, histSlice, aPage, aPages, aTotal, hPage, hPages, historique.length);
}

function _buildPagerHtml(tab, pages, page, total, from, to) {
    if (pages <= 1) return '';
    let btns = '';
    if (page > 2) btns += '<button onclick="_goPage(\'' + tab + '\',1)" style="' + _pagerBtn(false) + '">1</button>';
    if (page > 3) btns += '<span style="padding:0 4px;color:#94A3B8;font-size:0.8rem">…</span>';
    for (let p = Math.max(1, page - 1); p <= Math.min(pages, page + 1); p++) {
        btns += '<button onclick="_goPage(\'' + tab + '\',' + p + ')" style="' + _pagerBtn(p === page) + '">' + p + '</button>';
    }
    if (page < pages - 2) btns += '<span style="padding:0 4px;color:#94A3B8;font-size:0.8rem">…</span>';
    if (page < pages - 1) btns += '<button onclick="_goPage(\'' + tab + '\',' + pages + ')" style="' + _pagerBtn(false) + '">' + pages + '</button>';
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid #E2E8F0">' +
        '<span style="font-size:0.75rem;color:#94A3B8">' + from + '–' + to + ' sur ' + total + '</span>' +
        '<div style="display:flex;align-items:center;gap:0.25rem">' +
        '<button onclick="_goPage(\'' + tab + '\',' + (page - 1) + ')" ' + (page <= 1 ? 'disabled' : '') + ' style="' + _pagerBtn(false) + '">&lsaquo;</button>' +
        btns +
        '<button onclick="_goPage(\'' + tab + '\',' + (page + 1) + ')" ' + (page >= pages ? 'disabled' : '') + ' style="' + _pagerBtn(false) + '">&rsaquo;</button>' +
        '</div></div>';
}

function renderInvoicesV2(actives, historique, aPage, aPages, aTotal, hPage, hPages, hTotal) {
    const list = document.getElementById('invoices-list');
    if (!list) return;
    const sl = { unpaid: 'Non payée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' };
    const sc = { unpaid: '#D97706', paid: '#27AE60', overdue: '#E74C3C', cancelled: '#94A3B8' };
    const makeRows = arr => arr.map(inv => {
        const color = sc[inv.status] || '#94A3B8';
        const isPaid = inv.status === 'paid';
        const isOverdue = inv.status === 'overdue';
        return `<tr>
            <td class="num">${inv.invoice_number}</td>
            <td class="title">${inv.title || '—'}</td>
            <td class="date">${new Date(inv.created_at).toLocaleDateString('fr-CA')}</td>
            <td class="date" style="color:${isOverdue ? '#E74C3C' : '#94A3B8'}">${inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-CA') : '—'}</td>
            <td style="text-align:center"><span class="vnk-badge" style="background:${color}18;color:${color}">${sl[inv.status] || inv.status}</span></td>
            <td class="amount" style="color:${isPaid ? '#27AE60' : 'inherit'}">${formatCurrency(inv.amount_ttc)}</td>
            <td class="actions">
                <button class="vnk-action-btn" onclick="downloadPDF('invoices',${inv.id},'${inv.invoice_number}')">PDF</button>
                ${!isPaid ? ' <button class="vnk-action-btn primary" onclick="payInvoice(' + inv.id + ',' + inv.amount_ttc + ')">Payer</button>' : ''}
            </td>
        </tr>`;
    }).join('');
    const isOpen = true; // Toujours ouvert
    const thead = '<thead><tr><th>Numéro</th><th>Titre</th><th>Émise</th><th>Échéance</th><th style="text-align:center">Statut</th><th class="right">Montant TTC</th><th></th></tr></thead>';
    let html = _vnkTableStyles() + '<div class="vnk-table-wrap"><table class="vnk-table">' + thead + '<tbody>';
    if (actives.length) {
        html += makeRows(actives);
        if (aPages > 1) html += '<tr><td colspan="7" style="padding:4px 10px">' + _buildPagerHtml('invoices', aPages, aPage, aTotal, (aPage - 1) * PAGE_SIZE + 1, Math.min(aPage * PAGE_SIZE, aTotal)) + '</td></tr>';
        html += '</tbody></table>';
    } else if (!hTotal) {
        list.innerHTML = _vnkTableStyles() + '<div class="vnk-empty">Aucune facture disponible.</div>';
        return;
    } else {
        html = _vnkTableStyles() + '<div class="vnk-table-wrap">';
    }
    if (hTotal > 0) {
        html += `<div class="vnk-section-header" onclick="const b=document.getElementById('inv-hist');const open=b.style.display!=='none';b.style.display=open?'none':'block';localStorage.setItem('vnk-inv-hist-open',open?'0':'1');this.querySelector('svg').style.transform=open?'rotate(0)':'rotate(180deg)'">
            <span>Historique — payées (${hTotal})</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;transform:${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div id="inv-hist" style="display:${isOpen ? 'block' : 'none'}">
        <table class="vnk-table">${thead}<tbody>${makeRows(historique)}${hPages > 1 ? '<tr><td colspan="7" style="padding:4px 10px">' + _buildPagerHtml('invoices_history', hPages, hPage, hTotal, (hPage - 1) * PAGE_SIZE + 1, Math.min(hPage * PAGE_SIZE, hTotal)) + '</td></tr>' : ''}</tbody></table></div>`;
    }
    html += '</div>';
    list.innerHTML = html;
}



// ── Ouvrir un PDF protégé avec le token d'auth ──
function _openPdfWithAuth(contractId, download) {
    const token = localStorage.getItem('vnk-token');
    fetch('/api/contracts/' + contractId + '/pdf', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => {
            if (!r.ok) throw new Error('Accès refusé');
            return r.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            if (download) {
                const a = document.createElement('a');
                a.href = url; a.download = 'contrat-' + contractId + '.pdf';
                a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
            } else {
                _showPdfPreviewModal(url, 'contrat-' + contractId + '.pdf');
            }
        })
        .catch(() => showPortalToast('Impossible d\'ouvrir le contrat.', 'error'));
}

function renderPortalContracts(contracts) {
    const list = document.getElementById('contracts-list');
    if (!list) return;
    const visible = (contracts || []).filter(c => c.status !== 'archived');
    if (!visible.length) {
        list.innerHTML = _vnkTableStyles() + '<div class="vnk-empty">Aucun contrat pour ce filtre.</div>';
        return;
    }
    const sc = { draft: '#94A3B8', pending: '#D97706', pending_signature: '#D97706', signed: '#27AE60', cancelled: '#E74C3C' };
    const sl = { draft: 'Brouillon', pending: 'En attente', pending_signature: 'À signer', signed: 'Signé', cancelled: 'Annulé' };
    const toSign = visible.filter(c => ['draft', 'pending', 'pending_signature'].includes(c.status));
    const signed = visible.filter(c => ['signed', 'viewed'].includes(c.status));
    const makeRows = arr => arr.map(c => {
        const color = sc[c.status] || '#94A3B8';
        const needsSign = !c.signed_at && ['pending', 'draft', 'pending_signature'].includes(c.status);
        const clientOk = !!c.signed_at;
        const adminOk = !!c.admin_signed_at;
        return `<tr>
            <td class="num">${c.contract_number}</td>
            <td class="title">${c.title || '—'}</td>
            <td class="date">${new Date(c.created_at).toLocaleDateString('fr-CA')}</td>
            <td style="text-align:center"><span class="vnk-badge" style="background:${color}18;color:${color}">${sl[c.status] || c.status}</span></td>
            <td style="text-align:center;font-size:0.75rem;white-space:nowrap">
                <span style="color:${clientOk ? '#27AE60' : '#94A3B8'}">${clientOk ? '✓ Vous' : '○ Vous'}</span>
                &nbsp;&nbsp;
                <span style="color:${adminOk ? '#27AE60' : '#94A3B8'}">${adminOk ? '✓ VNK' : '○ VNK'}</span>
            </td>
            <td class="actions">
                ${needsSign
                ? '<button class="vnk-action-btn primary" onclick="openSignatureModal(' + c.id + ')">Signer</button>'
                : '<button class="vnk-action-btn" onclick="openSignatureModal(' + c.id + ')">Voir</button> <button class="vnk-action-btn" onclick="_openPdfWithAuth(' + c.id + ',true)">PDF</button>'
            }
            </td>
        </tr>`;
    }).join('');
    const isOpen = true; // Toujours ouvert
    const ctHead = '<thead><tr><th>Numéro</th><th>Titre</th><th>Date</th><th style="text-align:center">Statut</th><th style="text-align:center">Signatures</th><th></th></tr></thead>';
    let html = _vnkTableStyles() + '<div class="vnk-table-wrap">';
    if (toSign.length) {
        html += '<table class="vnk-table">' + ctHead + '<tbody>' + makeRows(toSign) + '</tbody></table>';
    } else if (!signed.length) {
        list.innerHTML = _vnkTableStyles() + '<div class="vnk-empty">Aucun contrat disponible.</div>';
        return;
    }
    // Si seulement des signés — pas de tableau vide en haut
    if (signed.length) {
        html += `<div class="vnk-section-header" onclick="const b=document.getElementById('ct-signed');const open=b.style.display!=='none';b.style.display=open?'none':'block';localStorage.setItem('vnk-ct-signed-open',open?'0':'1');this.querySelector('svg').style.transform=open?'rotate(0)':'rotate(180deg)'">
            <span>Signés (${signed.length})</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;transform:${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div id="ct-signed" style="display:${isOpen ? 'block' : 'none'}">
        <table class="vnk-table">${ctHead}<tbody>${makeRows(signed)}</tbody></table></div>`;
    }
    html += '</div>';
    list.innerHTML = html;
}


function filterContracts() {
    const search = (document.getElementById('contract-search')?.value || '').toLowerCase();
    const status = document.getElementById('contract-filter')?.value || 'all';
    let list = window._allContracts || [];
    if (status !== 'all') {
        if (status === 'pending_signature') list = list.filter(c => ['pending', 'pending_signature', 'draft'].includes(c.status));
        else if (status === 'signed') list = list.filter(c => ['signed', 'viewed'].includes(c.status));
        else if (status === 'pending') list = list.filter(c => c.status === 'pending' || c.status === 'draft');
        else list = list.filter(c => c.status === status);
    }
    if (search) list = list.filter(c => ((c.contract_number || '') + ' ' + (c.title || '')).toLowerCase().includes(search));
    list = _applySort(list, _sortState.contracts || 'date-desc', 'amount_ttc');
    window._filteredContracts = list;
    const { slice, page, pages, total } = _paginate(list, 'contracts');
    renderPortalContracts(slice);
    let ctPager = document.getElementById('pager-contracts');
    if (!ctPager) {
        ctPager = document.createElement('div');
        ctPager.id = 'pager-contracts';
        const ctList = document.getElementById('contracts-list');
        if (ctList) ctList.parentNode?.insertBefore(ctPager, ctList.nextSibling);
    }
    _renderPager('contracts', pages, page, total, ctPager);
}

/* ── Documents ── */
function _getReadDocs() {
    try { return JSON.parse(localStorage.getItem('vnk-read-docs') || '[]'); } catch { return []; }
}

// Ouvrir un document : modal VNK aperçu + télécharger + marquer lu
function openDoc(docId) {
    const doc = (window._allDocuments || []).find(d => String(d.id) === String(docId));
    if (!doc) return;

    let fileUrl = doc.file_url;
    if (!fileUrl && doc._invoice_id) fileUrl = '/api/invoices/' + doc._invoice_id + '/pdf';
    if (!fileUrl && doc._quote_id) fileUrl = '/api/quotes/' + doc._quote_id + '/pdf';
    if (!fileUrl && doc._contract_id) fileUrl = '/api/contracts/' + doc._contract_id + '/pdf';
    if (doc._action === 'pdf-invoice' && doc._invoice_id) fileUrl = '/api/invoices/' + doc._invoice_id + '/pdf';
    if (doc._action === 'pdf-quote' && doc._quote_id) fileUrl = '/api/quotes/' + doc._quote_id + '/pdf';
    if (doc._action === 'pdf-contract' && doc._contract_id) fileUrl = '/api/contracts/' + doc._contract_id + '/pdf';

    if (!fileUrl) return;

    // Marquer comme lu
    _markDocRead(docId);

    // Supprimer modale existante
    var ex = document.getElementById('doc-viewer-modal');
    if (ex) ex.remove();

    var isPdf = fileUrl.includes('/pdf') || fileUrl.startsWith('data:application/pdf') || fileUrl.toLowerCase().endsWith('.pdf');
    var isImg = /\.(png|jpg|jpeg|gif|webp)$/i.test(fileUrl) || fileUrl.startsWith('data:image');
    var dlUrl = fileUrl;
    var fname = doc.file_name || doc.title + '.pdf';
    var date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-CA') : '';

    var previewHtml = isPdf
        ? '<iframe src="' + dlUrl + '#toolbar=1" style="width:100%;height:100%;border:none" title="' + doc.title + '"></iframe>'
        : isImg
            ? '<img src="' + dlUrl + '" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;display:block;margin:auto" alt="' + doc.title + '">'
            : '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1rem;color:#64748B"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Aperçu non disponible.<br><small>Téléchargez pour ouvrir ce fichier.</small></p></div>';

    var modal = document.createElement('div');
    modal.id = 'doc-viewer-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.75);display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = '<div style="background:white;border-radius:14px;width:min(920px,96vw);height:min(87vh,820px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,0.4)">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.9rem 1.25rem;border-bottom:1px solid #E2E8F0;flex-shrink:0;gap:1rem">'
        + '<div style="min-width:0;flex:1">'
        + '<div style="font-size:0.92rem;font-weight:700;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + doc.title + '</div>'
        + '<div style="font-size:0.72rem;color:#94A3B8;margin-top:2px">' + date + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0">'
        + '<a href="' + dlUrl + '" download="' + fname + '" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:0.4rem 0.9rem;background:#1B4F8A;color:white;border-radius:7px;font-size:0.78rem;font-weight:600;text-decoration:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Télécharger</a>'
        + '<button onclick="document.getElementById(\'doc-viewer-modal\').remove()" style="width:32px;height:32px;border:1.5px solid #E2E8F0;border-radius:7px;background:white;cursor:pointer;font-size:1.1rem;color:#64748B;display:flex;align-items:center;justify-content:center;font-family:inherit">×</button>'
        + '</div>'
        + '</div>'
        + '<div style="flex:1;overflow:auto;background:#F8FAFC;padding:4px">' + previewHtml + '</div>'
        + '</div>';

    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    // Rafraîchir les cartes pour afficher "Lu"
    renderDocuments(window._allDocuments || []);
}

// Marquer un doc comme lu — local + API
function _markDocRead(docId) {
    // Mettre à jour is_read en mémoire
    const doc = (window._allDocuments || []).find(d => String(d.id) === String(docId) || String(d._synth_id) === String(docId));
    if (doc) doc.is_read = true;
    // localStorage pour les synthétiques ou fallback
    var readIds = _getReadDocs();
    if (!readIds.map(String).includes(String(docId))) {
        readIds.push(String(docId));
        try { localStorage.setItem('vnk_read_docs', JSON.stringify(readIds)); } catch (e) { }
    }
    // Notifier le serveur (seulement pour les vrais docs DB, pas synthétiques)
    if (!doc?._synth) {
        var token = localStorage.getItem('vnk-token');
        if (token) {
            fetch('/api/documents/' + docId + '/read', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
            }).catch(function () { });
        }
    }
    // Badge basé sur is_read en mémoire — source unique de vérité
    var unread = (window._allDocuments || []).filter(function (d) { return !d.is_read; }).length;
    if (typeof showBadge === 'function') showBadge('badge-documents', unread);
}

function downloadDoc(id) {
    const doc = (window._allDocuments || []).find(d => String(d.id) === String(id) || String(d._synth_id) === String(id));
    if (!doc) return;
    _markDocRead(doc._synth_id || doc.id);
    // Si pas d'URL mais c'est un PDF synthétique → générer via API
    if (!doc.file_url && doc._invoice_id) { downloadPDF('invoices', doc._invoice_id, doc.title); return; }
    if (!doc.file_url && doc._contract_id) { downloadPDF('contracts', doc._contract_id, doc.title); return; }
    if (!doc.file_url && doc._quote_id) { downloadPDF('quotes', doc._quote_id, doc.title); return; }
    if (!doc.file_url) return;
    _markDocRead(id);
    _updateDocItem(id);
    if (doc.file_url.startsWith('data:')) {
        try {
            const arr = doc.file_url.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            const u8arr = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
            const blob = new Blob([u8arr], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = doc.file_name || doc.title + '.pdf';
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
        } catch (e) { console.error('Download error:', e); }
    } else {
        const a = document.createElement('a');
        a.href = doc.file_url; a.download = doc.file_name || doc.title; a.target = '_blank';
        document.body.appendChild(a); a.click(); a.remove();
    }
}


function _getUnreadDocs(docs) {
    const read = _getReadDocs();
    return docs.filter(d => !read.map(String).includes(String(d.id)));
}

window._docSortState = 'date-desc';
window._docSearch = '';

function filterDocuments() {
    const search = (document.getElementById('doc-search')?.value || '').toLowerCase();
    const catFilter = document.getElementById('doc-cat-filter')?.value || 'all';
    const readFilter = document.getElementById('doc-read-filter')?.value || 'all';
    if (search || catFilter !== 'all' || readFilter !== 'all') _pageState.documents = 1;
    window._docSearch = search;
    window._docFilterCat = catFilter === 'all' ? 'Tous' : catFilter;
    window._docFilterRead = readFilter;
    // Sauvegarder l'état — filtres selects seulement, pas la recherche texte
    if (window.VNKState) {
        window.VNKState.save('doc_cat', catFilter);
        window.VNKState.save('doc_read', readFilter);
    }
    let list = window._allDocuments || [];
    if (search) list = list.filter(d => (d.title || '').toLowerCase().includes(search) || (d.description || '').toLowerCase().includes(search));
    if (catFilter !== 'all') list = list.filter(d => _docCategory(d) === catFilter);
    if (readFilter !== 'all') {
        const readIds = _getReadDocs().map(String);
        if (readFilter === 'unread') list = list.filter(d => !readIds.includes(String(d.id)));
        else if (readFilter === 'read') list = list.filter(d => readIds.includes(String(d.id)));
    }
    list = _sortDocs(list, window._docSortState);
    window._filteredDocs = list;
    renderDocuments(list);
}

function setDocView(mode) {
    window._docViewMode = mode;
    const btnList = document.getElementById('doc-view-list');
    const btnGrid = document.getElementById('doc-view-grid');
    if (btnList) { btnList.style.background = mode === 'list' ? '#1B4F8A' : 'white'; btnList.style.color = mode === 'list' ? 'white' : '#64748B'; }
    if (btnGrid) { btnGrid.style.background = mode === 'grid' ? '#1B4F8A' : 'white'; btnGrid.style.color = mode === 'grid' ? 'white' : '#64748B'; }
    filterDocuments();
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
    const opts = [['date-desc', 'Date récente'], ['date-asc', 'Date ancienne'], ['name-asc', 'Nom A'], ['name-desc', 'Nom Z'], ['unread', 'Non lus en premier']];
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
    const labelMap = { 'date-desc': 'Date récente', 'date-asc': 'Date ancienne', 'name-asc': 'Nom A', 'name-desc': 'Nom Z', 'unread': 'Non lus' };
    const lbl = document.getElementById('doc-sort-label');
    if (lbl) lbl.textContent = labelMap[val] || val;
    filterDocuments();
}

function _buildDocumentsList(docs, invoices, contracts, quotes) {
    const result = [...docs];
    const existingIds = new Set(docs.map(d => d._synth_id || String(d.id)));
    (invoices || []).filter(inv => inv.status === 'paid' || inv.status === 'cancelled').forEach(inv => {
        const sid = 'inv-' + inv.id;
        if (!existingIds.has(sid)) {
            result.push({ id: sid, _synth_id: sid, _synth: true, is_read: true, title: inv.invoice_number + (inv.title ? ' — ' + inv.title : ''), description: 'Facture ' + (inv.status === 'paid' ? 'payée' : 'annulée') + ' · ' + formatCurrency(inv.amount_ttc), file_type: 'pdf', file_name: inv.invoice_number + '.pdf', file_url: null, _invoice_id: inv.id, created_at: inv.paid_at || inv.created_at, _category: 'Factures', _action: 'pdf-invoice' });
        }
    });
    // Ajouter les devis acceptés
    (quotes || []).filter(q => q.status === 'accepted' || q.status === 'approved').forEach(q => {
        const sid = 'q-' + q.id;
        if (!existingIds.has(sid)) {
            result.push({
                id: sid, _synth_id: sid, _synth: true,
                title: q.quote_number + (q.title ? ' — ' + q.title : ''),
                description: 'Devis accepté · ' + formatCurrency(q.amount_ttc || q.total_ttc || 0),
                file_type: 'pdf', file_name: q.quote_number + '.pdf',
                file_url: '/api/quotes/' + q.id + '/pdf',
                _quote_id: q.id, created_at: q.accepted_at || q.created_at,
                _category: 'Devis', _action: 'pdf-quote'
            });
            existingIds.add(sid);
        }
    });

    (contracts || []).filter(ct => ct.status === 'signed').forEach(ct => {
        const sid = 'ct-' + ct.id;
        if (!existingIds.has(sid)) {
            result.push({ id: sid, _synth_id: sid, _synth: true, is_read: true, title: ct.contract_number + (ct.title ? ' — ' + ct.title : ''), description: 'Contrat signé le ' + (ct.signed_at ? new Date(ct.signed_at).toLocaleDateString('fr-CA') : '—'), file_type: 'pdf', file_name: ct.contract_number + '.pdf', file_url: '/api/contracts/' + ct.id + '/pdf', _contract_id: ct.id, created_at: ct.signed_at || ct.created_at, _category: 'Contrats', _action: 'pdf-contract' });
        }
    });
    // Devis acceptés → catégorie Devis
    (quotes || []).filter(q => q.status === 'accepted').forEach(q => {
        const sid = 'q-' + q.id;
        if (!existingIds.has(sid)) {
            result.push({ id: sid, _synth_id: sid, _synth: true, is_read: true, title: q.quote_number + (q.title ? ' — ' + q.title : ''), description: 'Devis accepté · ' + formatCurrency(q.amount_ttc), file_type: 'pdf', file_name: q.quote_number + '.pdf', file_url: '/api/quotes/' + q.id + '/pdf', _quote_id: q.id, created_at: q.accepted_at || q.updated_at || q.created_at, _category: 'Devis', _action: 'pdf-quote' });
        }
    });
    return result;
}

function _docCategory(doc) {
    // Priorité 1 : catégorie explicite en DB (champ category)
    if (doc.category) return doc.category;
    // Priorité 2 : catégorie synthétique (factures payées auto, devis acceptés auto)
    if (doc._category) return doc._category;
    // Priorité 3 : déduction par titre/type
    const t = (doc.file_type || doc.file_name || '').toLowerCase();
    const title = (doc.title || '').toLowerCase();
    if (title.includes('facture') || title.includes('invoice') || t.includes('facture')) return 'Factures';
    if (title.includes('contrat') || title.includes('contract') || t.includes('contrat')) return 'Contrats';
    if (title.includes('devis') || title.includes('quote')) return 'Devis';
    if (title.includes('livrable') || title.includes('programme') || title.includes('plc') || title.includes('hmi')) return 'Livrables';
    if (title.includes('rapport') || title.includes('audit') || title.includes('documentation') || title.includes('doc')) return 'Documentation technique';
    return 'Autres documents';
}

const _catOrder = ['Documentation technique', 'Livrables', 'Factures', 'Contrats', 'Devis', 'Autres documents'];
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
        list.innerHTML = '<div class="portal-empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg><p>Aucun document disponible.</p></div>';
        return;
    }
    const readIds = _getReadDocs();
    const readFilter = window._docFilterRead || 'all';
    const catColors = {
        'Livrables': { icon: '#EA580C', badgeBg: '#FFEDD5' },
        'Factures': { icon: '#16A34A', badgeBg: '#DCFCE7' },
        'Devis': { icon: '#2563EB', badgeBg: '#DBEAFE' },
        'Contrats': { icon: '#7C3AED', badgeBg: '#EDE9FE' },
        'Documentation technique': { icon: '#0284C7', badgeBg: '#E0F2FE' },
        'Autres documents': { icon: '#64748B', badgeBg: '#F1F5F9' }
    };
    const defaultColor = { icon: '#64748B', badgeBg: '#F1F5F9' };
    const CAT_PAGE = 15;

    // Grouper par catégorie
    const groups = {};
    documents.forEach(doc => {
        const cat = _docCategory(doc);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(doc);
    });

    if (!window._docCatPage) window._docCatPage = {};
    if (!window._docCatExpanded) window._docCatExpanded = {};

    // Tableau global des catégories — indexé numériquement pour éviter guillemets dans onclick
    const allCatKeys = [..._catOrder.filter(c => groups[c]), ...Object.keys(groups).filter(c => !_catOrder.includes(c))];
    window._docCatNames = allCatKeys; // Exposé globalement pour les callbacks

    // Fonctions globales appelées depuis onclick avec INDEX numérique
    window._docToggleCatIdx = function (idx) {
        const cat = window._docCatNames[idx];
        if (!cat) return;
        window._docCatExpanded[cat] = window._docCatExpanded[cat] === false ? true : false;
        renderDocuments(window._allDocuments || []);
    };
    window._docSetCatPageIdx = function (idx, p) {
        const cat = window._docCatNames[idx];
        if (!cat) return;
        window._docCatPage[cat] = p;
        renderDocuments(window._allDocuments || []);
    };

    const activeCat = window._docFilterCat || 'Tous';
    const search = (document.getElementById('doc-search')?.value || '').toLowerCase();

    // ── Carte document ──
    const renderCard = (doc) => {
        // is_read de la DB si disponible, sinon localStorage
        const isRead = doc.is_read === true || (doc.is_read == null && readIds.map(String).includes(String(doc.id)));
        const cat = _docCategory(doc);
        const colors = catColors[cat] || defaultColor;

        let statusText = '';
        if (doc.category === 'Factures' || doc._category === 'Factures') statusText = 'Facture pay\u00e9e';
        else if (doc.category === 'Devis' || doc._category === 'Devis') statusText = 'Devis accept\u00e9';
        else if (doc.category === 'Contrats' || doc._category === 'Contrats') statusText = 'Contrat sign\u00e9';
        else if (doc.description) statusText = doc.description.split('\u00b7')[0].trim().substring(0, 35);

        let fileUrl = doc.file_url;
        if (!fileUrl && doc._invoice_id) fileUrl = '/api/invoices/' + doc._invoice_id + '/pdf';
        if (!fileUrl && doc._quote_id) fileUrl = '/api/quotes/' + doc._quote_id + '/pdf';
        if (!fileUrl && doc._contract_id) fileUrl = '/api/contracts/' + doc._contract_id + '/pdf';
        if (doc._action === 'pdf-invoice' && doc._invoice_id) fileUrl = '/api/invoices/' + doc._invoice_id + '/pdf';
        if (doc._action === 'pdf-quote' && doc._quote_id) fileUrl = '/api/quotes/' + doc._quote_id + '/pdf';
        if (doc._action === 'pdf-contract' && doc._contract_id) fileUrl = '/api/contracts/' + doc._contract_id + '/pdf';

        const hasFile = !!fileUrl;
        const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-CA') : '';
        const docIdStr = String(doc.id).replace(/[^a-zA-Z0-9_-]/g, '');

        const readBadge = isRead
            ? '<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.65rem;color:#16A34A;font-weight:600"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Lu</span>'
            : '<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.65rem;color:#DC2626;font-weight:700"><svg width="7" height="7" viewBox="0 0 24 24" fill="#DC2626"><circle cx="12" cy="12" r="10"/></svg>Non lu</span>';

        const iconHtml = hasFile
            ? '<div onclick="openDoc(\'' + docIdStr + '\')" style="width:34px;height:34px;flex-shrink:0;border-radius:7px;background:' + colors.badgeBg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity 0.15s" onmouseenter="this.style.opacity=\'0.7\'" onmouseleave="this.style.opacity=\'1\'">'
            + '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + colors.icon + '" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
            : '<div style="width:34px;height:34px;flex-shrink:0;border-radius:7px;background:' + colors.badgeBg + ';display:flex;align-items:center;justify-content:center">'
            + '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + colors.icon + '" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';

        const dlBtn = hasFile
            ? '<button onclick="downloadDoc(\'' + docIdStr + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:0.35rem 0.7rem;background:' + colors.icon + ';color:white;border:none;border-radius:7px;font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>T\u00e9l\u00e9charger</button>'
            : '<span style="font-size:0.7rem;color:#94A3B8;font-style:italic">Bient\u00f4t dispo</span>';

        return '<div id="doc-item-' + doc.id + '" style="background:white;border:1.5px solid ' + (isRead ? '#E2E8F0' : colors.icon) + ';border-radius:10px;padding:0.85rem;display:flex;flex-direction:column;gap:0.5rem;position:relative">'
            + (!isRead ? '<span style="position:absolute;top:-7px;left:10px;background:' + colors.icon + ';color:white;font-size:0.58rem;font-weight:700;padding:1px 8px;border-radius:8px;text-transform:uppercase">Nouveau</span>' : '')
            + '<div style="display:flex;align-items:flex-start;gap:0.6rem">'
            + iconHtml
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:0.82rem;font-weight:700;color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + doc.title + '">' + doc.title + '</div>'
            + '<div style="display:flex;align-items:center;gap:0.4rem;margin-top:2px;flex-wrap:wrap">'
            + (statusText ? '<span style="font-size:0.7rem;color:' + colors.icon + ';font-weight:500">' + statusText + '</span><span style="color:#E2E8F0">\u00b7</span>' : '')
            + readBadge
            + '</div>'
            + '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:0.4rem;border-top:1px solid #F1F5F9">'
            + '<span style="font-size:0.68rem;color:#94A3B8">' + date + '</span>'
            + dlBtn
            + '</div>'
            + '</div>';
    };

    // ── Bloc accordéon par catégorie avec INDEX numérique dans onclick ──
    const renderCategoryBlock = (cat, docs, catIdx) => {
        const colors = catColors[cat] || defaultColor;
        const unread = docs.filter(d => !readIds.map(String).includes(String(d.id))).length;
        const isExpanded = window._docCatExpanded[cat] !== false;
        const catPage = window._docCatPage[cat] || 1;
        const totalPages = Math.ceil(docs.length / CAT_PAGE);
        const start = (catPage - 1) * CAT_PAGE;
        const visibleDocs = isExpanded ? docs.slice(start, start + CAT_PAGE) : [];

        // Mini-pagination interne
        let pagerHtml = '';
        if (isExpanded && totalPages > 1) {
            const prevPage = Math.max(1, catPage - 1);
            const nextPage = Math.min(totalPages, catPage + 1);
            pagerHtml = '<div style="display:flex;align-items:center;justify-content:center;gap:0.4rem;margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid #F1F5F9">'
                + '<button onclick="event.stopPropagation();window._docSetCatPageIdx(' + catIdx + ',' + prevPage + ')" ' + (catPage <= 1 ? 'disabled' : '')
                + ' style="width:28px;height:28px;border:1.5px solid #E2E8F0;border-radius:6px;background:white;cursor:pointer;font-family:inherit;font-size:1rem">&lsaquo;</button>'
                + '<span style="font-size:0.75rem;color:#64748B;font-weight:600">' + catPage + ' / ' + totalPages + '</span>'
                + '<button onclick="event.stopPropagation();window._docSetCatPageIdx(' + catIdx + ',' + nextPage + ')" ' + (catPage >= totalPages ? 'disabled' : '')
                + ' style="width:28px;height:28px;border:1.5px solid #E2E8F0;border-radius:6px;background:white;cursor:pointer;font-family:inherit;font-size:1rem">&rsaquo;</button>'
                + '<span style="font-size:0.7rem;color:#94A3B8">' + docs.length + ' fichier' + (docs.length > 1 ? 's' : '') + '</span>'
                + '</div>';
        }

        return '<div style="margin-bottom:0.85rem;border-radius:10px;border:1px solid ' + colors.icon + '28;overflow:hidden">'
            // Header — onclick avec INDEX numérique, aucun guillemet problématique
            + '<div onclick="window._docToggleCatIdx(' + catIdx + ')" style="display:flex;align-items:center;gap:0.6rem;padding:0.7rem 0.9rem;background:' + colors.badgeBg + ';cursor:pointer;user-select:none">'
            + '<div style="width:26px;height:26px;border-radius:6px;background:' + colors.icon + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">'
            + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
            + '</div>'
            + '<span style="font-size:0.85rem;font-weight:700;color:' + colors.icon + ';flex:1">' + cat + '</span>'
            + '<span style="font-size:0.72rem;color:' + colors.icon + ';opacity:0.65">' + docs.length + ' fichier' + (docs.length > 1 ? 's' : '') + '</span>'
            + (unread > 0 ? '<span style="background:' + colors.icon + ';color:white;font-size:0.6rem;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:4px">' + unread + ' nouveau' + (unread > 1 ? 'x' : '') + '</span>' : '')
            + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="' + colors.icon + '" stroke-width="2.5" style="transform:rotate(' + (isExpanded ? '180' : '0') + 'deg);transition:transform 0.2s;flex-shrink:0;margin-left:4px"><polyline points="6 9 12 15 18 9"/></svg>'
            + '</div>'
            + (isExpanded
                ? '<div style="padding:0.75rem;background:white">'
                + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.6rem">'
                + (visibleDocs.length ? visibleDocs.map(renderCard).join('') : '<p style="color:#94A3B8;font-size:0.82rem;text-align:center;padding:1rem">Aucun document.</p>')
                + '</div>'
                + pagerHtml
                + '</div>'
                : '')
            + '</div>';
    };

    let html = '';

    if (activeCat === 'Tous') {
        let anyVisible = false;
        allCatKeys.forEach((cat, idx) => {
            let docs = groups[cat] || [];
            if (search) docs = docs.filter(d => (d.title || '').toLowerCase().includes(search));
            if (readFilter === 'unread') docs = docs.filter(d => !readIds.map(String).includes(String(d.id)));
            else if (readFilter === 'read') docs = docs.filter(d => readIds.map(String).includes(String(d.id)));
            if (docs.length) { html += renderCategoryBlock(cat, docs, idx); anyVisible = true; }
        });
        if (!anyVisible) html = '<p class="portal-empty">Aucun document trouv\u00e9.</p>';
    } else {
        let docs = groups[activeCat] || [];
        if (search) docs = docs.filter(d => (d.title || '').toLowerCase().includes(search));
        if (readFilter === 'unread') docs = docs.filter(d => !readIds.map(String).includes(String(d.id)));
        else if (readFilter === 'read') docs = docs.filter(d => readIds.map(String).includes(String(d.id)));
        const total = docs.length;
        const paged = docs.slice((_pageDocuments - 1) * _PAGE_SIZE, _pageDocuments * _PAGE_SIZE);
        html = !paged.length
            ? '<p class="portal-empty">Aucun document dans cette cat\u00e9gorie.</p>'
            : '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.7rem">' + paged.map(renderCard).join('') + '</div>';
        if (total > _PAGE_SIZE) {
            list.innerHTML = html;
            const pagerEl = document.createElement('div');
            list.appendChild(pagerEl);
            _renderPager('documents', Math.ceil(total / PAGE_SIZE), _pageDocuments, total, pagerEl);
            return;
        }
    }
    _safeSetHTML(list, html);
}


function _updateDocItem(id) {
    setTimeout(() => {
        const item = document.getElementById('doc-item-' + id);
        if (item) {
            item.style.borderLeft = '';
            item.style.background = '';
            const badge = item.querySelector('span[style*="NOUVEAU"]');
            if (badge) badge.remove();
        }
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
        if (!response.ok) { showPortalToast('Impossible de charger le PDF.', 'error'); return; }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        _showPdfPreviewModal(url, 'VNK-' + number + '.pdf');
    } catch (error) { console.error('PDF error:', error); showPortalToast('Erreur PDF.', 'error'); }
}

function _showPdfPreviewModal(blobUrl, filename) {
    const existing = document.getElementById('vnk-pdf-preview-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'vnk-pdf-preview-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,18,35,0.7);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML =
        '<div style="width:100%;max-width:900px;height:90vh;background:white;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.4)">' +
        '<div style="background:#0F2D52;padding:0.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">' +
        '<div style="display:flex;align-items:center;gap:0.75rem">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '<span style="color:white;font-size:0.85rem;font-weight:600">' + filename + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:0.5rem">' +
        '<button onclick="_downloadCurrentPdf(this)" data-url="__URL__" data-name="__NAME__" style="display:flex;align-items:center;gap:5px;padding:0.4rem 0.85rem;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:7px;color:white;font-size:0.78rem;font-weight:600;cursor:pointer">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        'Télécharger' +
        '</button>' +
        '<button onclick="document.getElementById(&quot;vnk-pdf-preview-modal&quot;).remove()" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);color:white;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center">×</button>' +
        '</div>' +
        '</div>' +
        '<iframe src="' + blobUrl + '" style="flex:1;width:100%;border:none"></iframe>' +
        '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _downloadCurrentPdf(btn) {
    const url = btn.getAttribute('data-url') || btn.dataset.url;
    const filename = btn.getAttribute('data-name') || btn.dataset.name;
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
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

/* ═══════════════════════════════════════════════
   MODAL MAISON
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   SYSTÈME MODAL VNK — Design premium
═══════════════════════════════════════════════ */
function _ensureModal() {
    if (document.getElementById('vnk-modal')) return;

    // Injecter les styles du modal
    const style = document.createElement('style');
    style.textContent = `
        #vnk-modal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(10, 18, 35, 0.6);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            align-items: center;
            justify-content: center;
            padding: 1rem;
        }
        #vnk-modal-box {
            background: #fff;
            border-radius: 20px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 32px 80px rgba(10,18,35,0.22), 0 0 0 1px rgba(0,0,0,0.04);
            overflow: hidden;
            animation: vnkModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
            position: relative;
        }
        @keyframes vnkModalIn {
            from { opacity: 0; transform: scale(0.88) translateY(12px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .vnk-modal-top {
            padding: 2rem 2rem 1.5rem;
            text-align: center;
            position: relative;
        }
        .vnk-modal-accent {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            border-radius: 20px 20px 0 0;
        }
        .vnk-modal-icon-wrap {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0.5rem auto 1.25rem;
        }
        #vnk-modal-title {
            font-size: 1.1rem;
            font-weight: 800;
            color: #0F172A;
            margin-bottom: 0.5rem;
            letter-spacing: -0.01em;
        }
        #vnk-modal-msg {
            font-size: 0.875rem;
            color: #64748B;
            line-height: 1.6;
        }
        .vnk-modal-footer {
            padding: 1.25rem 2rem 1.75rem;
            display: flex;
            gap: 0.75rem;
            justify-content: center;
        }
        .vnk-modal-footer button {
            flex: 1;
            max-width: 160px;
            padding: 0.7rem 1.25rem;
            border-radius: 10px;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
            border: none;
            font-family: inherit;
        }
        .vnk-btn-cancel {
            background: #F1F5F9 !important;
            color: #475569 !important;
            border: 1.5px solid #E2E8F0 !important;
        }
        .vnk-btn-cancel:hover {
            background: #E2E8F0 !important;
        }
        .vnk-btn-primary {
            background: linear-gradient(135deg, #1B4F8A, #2E75B6) !important;
            color: white !important;
            box-shadow: 0 4px 12px rgba(27,79,138,0.3) !important;
        }
        .vnk-btn-primary:hover {
            background: linear-gradient(135deg, #154075, #1B4F8A) !important;
            box-shadow: 0 6px 16px rgba(27,79,138,0.4) !important;
            transform: translateY(-1px);
        }
        .vnk-btn-success {
            background: linear-gradient(135deg, #16A34A, #22C55E) !important;
            color: white !important;
            box-shadow: 0 4px 12px rgba(22,163,74,0.3) !important;
        }
        .vnk-btn-danger {
            background: linear-gradient(135deg, #DC2626, #EF4444) !important;
            color: white !important;
            box-shadow: 0 4px 12px rgba(220,38,38,0.3) !important;
        }
        #vnk-modal-stripe-wrap {
            padding: 0 2rem;
            margin-bottom: 1rem;
            display: none;
        }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'vnk-modal';
    el.innerHTML = `
        <div id="vnk-modal-box">
            <div class="vnk-modal-top">
                <div class="vnk-modal-accent" id="vnk-modal-accent"></div>
                <div class="vnk-modal-icon-wrap" id="vnk-modal-icon-wrap">
                    <div id="vnk-modal-icon"></div>
                </div>
                <div id="vnk-modal-title"></div>
                <p id="vnk-modal-msg"></p>
            </div>
            <div id="vnk-modal-stripe-wrap"><div id="vnk-modal-stripe"></div></div>
            <div class="vnk-modal-footer" id="vnk-modal-btns"></div>
        </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) _closeModal(); });
}

function _closeModal() {
    const m = document.getElementById('vnk-modal');
    if (m) {
        const box = document.getElementById('vnk-modal-box');
        if (box) {
            box.style.animation = 'none';
            box.style.transform = 'scale(0.92) translateY(8px)';
            box.style.opacity = '0';
            box.style.transition = 'all 0.15s ease';
        }
        setTimeout(() => {
            m.style.display = 'none';
            if (box) { box.style.transform = ''; box.style.opacity = ''; box.style.transition = ''; }
        }, 150);
    }
}

// Config par type: [couleur accent, couleur fond icône, couleur icône, SVG icône]
const _modalTypes = {
    success: {
        accent: '#16A34A',
        iconBg: '#DCFCE7',
        btnClass: 'vnk-btn-success',
        icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    },
    error: {
        accent: '#DC2626',
        iconBg: '#FEE2E2',
        btnClass: 'vnk-btn-danger',
        icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    },
    warning: {
        accent: '#D97706',
        iconBg: '#FEF3C7',
        btnClass: 'vnk-btn-primary',
        icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    },
    info: {
        accent: '#1B4F8A',
        iconBg: '#EBF5FB',
        btnClass: 'vnk-btn-primary',
        icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    }
};

function _applyModalType(type) {
    const cfg = _modalTypes[type] || _modalTypes.info;
    const accent = document.getElementById('vnk-modal-accent');
    const iconWrap = document.getElementById('vnk-modal-icon-wrap');
    const iconEl = document.getElementById('vnk-modal-icon');
    if (accent) accent.style.background = cfg.accent;
    if (iconWrap) iconWrap.style.background = cfg.iconBg;
    if (iconEl) iconEl.innerHTML = cfg.icon;
    return cfg;
}

function showInfo(title, msg, icon) {
    _ensureModal();
    const type = icon === 'success' ? 'success' : icon === 'error' ? 'error' : 'info';
    _applyModalType(type);
    document.getElementById('vnk-modal-title').textContent = title;
    document.getElementById('vnk-modal-msg').innerHTML = msg;
    document.getElementById('vnk-modal-stripe-wrap').style.display = 'none';
    const cfg = _modalTypes[type];
    document.getElementById('vnk-modal-btns').innerHTML =
        `<button onclick="_closeModal()" class="${cfg.btnClass}" style="max-width:200px">OK</button>`;
    const m = document.getElementById('vnk-modal');
    const box = document.getElementById('vnk-modal-box');
    if (box) { box.style.animation = 'none'; void box.offsetWidth; box.style.animation = 'vnkModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)'; }
    m.style.display = 'flex';
}

function showConfirm(title, msg, onConfirm, opts = {}) {
    _ensureModal();
    const type = opts.type || 'warning';
    _applyModalType(type);
    document.getElementById('vnk-modal-title').textContent = title;
    document.getElementById('vnk-modal-msg').textContent = msg;
    document.getElementById('vnk-modal-stripe-wrap').style.display = 'none';
    const cfg = _modalTypes[type];
    const confirmLabel = opts.confirmLabel || 'Confirmer';
    document.getElementById('vnk-modal-btns').innerHTML =
        `<button onclick="_closeModal()" class="vnk-btn-cancel">Annuler</button>` +
        `<button id="vnk-modal-confirm" class="${cfg.btnClass}">${confirmLabel}</button>`;
    document.getElementById('vnk-modal-confirm').onclick = () => { _closeModal(); onConfirm(); };
    const m = document.getElementById('vnk-modal');
    const box = document.getElementById('vnk-modal-box');
    if (box) { box.style.animation = 'none'; void box.offsetWidth; box.style.animation = 'vnkModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)'; }
    m.style.display = 'flex';
}

/* ═══════════════════════════════════════════════
   STRIPE — paiement intégré
═══════════════════════════════════════════════ */
const _stripeKey = 'pk_test_51TErqtRnDD0deTI4BLVRIDRe8Jy1pfud8ibIoAXUgTi89OH7EQOVcn22KeE9DX8sDeTPiJB7lMyfvhRaRHTILbs600iS6ESs4W';
let _stripe = null, _cardElement = null;

function _initStripe() {
    if (_stripe) return;
    if (typeof Stripe !== 'undefined') _stripe = Stripe(_stripeKey);
}

async function payInvoice(invoiceId, amountTtc) {
    // Déléguer au modal Stripe premium (stripe-payment.js)
    window._vnkCurrentInvoiceId = invoiceId; // Pour la confirmation après paiement
    if (typeof window._vnkStripe !== 'undefined' || typeof Stripe !== 'undefined') {
        // stripe-payment.js est chargé — utiliser son payInvoice
        // Mais comme on est dans portal.js qui écrase, on appelle directement _vnkPayOpen
        initStripe();
        if (!_vnkStripe) { showPortalToast('Service de paiement indisponible. Rechargez la page.', 'error'); return; }
        const token = localStorage.getItem('vnk-token');
        const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');
        const invoice = (window._allInvoices || []).find(i => i.id === invoiceId) || {};
        _vnkPayOpen(invoice, amountTtc, user);
        try {
            const r = await fetch('/api/payments/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ invoice_id: invoiceId })
            });
            const d = await r.json();
            if (!d.success || !d.clientSecret) { _vnkPayBodyError(d.message || 'Erreur lors de la création du paiement.'); return; }
            _vnkMountStripeElement(d.clientSecret);
        } catch (e) { _vnkPayBodyError('Erreur de connexion. Veuillez réessayer.'); }
    } else {
        showPortalToast('Stripe non chargé. Rechargez la page.', 'error');
    }
}


async function acceptQuote(quoteId) {
    showConfirm(
        'Accepter ce devis ?',
        'Un contrat sera créé automatiquement et disponible dans votre espace Contrats.',
        async () => {
            const token = localStorage.getItem('vnk-token');
            const res = await fetch('/api/quotes/' + quoteId + '/accept', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
            const d = await res.json().catch(() => ({}));
            if (res.ok && d.success) {
                const msg = d.contract
                    ? 'Le contrat ' + d.contract.contract_number + ' a été créé et est disponible dans vos contrats.'
                    : 'Un contrat vous sera envoyé pour signature prochainement.';
                showInfo('Devis accepté !', msg, 'success');
                // Rafraîchir immédiatement quotes + contracts
                await loadAllData();
                // Aller directement sur l'onglet contrats si contrat créé
                if (d.contract) {
                    setTimeout(() => showTab('contracts'), 800);
                }
            } else {
                showInfo('Erreur', d.message || 'Impossible d\'accepter ce devis. Réessayez.', 'error');
            }
        }
    );
}

async function signContract(contractId, hellosignId, fileUrl) {
    // Toujours ouvrir le modal de signature canvas — Option A
    openSignatureModal(contractId);
}

// Alias utilisé par les boutons de la liste contrats
function signPortalContract(contractId) {
    openSignatureModal(contractId);
}

// ── Modal de signature canvas ──────────────────────────────────────
function openSignatureModal(contractId) {
    // Supprimer l'ancien modal si existant
    const existing = document.getElementById('vnk-sign-modal');
    if (existing) existing.remove();

    // Trouver les infos du contrat
    const c = (window._allContracts || []).find(x => x.id === contractId) || {};

    const overlay = document.createElement('div');
    overlay.id = 'vnk-sign-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;flex-direction:column';
    overlay.innerHTML = `
        <div style="background:#0F2D52;padding:0.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
            <div>
                <div style="font-size:0.95rem;font-weight:700;color:white">${c.contract_number || 'Contrat'} — ${c.title || ''}</div>
                <div style="font-size:0.72rem;color:rgba(255,255,255,0.6);margin-top:1px">${c.client_name || 'Jean Tremblay'} · ${c.company_name || ''}</div>
            </div>
            <button onclick="closeSignatureModal()" style="background:rgba(255,255,255,0.1);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <div style="flex:1;overflow:auto;background:#525659">
            <iframe id="sign-modal-iframe" src="" style="width:100%;height:100%;border:none;display:block;min-height:500px"></iframe>
        </div>
        <div style="background:white;border-top:1px solid #E2E8F0;padding:1rem 1.5rem;flex-shrink:0">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">
                <div style="display:flex;align-items:center;gap:1rem;font-size:0.82rem">
                    <span id="sign-client-status" style="color:#D97706;font-weight:600;display:flex;align-items:center;gap:5px">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Client : en attente
                    </span>
                </div>
                <div style="display:flex;gap:0.75rem">
                    <button onclick="closeSignatureModal()" style="padding:0.6rem 1.25rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer">Fermer</button>
                    <div id="modal-action-btn"></div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // Ajouter le bouton action selon le statut du contrat
    const actionDiv = document.getElementById('modal-action-btn');
    const needsClientSign = c && ['draft', 'pending', 'pending_signature'].includes(c.status) && !c.signed_at;
    if (actionDiv) {
        if (needsClientSign) {
            actionDiv.innerHTML = '<button onclick="openClientSignatureCanvas(' + contractId + ')" style="padding:0.6rem 1.5rem;background:#D97706;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2.5\'><path d=\'M12 20h9\'/><path d=\'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z\'/></svg>Signer ce contrat</button>';
        } else {
            actionDiv.innerHTML = '<button onclick="_openPdfWithAuth(' + contractId + ', true)" style="padding:0.6rem 1.5rem;border:1.5px solid #27AE60;color:#27AE60;background:white;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2.5\'><path d=\'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\'/><polyline points=\'7 10 12 15 17 10\'/><line x1=\'12\' y1=\'15\' x2=\'12\' y2=\'3\'/></svg>Télécharger PDF</button>';
        }
    }

    // Charger le PDF dans l'iframe
    const token = localStorage.getItem('vnk-token');
    const iframe = document.getElementById('sign-modal-iframe');
    fetch('/api/contracts/' + contractId + '/pdf', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.blob())
        .then(blob => { iframe.src = URL.createObjectURL(blob); })
        .catch(() => { });
    overlay._contractId = contractId;
}

function openClientSignatureCanvas(contractId) {
    // Ajouter le canvas de signature en overlay sur la prévisualisation
    const existing = document.getElementById('vnk-canvas-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'vnk-canvas-panel';
    panel.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:1.5rem';
    panel.innerHTML = `
        <div style="width:100%;max-width:780px;background:white;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,0.3);overflow:hidden">
            <div style="background:#0F2D52;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between">
                <div>
                    <div style="font-size:0.95rem;font-weight:700;color:white">Votre signature</div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.6);margin-top:2px">Choisissez votre mode de signature</div>
                </div>
                <button onclick="document.getElementById('vnk-canvas-panel').remove()" style="background:rgba(255,255,255,0.12);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center">×</button>
            </div>
            <div style="padding:1.25rem 1.5rem 0">
                <!-- Onglets mode de signature -->
                <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem">
                    <button id="sign-tab-draw" onclick="_switchSignTab('draw')" style="flex:1;padding:0.5rem;border-radius:8px;border:2px solid #1B4F8A;background:#EBF5FB;color:#1B4F8A;font-size:0.8rem;font-weight:700;cursor:pointer">
                        ✏ Dessiner
                    </button>
                    <button id="sign-tab-upload" onclick="_switchSignTab('upload')" style="flex:1;padding:0.5rem;border-radius:8px;border:2px solid #E2E8F0;background:white;color:#64748B;font-size:0.8rem;font-weight:600;cursor:pointer">
                        ↑ Importer
                    </button>
                    <button id="sign-tab-text" onclick="_switchSignTab('text')" style="flex:1;padding:0.5rem;border-radius:8px;border:2px solid #E2E8F0;background:white;color:#64748B;font-size:0.8rem;font-weight:600;cursor:pointer">
                        Aa Initiales
                    </button>
                </div>
            </div>
            <div style="padding:0 1.5rem 1.5rem">
                <!-- Mode Dessiner -->
                <div id="sign-panel-draw">
                    <div style="border:2px solid #1B4F8A;border-radius:10px;background:white;position:relative;touch-action:none;margin-bottom:1rem">
                        <canvas id="sign-canvas" width="720" height="180" style="display:block;width:100%;height:180px;border-radius:8px;cursor:crosshair"></canvas>
                        <button onclick="clearSignatureCanvas()" style="position:absolute;top:8px;right:8px;background:white;border:1px solid #E2E8F0;border-radius:6px;padding:4px 10px;font-size:0.75rem;color:#64748B;cursor:pointer;font-weight:500">Effacer</button>
                    </div>
                </div>
                <!-- Mode Importer -->
                <div id="sign-panel-upload" style="display:none">
                    <div id="sign-upload-zone" onclick="document.getElementById('sign-file-input').click()" style="border:2px dashed #1B4F8A;border-radius:10px;padding:2rem;text-align:center;cursor:pointer;background:#F8FAFC;margin-bottom:1rem">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="1.5" style="margin-bottom:0.5rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <div style="font-size:0.85rem;font-weight:600;color:#1B4F8A">Cliquez pour importer</div>
                        <div style="font-size:0.75rem;color:#94A3B8;margin-top:4px">PNG, JPG ou BMP — fond blanc recommandé</div>
                    </div>
                    <input type="file" id="sign-file-input" accept="image/*" style="display:none" onchange="_loadSignatureImage(this)">
                    <canvas id="sign-canvas-upload" width="720" height="180" style="display:none;width:100%;height:180px;border-radius:8px;border:2px solid #1B4F8A"></canvas>
                </div>
                <!-- Mode Initiales -->
                <div id="sign-panel-text" style="display:none">
                    <input type="text" id="sign-text-input" placeholder="Ex: JT" maxlength="4"
                        style="width:100%;padding:0.75rem;border:2px solid #1B4F8A;border-radius:10px;font-size:1.5rem;text-align:center;font-family:serif;font-weight:700;color:#0F2D52;margin-bottom:0.75rem;box-sizing:border-box"
                        oninput="_previewTextSignature(this.value)">
                    <canvas id="sign-canvas-text" width="720" height="120" style="display:block;width:100%;height:120px;border-radius:8px;border:1.5px solid #E2E8F0;background:#FAFAFA"></canvas>
                </div>
                <div style="font-size:0.73rem;color:#94A3B8;line-height:1.5;margin:0.75rem 0 1rem">
                    En soumettant, vous confirmez avoir lu et accepté les termes du contrat. Votre adresse IP et la date seront enregistrées.
                </div>
                <div style="display:flex;gap:0.75rem;justify-content:flex-end">
                    <button onclick="document.getElementById('vnk-canvas-panel').remove()" style="padding:0.6rem 1.4rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer">Annuler</button>
                    <button onclick="submitSignature()" style="padding:0.6rem 1.75rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Confirmer la signature
                    </button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(panel);
    // Mettre le contractId sur le panel pour submitSignature
    document.getElementById('vnk-sign-modal')._contractId = contractId;
    initSignatureCanvas();
}

function closeSignatureModal() {
    // Fermer sans soumettre — jamais de signature automatique à la fermeture
    const overlay = document.getElementById('vnk-sign-modal');
    if (overlay) {
        overlay.style.display = 'none';
        const iframe = document.getElementById('sign-modal-iframe');
        if (iframe && iframe.src.startsWith('blob:')) URL.revokeObjectURL(iframe.src);
    }
    // Réinitialiser
    _clientSignMode = 'draw';
    _uploadedSignatureData = null;
}

let _signCanvas = null, _signCtx = null, _signDrawing = false, _signLastX = 0, _signLastY = 0;

function initSignatureCanvas() {
    _signCanvas = document.getElementById('sign-canvas');
    if (!_signCanvas) return;
    _signCtx = _signCanvas.getContext('2d');
    _signCtx.strokeStyle = '#0F2D52';
    _signCtx.lineWidth = 2.5;
    _signCtx.lineCap = 'round';
    _signCtx.lineJoin = 'round';

    function getPos(e) {
        const rect = _signCanvas.getBoundingClientRect();
        const scaleX = _signCanvas.width / rect.width;
        const scaleY = _signCanvas.height / rect.height;
        const src = e.touches ? e.touches[0] : e;
        return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
    }

    _signCanvas.addEventListener('mousedown', e => { _signDrawing = true; const p = getPos(e); _signLastX = p.x; _signLastY = p.y; });
    _signCanvas.addEventListener('mousemove', e => { if (!_signDrawing) return; const p = getPos(e); _signCtx.beginPath(); _signCtx.moveTo(_signLastX, _signLastY); _signCtx.lineTo(p.x, p.y); _signCtx.stroke(); _signLastX = p.x; _signLastY = p.y; });
    _signCanvas.addEventListener('mouseup', () => { _signDrawing = false; });
    _signCanvas.addEventListener('mouseleave', () => { _signDrawing = false; });
    _signCanvas.addEventListener('touchstart', e => { e.preventDefault(); _signDrawing = true; const p = getPos(e); _signLastX = p.x; _signLastY = p.y; }, { passive: false });
    _signCanvas.addEventListener('touchmove', e => { e.preventDefault(); if (!_signDrawing) return; const p = getPos(e); _signCtx.beginPath(); _signCtx.moveTo(_signLastX, _signLastY); _signCtx.lineTo(p.x, p.y); _signCtx.stroke(); _signLastX = p.x; _signLastY = p.y; }, { passive: false });
    _signCanvas.addEventListener('touchend', () => { _signDrawing = false; });
}

function clearSignatureCanvas() {
    if (!_signCanvas) { _signCanvas = document.getElementById('sign-canvas'); _signCtx = _signCanvas?.getContext('2d'); }
    if (_signCtx) _signCtx.clearRect(0, 0, _signCanvas.width, _signCanvas.height);
}

function isCanvasEmpty() {
    if (!_signCanvas) return true;
    const data = _signCtx.getImageData(0, 0, _signCanvas.width, _signCanvas.height).data;
    for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) return false; }
    return true;
}


// ── Gestion des modes de signature client ──────────────────────
let _clientSignMode = 'draw';
let _uploadedSignatureData = null;

function _switchSignTab(mode) {
    _clientSignMode = mode;
    ['draw', 'upload', 'text'].forEach(m => {
        const tab = document.getElementById('sign-tab-' + m);
        const panel = document.getElementById('sign-panel-' + m);
        if (tab) {
            tab.style.border = m === mode ? '2px solid #1B4F8A' : '2px solid #E2E8F0';
            tab.style.background = m === mode ? '#EBF5FB' : 'white';
            tab.style.color = m === mode ? '#1B4F8A' : '#64748B';
        }
        if (panel) panel.style.display = m === mode ? 'block' : 'none';
    });
    if (mode === 'draw') initSignatureCanvas();
}

function _loadSignatureImage(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('sign-canvas-upload');
            const zone = document.getElementById('sign-upload-zone');
            if (!canvas) return;
            canvas.style.display = 'block';
            if (zone) zone.style.display = 'none';
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Centrer l'image
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.85;
            const x = (canvas.width - img.width * scale) / 2;
            const y = (canvas.height - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            _uploadedSignatureData = canvas.toDataURL('image/png');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function _previewTextSignature(text) {
    const canvas = document.getElementById('sign-canvas-text');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!text.trim()) return;
    ctx.fillStyle = '#0F2D52';
    ctx.font = 'bold 64px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
}

async function submitSignature() {
    if (_clientSignMode === 'draw' && isCanvasEmpty()) {
        showPortalToast('Veuillez dessiner votre signature avant de soumettre.', 'error');
        return;
    }
    const overlay = document.getElementById('vnk-sign-modal');
    const contractId = overlay?._contractId;
    if (!contractId) return;

    const btn = document.getElementById('sign-submit-btn');
    if (btn && btn._submitting) return; // Anti double-soumission
    if (btn) btn._submitting = true;
    if (btn) btn.disabled = true;
    if (btn) btn.textContent = 'Envoi en cours...';

    let signatureData;
    if (_clientSignMode === 'upload') {
        signatureData = _uploadedSignatureData;
        if (!signatureData) { showPortalToast('Veuillez importer une image de signature.', 'error'); return; }
    } else if (_clientSignMode === 'text') {
        const textCanvas = document.getElementById('sign-canvas-text');
        const textInput = document.getElementById('sign-text-input');
        if (!textInput?.value?.trim()) { showPortalToast('Veuillez entrer vos initiales.', 'error'); return; }
        signatureData = textCanvas.toDataURL('image/png');
    } else {
        signatureData = _signCanvas.toDataURL('image/png');
    }
    const token = localStorage.getItem('vnk-token');

    try {
        const r = await fetch('/api/contracts/' + contractId + '/client-sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ signature_data: signatureData })
        });
        const d = await r.json();
        if (d.success) {
            // Fermer canvas panel et modal
            const canvasPanel = document.getElementById('vnk-canvas-panel');
            if (canvasPanel) canvasPanel.remove();
            closeSignatureModal();
            // Message selon si les deux ont signé ou non
            const msg = d.contract?.status === 'signed'
                ? 'Contrat signé des deux parties ! Disponible dans la section Signés.'
                : 'Votre signature a été enregistrée. Le contrat sera finalisé après la signature de VNK.';
            showPortalToast(msg, 'success');
            // Réinitialiser le mode de signature
            _clientSignMode = 'draw';
            _uploadedSignatureData = null;
            // Rafraîchir immédiatement
            const authFetch_ = (url) => fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());
            authFetch_('/api/contracts').then(data => {
                if (data.contracts) { window._allContracts = data.contracts; filterContracts(); }
            }).catch(() => { });
        } else {
            showPortalToast(d.message || 'Erreur lors de la signature.', 'error');
            btn.disabled = false;
            btn.textContent = 'Signer et soumettre';
        }
    } catch (e) {
        showPortalToast('Erreur réseau. Veuillez réessayer.', 'error');
        btn.disabled = false;
        btn.textContent = 'Signer et soumettre';
    }
}

function showPortalToast(msg, type) {
    let t = document.getElementById('portal-toast-sig');
    if (!t) { t = document.createElement('div'); t.id = 'portal-toast-sig'; t.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);padding:0.65rem 1.25rem;border-radius:8px;font-size:0.85rem;font-weight:600;z-index:99999;transition:opacity 0.3s'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.background = type === 'error' ? '#E74C3C' : '#27AE60';
    t.style.color = 'white';
    t.style.opacity = '1';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; }, 3500);
}

function _closeAndOpenChat() {
    _closeModal();
    const panel = document.getElementById('vnk-chat-panel');
    if (panel && !panel.classList.contains('open') && typeof vnkChatToggle === 'function') vnkChatToggle();
}

/* ── Tri ── */
const _sortState = {};
let _sortDropdownOpen = null;

const _sortOptions = {
    quotes: [['date-desc', 'Date (récent)'], ['date-asc', 'Date (ancien)'], ['name-asc', 'Nom A'], ['name-desc', 'Nom Z'], ['amount-desc', 'Montant élevé'], ['amount-asc', 'Montant faible']],
    invoices: [['date-desc', 'Date (récent)'], ['date-asc', 'Date (ancien)'], ['name-asc', 'Nom A'], ['name-desc', 'Nom Z'], ['amount-desc', 'Montant élevé'], ['amount-asc', 'Montant faible']],
    contracts: [['date-desc', 'Date (récent)'], ['date-asc', 'Date (ancien)'], ['name-asc', 'Nom A'], ['name-desc', 'Nom Z']]
};

function toggleSort(type) {
    const existingDropdown = document.getElementById('sort-dropdown-' + type);
    if (existingDropdown) { existingDropdown.remove(); _sortDropdownOpen = null; return; }
    if (_sortDropdownOpen) { const old = document.getElementById('sort-dropdown-' + _sortDropdownOpen); if (old) old.remove(); }
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
        if (!dropdown.contains(e.target) && e.target !== btn) { dropdown.remove(); _sortDropdownOpen = null; document.removeEventListener('click', _close); }
    }), 0);
}

function applySort(type, val) {
    _sortState[type] = val;
    const dropdown = document.getElementById('sort-dropdown-' + type);
    if (dropdown) { dropdown.remove(); _sortDropdownOpen = null; }
    const labelMap = { 'date-desc': 'Date récente', 'date-asc': 'Date ancienne', 'name-asc': 'Nom A', 'name-desc': 'Nom Z', 'amount-desc': 'Montant élevé', 'amount-asc': 'Montant faible' };
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