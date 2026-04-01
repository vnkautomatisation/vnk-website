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

    // Restaurer onglet — priorité à l'ancre URL (liens emails), puis état sauvegardé
    const urlHash = window.location.hash.replace('#', '');
    const hashTabMap = { quotes: 'quotes', contracts: 'contracts', invoices: 'invoices', documents: 'documents', messages: 'messages', mandates: 'mandates' };
    const hashTab = hashTabMap[urlHash];
    const savedTab = (window.VNKState ? window.VNKState.get('tab') : null) || localStorage.getItem('vnk-portal-tab');
    if (hashTab) {
        setTimeout(() => showTab(hashTab), 300);
        // Lien admin messagerie : #messages-{clientId} → pas applicable côté client
        window.history.replaceState(null, '', window.location.pathname); // Nettoyer l'ancre
    } else if (savedTab && savedTab !== 'dashboard') {
        // Migrer l'ancien 'mandates' + subtab requests vers le nouveau tab dédié
        if (savedTab === 'mandates' && localStorage.getItem('vnk-portal-mandates-subtab') === 'requests') {
            showTab('my-requests');
        } else {
            showTab(savedTab);
        }
    }
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
        // Toujours rafraîchir les RDV en arrière-plan (lien peut être mis à jour par admin)
        loadMyAppointments().catch(() => { });
    } catch (error) { console.log('Data loading error:', error); }
}


/* ═══════════════════════════════════════════
   PAGINATION — système universel
   Affiche 25 items par page sur tous les onglets
═══════════════════════════════════════════ */
const PAGE_SIZE = 10;
const _PAGE_SIZE = PAGE_SIZE;
const _pageState = { quotes: 1, invoices: 1, mandates: 1, contracts: 1, documents: 1 };

// Taille de page dynamique — cartes timeline = 6, liste compacte = 15, reste = 10
function _getPageSize(tab) {
    if (tab === 'mandates') return _mandateView === 'list' ? 10 : 12;
    return PAGE_SIZE;
}

function _paginate(arr, tab) {
    const page = _pageState[tab] || 1;
    const total = arr.length;
    const ps = _getPageSize(tab);
    const pages = Math.max(1, Math.ceil(total / ps));
    const slice = arr.slice((page - 1) * ps, page * ps);
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
    else if (tab === 'mandates') { const old = document.getElementById('_vnk-mandate-panel'); if (old) old.remove(); filterMandates(); }
    else if (tab === 'booking') { setTimeout(initBookingTab, 50); }
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
    let _reqSig = '';

    async function _poll() {
        if (!_pollingActive) return;

        // 1. Poll principal SEULEMENT si pas sur my-requests (évite le blink)
        const myReqActive = document.getElementById('tab-my-requests')?.classList.contains('active');
        if (!myReqActive) {
            await loadAllData().catch(() => { });
        }

        // 2. Vérification silencieuse des statuts demandes
        try {
            const token = localStorage.getItem('vnk-token');
            const r = await fetch('/api/messages', {
                headers: { 'Authorization': 'Bearer ' + token, 'Cache-Control': 'no-store' }
            });
            const d = await r.json();
            if (d.success) {
                const reqs = (d.messages || []).filter(m =>
                    m.content && m.content.includes('NOUVELLE DEMANDE DE PROJET') && m.sender === 'client'
                );
                // Badge sidebar
                const hasNew = reqs.some(r => r.request_status === 'in_progress' || r.request_status === 'converted');
                const dot = document.getElementById('dot-my-requests');
                if (dot) dot.style.display = hasNew ? 'block' : 'none';

                // Comparer signature — ne rien faire si rien n'a changé
                const sig = reqs.map(m => m.id + ':' + (m.request_status || 'new')).join(',');
                if (sig !== _reqSig) {
                    _reqSig = sig;
                    if (myReqActive) {
                        // Patch doux : mettre à jour seulement les badges de statut
                        const statusCfg = {
                            new: { label: 'Reçue', color: '#1B4F8A', bg: '#EBF5FB', desc: "Votre demande a été reçue. Nous l'analysons." },
                            in_progress: { label: 'En traitement', color: '#D97706', bg: '#FEF3C7', desc: 'Un technicien VNK travaille sur votre demande.' },
                            converted: { label: 'Devis en cours', color: '#059669', bg: '#D1FAE5', desc: 'Un devis est en cours de préparation pour vous.' },
                            closed: { label: 'Traitée', color: '#64748B', bg: '#F1F5F9', desc: 'Votre demande a été traitée. Vérifiez vos devis.' }
                        };
                        let needFullRender = false;
                        reqs.forEach(req => {
                            const st = req.request_status || 'new';
                            const sc = statusCfg[st] || statusCfg.new;
                            const badge = document.querySelector('[data-req-id="' + (req.message_id || req.id) + '"] [data-role="status-badge"]');
                            if (badge) {
                                badge.style.background = sc.bg;
                                badge.innerHTML = '<span style="font-size:0.72rem;font-weight:700;color:' + sc.color + '">' + sc.label + '</span>'
                                    + '<span style="font-size:0.67rem;color:' + sc.color + ';opacity:0.8">— ' + sc.desc + '</span>';
                            } else {
                                needFullRender = true;
                            }
                        });
                        if (needFullRender) loadMyRequests().catch(() => { });
                    }
                }
            }
        } catch (e) { }

        _pollingInterval = setTimeout(_poll, document.hidden ? 30000 : (myReqActive ? 5000 : 10000));
    }
    _pollingInterval = setTimeout(_poll, 2000);
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
        case 'request_status_updated':
            // Statut d'une demande mis à jour par l'admin
            if (window._lastMyRequests) {
                const req = window._lastMyRequests.find(r => (r.message_id || r.id) === data.message_id);
                if (req) req.request_status = data.status;
            }
            loadMyRequests();
            const stLabels = { in_progress: 'En traitement', converted: 'Devis en cours', closed: 'Traitée' };
            if (stLabels[data.status]) {
                pushPortalNotif('mandate', 'Votre demande est maintenant : ' + stLabels[data.status], null);
                const badge = document.getElementById('badge-my-requests');
                if (badge) badge.style.display = 'inline-block';
                if (typeof vnkNotif !== 'undefined') vnkNotif.sound();
            }
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
        'my-requests': 'Mes demandes',
        mandates: 'Mes mandats',
        quotes: 'Mes devis',
        invoices: 'Mes factures',
        contracts: 'Mes contrats',
        documents: 'Mes documents',
        booking: 'Réserver un appel'
    };
    const mobileTitle = document.getElementById('mobile-tab-title');
    if (mobileTitle) mobileTitle.textContent = titles[tabName] || '';

    // 5b. Synchroniser bottom nav
    document.querySelectorAll('.portal-bnav-item').forEach(b => b.classList.remove('active'));
    const bnav = document.getElementById('bnav-' + tabName);
    if (bnav) bnav.classList.add('active');

    // 6. Persister l'onglet
    localStorage.setItem('vnk-portal-tab', tabName);
    // Réinitialiser le sous-onglet mandats quand on quitte
    if (tabName !== 'mandates') {
        localStorage.removeItem('vnk-portal-mandates-subtab');
    }

    // 7. Charger le profil quand on l'ouvre — données fraîches
    if (tabName === 'profile') {
        renderProfile(JSON.parse(localStorage.getItem('vnk-user') || '{}'));
        _refreshUserFromAPI().then(() => {
            renderProfile(JSON.parse(localStorage.getItem('vnk-user') || '{}'));
        });
    }

    // 7b. Mes demandes — tab dédié
    if (tabName === 'my-requests') {
        loadMyRequests();
        // Effacer le dot quand ouvert
        const dot = document.getElementById('dot-my-requests');
        if (dot) dot.style.display = 'none';
    }

    // 8b. Booking — initialiser le calendrier
    if (tabName === 'booking') {
        setTimeout(initBookingTab, 50);
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
                <div class="profile-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
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
                <div class="profile-edit-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
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
                <div class="profile-pw-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;align-items:end;margin-bottom:1rem">
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
    _renderMandatesKpis(list);
    if (status !== 'all') list = list.filter(m => m.status === status || (status === 'active' && m.status === 'in_progress'));
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

// ── Vue mandats : 'cards' (timeline) ou 'list' (compacte) ──
let _mandateView = 'cards';

function setMandateView(v) {
    if (_mandateView === v) return;
    _mandateView = v;
    _pageState.mandates = 1; // reset page au changement de vue

    // Sync boutons toggle
    const btnCards = document.getElementById('mandate-view-cards');
    const btnList = document.getElementById('mandate-view-list');
    if (btnCards) {
        btnCards.style.background = v === 'cards' ? '#1B4F8A' : 'transparent';
        btnCards.style.color = v === 'cards' ? 'white' : '#94A3B8';
    }
    if (btnList) {
        btnList.style.background = v === 'list' ? '#1B4F8A' : 'transparent';
        btnList.style.color = v === 'list' ? 'white' : '#94A3B8';
    }
    filterMandates();
}

function renderMandates(mandates) {
    const list = document.getElementById('mandates-list');
    if (!list) return;

    if (!mandates || !mandates.length) {
        list.innerHTML = '<div style="text-align:center;padding:3rem 1rem">'
            + '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5" stroke-linecap="round" style="display:block;margin:0 auto 0.75rem"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
            + '<div style="font-size:0.9rem;font-weight:600;color:#475569">Aucun mandat trouvé</div>'
            + '<div style="font-size:0.78rem;color:#94A3B8;margin-top:0.3rem">Essayez de changer le filtre</div></div>';
        return;
    }

    const stl = { active: 'En cours', in_progress: 'En cours', pending: 'En attente', completed: 'Complété', paused: 'En pause' };
    const stBg = { active: '#EBF5FB', in_progress: '#EBF5FB', pending: '#FFFBEB', completed: '#ECFDF5', paused: '#F1F5F9' };
    const stFg = { active: '#1B4F8A', in_progress: '#1B4F8A', pending: '#92400E', completed: '#065F46', paused: '#475569' };
    const svl = { 'plc-support': 'Support PLC', audit: 'Audit technique', documentation: 'Documentation', refactoring: 'Refactorisation PLC' };
    const STEPS = ['Démarrage', 'Diagnostic', 'Intervention', 'Tests', 'Livraison'];
    const STEP_PCTS = [0, 25, 50, 75, 100];

    // ════════════════════════════════════════
    // VUE CARTES — timeline complète, 6/page
    // ════════════════════════════════════════
    if (_mandateView === 'cards') {
        const cards = mandates.map(function (m) {
            const prog = m.progress || 0;
            const st = prog >= 100 ? 'completed' : (m.status || 'pending');
            const label = stl[st] || st;
            const bg = stBg[st] || '#F1F5F9';
            const fg = stFg[st] || '#475569';
            const isLate = m.end_date && new Date(m.end_date) < new Date() && prog < 100;
            const progColor = prog >= 100 ? '#059669' : '#1B4F8A';

            let currentStep = 0;
            STEP_PCTS.forEach(function (p, i) { if (prog >= p) currentStep = i; });

            const stepsHtml = STEPS.map(function (stepLabel, i) {
                const done = prog >= STEP_PCTS[i];
                const current = i === currentStep && prog < 100;
                const dotBg = done ? progColor : 'white';
                const dotBorder = done ? progColor : (current ? '#1B4F8A' : '#E2E8F0');
                const inner = done
                    ? '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
                    : (current ? '<div style="width:6px;height:6px;border-radius:50%;background:#1B4F8A"></div>' : '');
                const lc = done ? '#0F172A' : (current ? '#1B4F8A' : '#94A3B8');
                const lw = (done || current) ? '600' : '400';
                return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;position:relative;z-index:1">'
                    + '<div style="width:20px;height:20px;border-radius:50%;background:' + dotBg + ';border:2px solid ' + dotBorder + ';display:flex;align-items:center;justify-content:center">' + inner + '</div>'
                    + '<span style="font-size:0.6rem;color:' + lc + ';font-weight:' + lw + ';text-align:center;line-height:1.3;white-space:nowrap">' + stepLabel + '</span>'
                    + '</div>';
            }).join('');

            const lineW = Math.min(100, Math.round(prog));
            const fmtDate = function (d) { return new Date(d).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' }); };

            return '<div class="vnk-mandate-card" data-id="' + m.id + '" onclick="_openPortalMandateDetail(' + m.id + ')" '
                + 'style="background:white;border:1px solid ' + (isLate ? '#FECACA' : '#E8EEF6') + ';border-radius:12px;padding:1rem 1.1rem 0.9rem;cursor:pointer;transition:border-color .15s,box-shadow .15s" '
                + 'onmouseenter="this.style.borderColor=\'' + (isLate ? '#F87171' : '#1B4F8A') + '\';this.style.boxShadow=\'0 2px 10px rgba(27,79,138,0.08)\'" '
                + 'onmouseleave="this.style.borderColor=\'' + (isLate ? '#FECACA' : '#E8EEF6') + '\';this.style.boxShadow=\'\'">'

                // Titre + badges
                + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;margin-bottom:0.6rem">'
                + '<div style="min-width:0;flex:1">'
                + '<div style="font-weight:700;font-size:0.9rem;color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + m.title + '</div>'
                + '<div style="font-size:0.7rem;color:#94A3B8;margin-top:2px">' + (svl[m.service_type] || m.service_type || '') + (m.mandate_number ? ' · ' + m.mandate_number : '') + '</div>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:0.35rem;flex-shrink:0">'
                + (isLate ? '<span style="font-size:0.66rem;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:#DC2626">En retard</span>' : '')
                + '<span style="font-size:0.66rem;font-weight:600;padding:2px 9px;border-radius:20px;background:' + bg + ';color:' + fg + '">' + label + '</span>'
                + '</div></div>'

                // Barre progression
                + '<div style="display:flex;align-items:center;gap:0.65rem;margin-bottom:0.75rem">'
                + '<div style="flex:1;height:4px;background:#F1F5F9;border-radius:2px;overflow:hidden"><div style="height:100%;width:' + prog + '%;background:' + progColor + ';border-radius:2px;transition:width .4s"></div></div>'
                + '<span style="font-size:0.75rem;font-weight:700;color:' + progColor + ';min-width:30px;text-align:right">' + prog + '%</span>'
                + '</div>'

                // Timeline étapes
                + '<div style="position:relative;padding:0 10px;margin-bottom:0.75rem">'
                + '<div style="position:absolute;top:10px;left:10px;right:10px;height:1.5px;background:#E2E8F0"></div>'
                + '<div style="position:absolute;top:10px;left:10px;height:1.5px;background:' + progColor + ';width:' + lineW + '%;max-width:calc(100% - 20px);transition:width .4s"></div>'
                + '<div style="display:flex;justify-content:space-between">' + stepsHtml + '</div>'
                + '</div>'

                // Dates + lien
                + '<div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #F8FAFC;padding-top:0.6rem">'
                + '<div style="display:flex;gap:1.25rem">'
                + (m.start_date ? '<div><div style="font-size:0.58rem;color:#94A3B8;text-transform:uppercase;font-weight:700;letter-spacing:0.04em">Début</div><div style="font-size:0.75rem;font-weight:600;color:#334155">' + fmtDate(m.start_date) + '</div></div>' : '')
                + (m.end_date ? '<div><div style="font-size:0.58rem;color:' + (isLate ? '#DC2626' : '#94A3B8') + ';text-transform:uppercase;font-weight:700;letter-spacing:0.04em">Fin est.</div><div style="font-size:0.75rem;font-weight:600;color:' + (isLate ? '#DC2626' : '#334155') + '">' + fmtDate(m.end_date) + '</div></div>' : '')
                + '</div>'
                + '<div style="font-size:0.72rem;color:#1B4F8A;font-weight:600;display:flex;align-items:center;gap:3px">Détails<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></div>'
                + '</div>'
                + '</div>';
        }).join('');
        list.innerHTML = '<div class="mandate-cards-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.65rem;padding:0.25rem 0">' + cards + '</div>';
        return;
    }

    // ════════════════════════════════════════
    // VUE LISTE — compacte, scalable, 15/page
    // ════════════════════════════════════════
    const rows = mandates.map(function (m) {
        const prog = m.progress || 0;
        const st = prog >= 100 ? 'completed' : (m.status || 'pending');
        const label = stl[st] || st;
        const bg = stBg[st] || '#F1F5F9';
        const fg = stFg[st] || '#475569';
        const isLate = m.end_date && new Date(m.end_date) < new Date() && prog < 100;
        const progColor = prog >= 100 ? '#059669' : '#1B4F8A';

        // Étape courante
        let stepLabel = 'Démarrage';
        STEP_PCTS.forEach(function (p, i) { if (prog >= p) stepLabel = STEPS[i]; });
        const nextStep = prog < 100 ? (STEPS[STEP_PCTS.findIndex(function (p) { return p > prog; })] || 'Livraison') : null;

        return '<div class="vnk-mandate-card mandate-list-row" data-id="' + m.id + '" onclick="_openPortalMandateDetail(' + m.id + ')" '
            + 'style="display:grid;grid-template-columns:2fr 220px 1.5fr auto;align-items:center;gap:2rem;padding:1rem 1.5rem;border-bottom:1px solid #F1F5F9;cursor:pointer;transition:background .1s;min-height:72px" '
            + 'onmouseenter="this.style.background=\'#F8FAFC\'" onmouseleave="this.style.background=\'white\'">'

            // Col 1 : titre + retard + service
            + '<div style="min-width:0">'
            + '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:5px">'
            + '<div style="font-weight:700;font-size:0.95rem;color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + m.title + '</div>'
            + (isLate ? '<span style="font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:#DC2626;flex-shrink:0">⚠ Retard</span>' : '')
            + '</div>'
            + '<div style="font-size:0.75rem;color:#94A3B8;font-weight:500">' + (svl[m.service_type] || m.service_type || '') + '</div>'
            + '</div>'

            // Col 2 : barre de progression + %
            + '<div style="display:flex;align-items:center;gap:0.65rem">'
            + '<div style="flex:1;height:6px;background:#F1F5F9;border-radius:3px;overflow:hidden"><div style="height:100%;width:' + prog + '%;background:' + progColor + ';border-radius:3px;transition:width .4s"></div></div>'
            + '<span style="font-size:0.78rem;font-weight:700;color:' + progColor + ';flex-shrink:0;min-width:32px">' + prog + '%</span>'
            + '</div>'

            // Col 3 : étape courante · suivante + dates
            + '<div style="min-width:0">'
            + '<div style="font-size:0.75rem;color:#475569;margin-bottom:4px">'
            + (nextStep ? 'Étape : <strong style="color:#1B4F8A">' + stepLabel + '</strong>&nbsp;&nbsp;·&nbsp;&nbsp;Suivante : ' + nextStep : '<strong style="color:#059669">✓ Terminé</strong>')
            + '</div>'
            + '<div style="font-size:0.72rem;color:#94A3B8">'
            + (m.start_date ? 'Début ' + new Date(m.start_date).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
            + (m.start_date && m.end_date ? '&nbsp;&nbsp;·&nbsp;&nbsp;' : '')
            + (m.end_date ? '<span style="color:' + (isLate ? '#DC2626' : '#94A3B8') + ';font-weight:' + (isLate ? '700' : '400') + '">Fin ' + new Date(m.end_date).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' }) + '</span>' : '')
            + '</div>'
            + '</div>'

            // Col 4 : badge statut
            + '<div style="display:flex;align-items:center;justify-content:flex-end;flex-shrink:0">'
            + '<span style="font-size:0.72rem;font-weight:700;padding:4px 14px;border-radius:20px;background:' + bg + ';color:' + fg + ';white-space:nowrap">' + label + '</span>'
            + '</div>'

            + '</div>';
    }).join('');

    list.innerHTML = '<div style="background:white;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">' + rows + '</div>';
}

// Libellés statut et service

function _renderMandatesKpis(all) {
    const bar = document.getElementById('portal-mandates-kpis');
    if (!bar) return;
    const active = all.filter(m => (m.status === 'active' || m.status === 'in_progress') && m.progress < 100).length;
    const completed = all.filter(m => m.progress === 100 || m.status === 'completed').length;
    const late = all.filter(m => m.end_date && new Date(m.end_date) < new Date() && (m.progress || 0) < 100).length;
    const kpis = [
        { label: 'En cours', value: active, accent: '#1B4F8A', bg: '#EBF5FB' },
        { label: 'Complétés', value: completed, accent: '#059669', bg: '#ECFDF5' },
        { label: 'En retard', value: late, accent: late > 0 ? '#DC2626' : '#059669', bg: late > 0 ? '#FEF2F2' : '#ECFDF5' },
    ];
    bar.innerHTML = kpis.map(k =>
        '<div style="background:' + k.bg + ';border:1px solid rgba(0,0,0,0.05);border-radius:10px;padding:0.65rem 0.9rem;display:flex;align-items:center;gap:0.6rem">'
        + '<div><div style="font-size:1.15rem;font-weight:700;color:' + k.accent + ';line-height:1">' + k.value + '</div>'
        + '<div style="font-size:0.65rem;font-weight:600;color:' + k.accent + ';opacity:0.75;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px">' + k.label + '</div></div>'
        + '</div>'
    ).join('');
}

function _openPortalMandateDetail(id) {
    const m = (window._allMandates || []).find(x => x.id === id);
    if (!m) return;

    // Highlight carte sélectionnée
    document.querySelectorAll('.vnk-mandate-card').forEach(r => {
        r.style.borderColor = '#E8EEF6';
        r.style.boxShadow = '';
    });
    const sel = document.querySelector('.vnk-mandate-card[data-id="' + id + '"]');
    if (sel) { sel.style.borderColor = '#1B4F8A'; sel.style.boxShadow = '0 0 0 2px rgba(27,79,138,0.1)'; }

    const svl = { 'plc-support': 'Support PLC', audit: 'Audit technique', documentation: 'Documentation', refactoring: 'Refactorisation PLC' };
    const stl = { active: 'En cours', in_progress: 'En cours', pending: 'En attente', completed: 'Complété', paused: 'En pause' };
    const stBg = { active: '#EBF5FB', in_progress: '#EBF5FB', pending: '#FFFBEB', completed: '#ECFDF5', paused: '#F1F5F9' };
    const stFg = { active: '#1B4F8A', in_progress: '#1B4F8A', pending: '#92400E', completed: '#065F46', paused: '#475569' };
    const prog = m.progress || 0;
    const st = prog >= 100 ? 'completed' : (m.status || 'pending');
    const isLate = m.end_date && new Date(m.end_date) < new Date() && prog < 100;
    const progColor = prog >= 100 ? '#059669' : '#1B4F8A';

    const STEPS = ['Démarrage', 'Diagnostic', 'Intervention', 'Tests', 'Livraison'];
    const STEP_PCTS = [0, 25, 50, 75, 100];

    let currentStep = 0;
    STEP_PCTS.forEach(function (p, i) { if (prog >= p) currentStep = i; });

    // HTML jalons détaillés pour le panel
    const milestonesHtml = STEPS.map(function (label, i) {
        const done = prog >= STEP_PCTS[i];
        const current = i === currentStep && prog < 100;
        return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.35rem 0;border-bottom:1px solid #F8FAFC">'
            + '<div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;'
            + 'background:' + (done ? progColor : (current ? 'white' : 'white')) + ';'
            + 'border:2px solid ' + (done ? progColor : (current ? '#1B4F8A' : '#E2E8F0')) + '">'
            + (done ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
                : (current ? '<div style="width:6px;height:6px;border-radius:50%;background:#1B4F8A"></div>' : ''))
            + '</div>'
            + '<span style="font-size:0.8rem;font-weight:' + ((done || current) ? '600' : '400') + ';color:' + (done ? '#0F172A' : (current ? '#1B4F8A' : '#94A3B8')) + '">' + label + '</span>'
            + '<span style="margin-left:auto;font-size:0.67rem;color:#94A3B8">' + STEP_PCTS[i] + '%</span>'
            + '</div>';
    }).join('');

    const closeBtn = 'document.getElementById(\'portal-mandate-side-panel\').style.display=\'none\';'
        + 'document.querySelectorAll(\'.vnk-mandate-card\').forEach(function(r){r.style.borderColor=\'#E8EEF6\';r.style.boxShadow=\'\'})';

    // ── Desktop : panel latéral sticky ──
    const sidePanel = document.getElementById('portal-mandate-side-panel');
    if (sidePanel && window.innerWidth >= 900) {
        sidePanel.style.display = 'block';
        sidePanel.innerHTML =
            // Header
            '<div style="background:#0F2D52;padding:1rem 1.1rem;display:flex;align-items:flex-start;justify-content:space-between">'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-weight:700;font-size:0.88rem;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.35">' + m.title + '</div>'
            + '<div style="font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:3px">' + (svl[m.service_type] || '') + (m.mandate_number ? ' · ' + m.mandate_number : '') + '</div>'
            + '</div>'
            + '<button onclick="' + closeBtn + '" style="background:none;border:none;color:rgba(255,255,255,0.45);cursor:pointer;font-size:1.2rem;flex-shrink:0;padding:0;margin-left:0.5rem;line-height:1;transition:color .15s" onmouseenter="this.style.color=\'white\'" onmouseleave="this.style.color=\'rgba(255,255,255,0.45)\'">×</button>'
            + '</div>'

            + '<div style="padding:1rem 1.1rem;overflow-y:auto">'

            // Statut
            + '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:1rem;flex-wrap:wrap">'
            + '<span style="font-size:0.68rem;font-weight:600;padding:2px 9px;border-radius:20px;background:' + stBg[st] + ';color:' + stFg[st] + '">' + (stl[st] || st) + '</span>'
            + (isLate ? '<span style="font-size:0.68rem;font-weight:700;padding:2px 9px;border-radius:20px;background:#FEF2F2;color:#DC2626">En retard</span>' : '')
            + '</div>'

            // Progression
            + '<div style="margin-bottom:1rem">'
            + '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:0.5rem">Progression</div>'
            + '<div style="display:flex;align-items:center;gap:0.6rem">'
            + '<div style="flex:1;height:6px;background:#F1F5F9;border-radius:3px;overflow:hidden">'
            + '<div style="height:100%;width:' + prog + '%;background:' + progColor + ';border-radius:3px;transition:width .4s ease"></div>'
            + '</div>'
            + '<span style="font-size:0.9rem;font-weight:700;color:' + progColor + ';min-width:36px;text-align:right">' + prog + '%</span>'
            + '</div></div>'

            // Étapes
            + '<div style="margin-bottom:1rem">'
            + '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:0.5rem">Étapes du projet</div>'
            + milestonesHtml
            + '</div>'

            // Dates
            + '<div class="mandate-dates-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem">'
            + '<div style="background:#F8FAFC;border-radius:8px;padding:0.55rem 0.7rem">'
            + '<div style="font-size:0.6rem;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px">Début</div>'
            + '<div style="font-size:0.82rem;font-weight:600;color:#1E293B">' + (m.start_date ? new Date(m.start_date).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—') + '</div>'
            + '</div>'
            + '<div style="background:' + (isLate ? '#FEF2F2' : '#F8FAFC') + ';border-radius:8px;padding:0.55rem 0.7rem">'
            + '<div style="font-size:0.6rem;font-weight:700;color:' + (isLate ? '#DC2626' : '#94A3B8') + ';text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px">Fin est.</div>'
            + '<div style="font-size:0.82rem;font-weight:600;color:' + (isLate ? '#DC2626' : '#1E293B') + '">' + (m.end_date ? new Date(m.end_date).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—') + '</div>'
            + '</div></div>'

            // Description
            + (m.description ? '<div style="margin-bottom:1rem"><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:0.4rem">Description</div><div style="font-size:0.82rem;color:#334155;line-height:1.55">' + m.description + '</div></div>' : '')

            // Note VNK
            + (m.notes ? '<div style="background:#FFFBEB;border-radius:8px;padding:0.65rem 0.75rem;border-left:3px solid #D97706;margin-bottom:1rem">'
                + '<div style="font-size:0.65rem;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px">Mise à jour VNK</div>'
                + '<div style="font-size:0.82rem;color:#334155;line-height:1.5">' + m.notes + '</div>'
                + '</div>' : '')

            // CTA
            + '<div style="padding-top:0.875rem;border-top:1px solid #F1F5F9">'
            + '<button onclick="_vnkOpenChatForMandate(\'' + m.title.replace(/'/g, "\\'") + '\')" '
            + 'style="width:100%;padding:0.65rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:background .15s" '
            + 'onmouseenter="this.style.background=\'#0F2D52\'" onmouseleave="this.style.background=\'#1B4F8A\'">'
            + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
            + 'Envoyer un message à VNK'
            + '</button>'
            + '</div>'
            + '</div>';
        return;
    }

    // ── Mobile : bottom sheet ──
    _vnkOpenMandateDetail({ stopPropagation: function () { } }, id);
}

// renderMandates remplacée ci-dessus — stub de compatibilité
function _goPageMandates(p) { _pageMandates = p; filterMandates(); }

function _vnkOpenChatForMandate(mandateTitle) {
    // Ouvrir le chat widget s'il n'est pas déjà ouvert
    const panel = document.getElementById('vnk-chat-panel');
    const isAlreadyOpen = panel && panel.classList.contains('open');
    if (!isAlreadyOpen && typeof vnkChatToggle === 'function') {
        vnkChatToggle();
    }
    // Fermer le panel latéral pour dégager la vue
    const sidePanel = document.getElementById('portal-mandate-side-panel');
    if (sidePanel) sidePanel.style.display = 'none';
    // Pré-remplir l'input avec le contexte du mandat
    setTimeout(function () {
        const input = document.getElementById('vnk-chat-input');
        if (input) {
            const prefix = mandateTitle ? 'Concernant le mandat « ' + mandateTitle + ' » : ' : '';
            input.value = prefix;
            input.focus();
            // Positionner le curseur à la fin
            input.selectionStart = input.selectionEnd = input.value.length;
            // Auto-resize textarea
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        }
        // Scroll vers le chat
        const bubble = document.getElementById('vnk-chat-bubble-btn');
        if (bubble) bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 350);
}

function _vnkOpenMandateDetail(e, id) {
    e.stopPropagation();
    const m = (window._allMandates || []).find(x => x.id === id);
    if (!m) return;

    // Supprimer panel existant
    const old = document.getElementById('_vnk-mandate-panel');
    if (old) old.remove();

    const svc = { 'plc-support': 'Support PLC', 'audit': 'Audit technique', 'documentation': 'Documentation industrielle', 'refactoring': 'Refactorisation PLC' };
    const stl = { active: 'En cours', in_progress: 'En cours', pending: 'En attente', completed: 'Complété', paused: 'En pause' };
    const stc = { active: '#1B4F8A', in_progress: '#1B4F8A', pending: '#D97706', completed: '#27AE60', paused: '#94A3B8' };
    const prog = m.progress || 0;
    const realLabel = prog === 100 ? 'Complété' : (stl[m.status] || m.status);
    const realColor = prog === 100 ? '#27AE60' : (stc[m.status] || '#94A3B8');

    const milestones = [
        { label: 'Démarrage', pct: 0, done: prog >= 0 },
        { label: 'Diagnostic', pct: 25, done: prog >= 25 },
        { label: 'Intervention', pct: 50, done: prog >= 50 },
        { label: 'Tests', pct: 75, done: prog >= 75 },
        { label: 'Livraison', pct: 100, done: prog >= 100 },
    ];

    const panel = document.createElement('div');
    panel.id = '_vnk-mandate-panel';
    panel.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.4)';
    panel.innerHTML = `
        <div style="background:white;border-radius:16px 16px 0 0;width:100%;max-width:640px;max-height:85vh;overflow-y:auto;padding-bottom:env(safe-area-inset-bottom)">
            <div style="padding:1.25rem 1.5rem 1rem;border-bottom:1px solid #E2E8F0;display:flex;align-items:flex-start;gap:1rem">
                <div style="flex:1">
                    <div style="font-weight:700;font-size:1rem;color:#1a1a18">${m.title}</div>
                    <div style="font-size:0.78rem;color:#94A3B8;margin-top:2px">${svc[m.service_type] || m.service_type || ''} · MND-${m.id}</div>
                </div>
                <button onclick="document.getElementById('_vnk-mandate-panel').remove()" style="background:none;border:none;font-size:1.4rem;color:#94A3B8;cursor:pointer;padding:0;line-height:1">×</button>
            </div>
            <div style="padding:1.25rem 1.5rem">
                <!-- Statut + progression -->
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem">
                    <span style="font-size:0.75rem;font-weight:700;padding:4px 12px;border-radius:20px;background:${realColor}18;color:${realColor}">${realLabel}</span>
                    <span style="font-size:0.88rem;font-weight:800;color:${prog === 100 ? '#27AE60' : '#1B4F8A'};margin-left:auto">${prog}%</span>
                </div>
                <div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;margin-bottom:1.5rem">
                    <div style="height:100%;width:${prog}%;background:${prog === 100 ? '#27AE60' : 'linear-gradient(90deg,#1B4F8A,#2E75B6)'};border-radius:4px;transition:width .4s"></div>
                </div>

                <!-- Jalons -->
                <div style="margin-bottom:1.5rem">
                    <div style="font-size:0.72rem;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.75rem">Étapes du projet</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;position:relative">
                        <div style="position:absolute;top:10px;left:10px;right:10px;height:2px;background:#E2E8F0;z-index:0"></div>
                        <div style="position:absolute;top:10px;left:10px;height:2px;background:#1B4F8A;z-index:0;width:${Math.min(100, Math.max(0, (prog / 100) * (100 - 0)))}%;transition:width .4s"></div>
                        ${milestones.map(j => `
                        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;z-index:1;min-width:52px">
                            <div style="width:20px;height:20px;border-radius:50%;background:${j.done ? '#1B4F8A' : 'white'};border:2px solid ${j.done ? '#1B4F8A' : '#E2E8F0'};display:flex;align-items:center;justify-content:center">
                                ${j.done ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                            </div>
                            <span style="font-size:0.65rem;color:${j.done ? '#1B4F8A' : '#94A3B8'};font-weight:${j.done ? '700' : '400'};text-align:center">${j.label}</span>
                        </div>`).join('')}
                    </div>
                </div>

                <!-- Dates -->
                <div class="mandate-detail-dates" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.25rem">
                    <div style="background:#F8FAFC;border-radius:8px;padding:0.75rem">
                        <div style="font-size:0.65rem;font-weight:700;color:#94A3B8;text-transform:uppercase;margin-bottom:3px">Date de début</div>
                        <div style="font-size:0.88rem;font-weight:600;color:#1a1a18">${m.start_date ? new Date(m.start_date).toLocaleDateString('fr-CA') : '—'}</div>
                    </div>
                    <div style="background:#F8FAFC;border-radius:8px;padding:0.75rem">
                        <div style="font-size:0.65rem;font-weight:700;color:#94A3B8;text-transform:uppercase;margin-bottom:3px">Fin estimée</div>
                        <div style="font-size:0.88rem;font-weight:600;color:#1a1a18">${m.end_date ? new Date(m.end_date).toLocaleDateString('fr-CA') : '—'}</div>
                    </div>
                </div>

                <!-- Description -->
                ${m.description ? `<div style="margin-bottom:1.25rem">
                    <div style="font-size:0.72rem;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.4rem">Description du projet</div>
                    <div style="font-size:0.85rem;color:#334155;line-height:1.6">${m.description}</div>
                </div>` : ''}

                <!-- Note VNK -->
                ${m.notes ? `<div style="background:rgba(224,120,32,0.08);border-radius:10px;padding:0.85rem;border-left:3px solid #E07820;margin-bottom:1rem">
                    <div style="font-size:0.7rem;font-weight:700;color:#E07820;text-transform:uppercase;margin-bottom:3px">Mise à jour de VNK</div>
                    <div style="font-size:0.85rem;color:#334155">${m.notes}</div>
                </div>` : ''}
            </div>
        </div>`;
    panel.addEventListener('click', function (ev) { if (ev.target === panel) panel.remove(); });
    document.body.appendChild(panel);
}
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
            (isPending ? '<button class="vnk-action-btn primary" onclick="openQuoteSignModal(' + q.id + ')">Accepter</button>' : '<button class="vnk-action-btn" onclick="openQuoteViewModal(' + q.id + ',\'' + q.quote_number + '\')">Voir</button>') +
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
            (inv.status === 'unpaid' || inv.status === 'overdue'
                ? '<button class="btn btn-primary btn-sm" onclick="previewInvoicePDF(' + inv.id + ',' + inv.amount_ttc + ')">Payer</button>'
                : '<button class="btn btn-outline btn-sm" onclick="previewInvoicePDF(' + inv.id + ',0)">Voir</button>') +
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
                ${!isPaid
                ? '<button class="vnk-action-btn primary" onclick="previewInvoicePDF(' + inv.id + ',' + inv.amount_ttc + ')">Payer</button>'
                : '<button class="vnk-action-btn" onclick="previewInvoicePDF(' + inv.id + ',0)">Voir</button>'
            }
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
                : '<button class="vnk-action-btn" onclick="openSignatureModal(' + c.id + ')">Voir</button>'
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

    let apiUrl = null;
    if (doc._action === 'pdf-invoice' && doc._invoice_id) apiUrl = '/api/invoices/' + doc._invoice_id + '/pdf';
    else if (doc._action === 'pdf-quote' && doc._quote_id) apiUrl = '/api/quotes/' + doc._quote_id + '/pdf';
    else if (doc._action === 'pdf-contract' && doc._contract_id) apiUrl = '/api/contracts/' + doc._contract_id + '/pdf';
    else if (doc._invoice_id) apiUrl = '/api/invoices/' + doc._invoice_id + '/pdf';
    else if (doc._quote_id) apiUrl = '/api/quotes/' + doc._quote_id + '/pdf';
    else if (doc._contract_id) apiUrl = '/api/contracts/' + doc._contract_id + '/pdf';
    else if (doc.file_url) apiUrl = doc.file_url;
    else if (!doc._synth && doc.id) apiUrl = '/api/documents/' + doc.id;  // doc DB sans file_url

    if (!apiUrl) {
        showPortalToast('Ce document n\'a pas de fichier joint.', 'error');
        return;
    }

    _markDocRead(docId);

    const token = localStorage.getItem('vnk-token');
    const fname = doc.file_name || doc.title + '.pdf';
    const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-CA') : '';
    const isImg = /\.(png|jpg|jpeg|gif|webp)$/i.test(apiUrl) || (doc.file_type && /^(png|jpg|jpeg|gif|webp)$/i.test(doc.file_type));

    // Utiliser fetch avec token pour éviter le 403
    const fetchDoc = token
        ? fetch(apiUrl, { headers: { 'Authorization': 'Bearer ' + token } })
        : fetch(apiUrl);

    fetchDoc
        .then(r => { if (!r.ok) throw new Error('Accès refusé (' + r.status + ')'); return r.blob(); })
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const ex = document.getElementById('doc-viewer-modal'); if (ex) ex.remove();

            const modal = document.createElement('div');
            modal.id = 'doc-viewer-modal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.82);display:flex;align-items:center;justify-content:center;padding:0.5rem';

            const wrap = document.createElement('div');
            wrap.style.cssText = 'background:white;border-radius:12px;width:min(1200px,98vw);height:97vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,0.5)';

            const hdr = document.createElement('div');
            hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.9rem 1.25rem;border-bottom:1px solid #E2E8F0;flex-shrink:0;gap:1rem';
            const dlBtn = '<a href="' + blobUrl + '" download="' + fname + '" style="display:inline-flex;align-items:center;gap:5px;padding:0.4rem 0.9rem;background:#1B4F8A;color:white;border-radius:7px;font-size:0.78rem;font-weight:600;text-decoration:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Télécharger</a>';
            hdr.innerHTML = '<div style="min-width:0;flex:1"><div style="font-size:0.92rem;font-weight:700;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + doc.title + '</div><div style="font-size:0.72rem;color:#94A3B8;margin-top:2px">' + date + '</div></div>'
                + '<div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0">' + dlBtn
                + '<button onclick="document.getElementById(&quot;doc-viewer-modal&quot;).remove()" style="width:32px;height:32px;border:1.5px solid #E2E8F0;border-radius:7px;background:white;cursor:pointer;font-size:1.1rem;color:#64748B;display:flex;align-items:center;justify-content:center">×</button></div>';

            const body = document.createElement('div');
            body.style.cssText = 'flex:1;overflow:auto;background:#F8FAFC;padding:4px';
            if (isImg) {
                body.innerHTML = '<img src="' + blobUrl + '" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;display:block;margin:auto" alt="' + doc.title + '">';
            } else {
                body.innerHTML = '<iframe src="' + blobUrl + '#toolbar=1" style="width:100%;height:100%;border:none" title="' + doc.title + '"></iframe>';
            }

            wrap.appendChild(hdr); wrap.appendChild(body);
            modal.appendChild(wrap);
            modal.addEventListener('click', function (e) { if (e.target === modal) { URL.revokeObjectURL(blobUrl); modal.remove(); } });
            document.body.appendChild(modal);
            renderDocuments(window._allDocuments || []);
        })
        .catch(e => { console.error('openDoc error:', e); showPortalToast('Impossible d\'ouvrir ce document : ' + e.message, 'error'); });
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
    // Mettre à jour dynamiquement le select des catégories
    const catSel = document.getElementById('doc-cat-filter');
    if (catSel && window._allDocuments) {
        const allCats = [...new Set((window._allDocuments || []).map(d => _docCategory(d)).filter(Boolean))];
        const current = catSel.value;
        catSel.innerHTML = '<option value="all">Toutes catégories</option>'
            + allCats.map(c => `<option value="${c}"${current === c ? ' selected' : ''}>${c}</option>`).join('');
    }
    const catFilter = catSel?.value || 'all';
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
    // Masquer les documents marqués Indisponible (sauf si filtre explicite)
    list = list.filter(d => !d.status || d.status.toLowerCase() !== 'indisponible' && d.status.toLowerCase() !== 'unavailable');
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
    // Palette auto pour catégories custom
    const _customCatPalette = [
        { icon: '#0891B2', badgeBg: '#CFFAFE' }, { icon: '#7C3AED', badgeBg: '#EDE9FE' },
        { icon: '#BE185D', badgeBg: '#FCE7F3' }, { icon: '#047857', badgeBg: '#D1FAE5' },
        { icon: '#B45309', badgeBg: '#FEF3C7' }, { icon: '#1D4ED8', badgeBg: '#DBEAFE' },
    ];
    let _customCatIdx = 0;
    function _getCatColor(cat) {
        if (catColors[cat]) return catColors[cat];
        // Assigner une couleur stable basée sur le nom
        let hash = 0; for (let c of cat) hash = (hash * 31 + c.charCodeAt(0)) % _customCatPalette.length;
        return _customCatPalette[Math.abs(hash) % _customCatPalette.length];
    }
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
        const colors = _getCatColor(cat);

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
        const colors = _getCatColor(cat);
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


async function previewQuotePDF(quoteId, quoteNumber, isPending) {
    const token = localStorage.getItem('vnk-token');
    try {
        const response = await fetch('/api/quotes/' + quoteId + '/pdf', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!response.ok) { showPortalToast('Impossible de charger le PDF.', 'error'); return; }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const existing = document.getElementById('vnk-pdf-preview-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'vnk-pdf-preview-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,18,35,0.75);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem';

        const wrap = document.createElement('div');
        wrap.style.cssText = 'width:100%;max-width:900px;height:90vh;background:white;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.4)';

        // Header
        const hdr = document.createElement('div');
        hdr.style.cssText = 'background:#0F2D52;padding:0.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0';

        const hdrLeft = document.createElement('div');
        hdrLeft.style.cssText = 'display:flex;align-items:center;gap:0.75rem';
        hdrLeft.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
            + '<span style="color:white;font-size:0.85rem;font-weight:600">Devis ' + quoteNumber + '</span>';

        const hdrRight = document.createElement('div');
        hdrRight.style.cssText = 'display:flex;align-items:center;gap:0.5rem';

        if (isPending) {
            const acceptB = document.createElement('button');
            acceptB.style.cssText = 'display:flex;align-items:center;gap:6px;padding:0.4rem 0.9rem;background:#16A34A;border:none;border-radius:7px;color:white;font-size:0.78rem;font-weight:700;cursor:pointer';
            acceptB.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Accepter';
            acceptB.onclick = function () { modal.remove(); acceptQuote(quoteId); };
            hdrRight.appendChild(acceptB);
        }

        const dlBtn = document.createElement('button');
        dlBtn.style.cssText = 'display:flex;align-items:center;gap:5px;padding:0.4rem 0.85rem;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:7px;color:white;font-size:0.78rem;font-weight:600;cursor:pointer';
        dlBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Télécharger';
        dlBtn.onclick = function () { const a = document.createElement('a'); a.href = blobUrl; a.download = 'VNK-' + quoteNumber + '.pdf'; a.click(); };

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);color:white;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center';
        closeBtn.textContent = '×';
        closeBtn.onclick = function () { URL.revokeObjectURL(blobUrl); modal.remove(); };

        hdrRight.appendChild(dlBtn);
        hdrRight.appendChild(closeBtn);
        hdr.appendChild(hdrLeft);
        hdr.appendChild(hdrRight);

        const iframe = document.createElement('iframe');
        iframe.src = blobUrl;
        iframe.style.cssText = 'flex:1;width:100%;border:none';

        wrap.appendChild(hdr);
        wrap.appendChild(iframe);
        modal.appendChild(wrap);
        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) { if (e.target === modal) { URL.revokeObjectURL(blobUrl); modal.remove(); } });
    } catch (error) { console.error('Quote PDF error:', error); showPortalToast('Erreur PDF.', 'error'); }
}



// ── Prévisualisation facture avec bouton Payer intégré ─────────────
async function previewInvoicePDF(invoiceId, amountTtc) {
    // Fermer tout modal existant
    ['vnk-sign-modal', 'vnk-pdf-preview-modal'].forEach(id => {
        const e = document.getElementById(id); if (e) e.remove();
    });

    const token = localStorage.getItem('vnk-token');
    const inv = (window._allInvoices || []).find(i => i.id === invoiceId) || {};
    const isPaying = amountTtc > 0 && inv.status !== 'paid';
    const fmtAmt = typeof formatCurrency === 'function' ? formatCurrency(amountTtc) : amountTtc + ' $';

    const overlay = document.createElement('div');
    overlay.id = 'vnk-sign-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;flex-direction:column';

    const statusHtml = inv.status === 'paid'
        ? '<span style="color:#27AE60;font-weight:600;display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Payée</span>'
        : inv.status === 'overdue'
            ? '<span style="color:#E74C3C;font-weight:600;display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>En retard</span>'
            : '<span style="color:#D97706;font-weight:600;display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>En attente de paiement</span>';

    const payBtnHtml = isPaying
        ? '<button onclick="closeSignatureModal();payInvoice(' + invoiceId + ',' + amountTtc + ')" style="padding:0.6rem 1.5rem;background:#27AE60;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'
        + 'Payer ' + fmtAmt + '</button>'
        : '';

    overlay.innerHTML =
        '<div style="background:#0F2D52;padding:0.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'
        + '<div>'
        + '<div style="font-size:0.95rem;font-weight:700;color:white">' + (inv.invoice_number || 'Facture') + (inv.title ? ' — ' + inv.title : '') + '</div>'
        + '<div style="font-size:0.72rem;color:rgba(255,255,255,0.6);margin-top:1px">' + (isPaying ? 'Montant à régler : ' + fmtAmt : 'Facture consultée') + '</div>'
        + '</div>'
        + '<button onclick="closeSignatureModal()" style="background:rgba(255,255,255,0.1);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center">×</button>'
        + '</div>'
        + '<div style="flex:1;overflow:auto;background:#525659">'
        + '<iframe id="sign-modal-iframe" src="" style="width:100%;height:100%;border:none;display:block;min-height:500px"></iframe>'
        + '</div>'
        + '<div style="background:white;border-top:1px solid #E2E8F0;padding:1rem 1.5rem;flex-shrink:0">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">'
        + '<div>' + statusHtml + '</div>'
        + '<div style="display:flex;gap:0.75rem">'
        + '<button onclick="closeSignatureModal()" style="padding:0.6rem 1.25rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer">Fermer</button>'
        + payBtnHtml
        + '</div>'
        + '</div>'
        + '</div>';

    document.body.appendChild(overlay);

    fetch('/api/invoices/' + invoiceId + '/pdf', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.blob(); })
        .then(blob => {
            const iframe = document.getElementById('sign-modal-iframe');
            if (iframe) iframe.src = URL.createObjectURL(blob);
        })
        .catch(e => { console.error('Invoice PDF:', e); showPortalToast('Impossible de charger la facture.', 'error'); });
}
async function downloadPDF(type, id, number) {
    // Rediriger vers l'onglet Documents pour consultation/téléchargement
    const tab = document.querySelector('[onclick*="showTab(\'documents"]');
    showTab('documents');
    // Ouvrir le doc synthétique correspondant après le rendu
    setTimeout(() => {
        const synthId = type === 'invoices' ? 'inv-' + id
            : type === 'contracts' ? 'ct-' + id
                : type === 'quotes' ? 'q-' + id : null;
        if (synthId) {
            const doc = (window._allDocuments || []).find(d => d._synth_id === synthId || String(d.id) === String(id));
            if (doc) openDoc(doc._synth_id || doc.id);
        }
    }, 350);
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
                // Rafraîchir immédiatement
                await loadAllData();
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

// ── Modal devis : voir PDF + signer = accepter ─────────────────────
async function openQuoteSignModal(quoteId) {
    const existing = document.getElementById('vnk-sign-modal');
    if (existing) existing.remove();

    const q = (window._allQuotes || []).find(x => x.id === quoteId) || {};
    const token = localStorage.getItem('vnk-token');

    const overlay = document.createElement('div');
    overlay.id = 'vnk-sign-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;flex-direction:column';
    overlay.innerHTML = `
        <div style="background:#0F2D52;padding:0.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
            <div>
                <div style="font-size:0.95rem;font-weight:700;color:white">${q.quote_number || 'Devis'} — ${q.title || ''}</div>
                <div style="font-size:0.72rem;color:rgba(255,255,255,0.6);margin-top:1px">Lisez le devis ci-dessous avant de signer</div>
            </div>
            <button onclick="closeSignatureModal()" style="background:rgba(255,255,255,0.1);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <div style="flex:1;overflow:auto;background:#525659">
            <iframe id="sign-modal-iframe" src="" style="width:100%;height:100%;border:none;display:block;min-height:500px"></iframe>
        </div>
        <div style="background:white;border-top:1px solid #E2E8F0;padding:1rem 1.5rem;flex-shrink:0">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">
                <span style="font-size:0.82rem;color:#64748B;display:flex;align-items:center;gap:5px">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    En attente de votre acceptation
                </span>
                <div style="display:flex;gap:0.75rem">
                    <button onclick="closeSignatureModal()" style="padding:0.6rem 1.25rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer">Fermer</button>
                    <button onclick="openQuoteSignatureCanvas(${quoteId})" style="padding:0.6rem 1.5rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Signer et accepter le devis
                    </button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay._quoteId = quoteId;

    // Charger le PDF du devis dans l'iframe
    fetch('/api/quotes/' + quoteId + '/pdf', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.blob())
        .then(blob => {
            const iframe = document.getElementById('sign-modal-iframe');
            if (iframe) iframe.src = URL.createObjectURL(blob);
        })
        .catch(() => showPortalToast('Impossible de charger le devis.', 'error'));
}

// ── Canvas signature pour accepter un devis ─────────────────────────
function openQuoteSignatureCanvas(quoteId) {
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
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.6);margin-top:2px">En signant, vous acceptez les termes du devis</div>
                </div>
                <button onclick="document.getElementById('vnk-canvas-panel').remove()" style="background:rgba(255,255,255,0.12);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center">×</button>
            </div>
            <div style="padding:1.25rem 1.5rem 0">
                <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem">
                    <button id="sign-tab-draw" onclick="_switchSignTab('draw')" style="flex:1;padding:0.5rem;border-radius:8px;border:2px solid #1B4F8A;background:#EBF5FB;color:#1B4F8A;font-size:0.8rem;font-weight:700;cursor:pointer">&#9998; Dessiner</button>
                    <button id="sign-tab-upload" onclick="_switchSignTab('upload')" style="flex:1;padding:0.5rem;border-radius:8px;border:2px solid #E2E8F0;background:white;color:#64748B;font-size:0.8rem;font-weight:600;cursor:pointer">&#8679; Importer</button>
                    <button id="sign-tab-text" onclick="_switchSignTab('text')" style="flex:1;padding:0.5rem;border-radius:8px;border:2px solid #E2E8F0;background:white;color:#64748B;font-size:0.8rem;font-weight:600;cursor:pointer">Aa Initiales</button>
                </div>
            </div>
            <div style="padding:0 1.5rem 1.5rem">
                <div id="sign-panel-draw">
                    <div style="border:2px solid #1B4F8A;border-radius:10px;background:white;position:relative;touch-action:none;margin-bottom:1rem">
                        <canvas id="sign-canvas" width="720" height="180" style="display:block;width:100%;height:180px;border-radius:8px;cursor:crosshair"></canvas>
                        <button onclick="clearSignatureCanvas()" style="position:absolute;top:8px;right:8px;background:white;border:1px solid #E2E8F0;border-radius:6px;padding:4px 10px;font-size:0.75rem;color:#64748B;cursor:pointer;font-weight:500">Effacer</button>
                    </div>
                </div>
                <div id="sign-panel-upload" style="display:none">
                    <div id="sign-upload-zone" onclick="document.getElementById('sign-file-input').click()" style="border:2px dashed #1B4F8A;border-radius:10px;padding:2rem;text-align:center;cursor:pointer;background:#F8FAFC;margin-bottom:1rem">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="1.5" style="margin-bottom:0.5rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <div style="font-size:0.85rem;font-weight:600;color:#1B4F8A">Cliquez pour importer</div>
                        <div style="font-size:0.75rem;color:#94A3B8;margin-top:4px">PNG, JPG — fond blanc recommandé</div>
                    </div>
                    <input type="file" id="sign-file-input" accept="image/*" style="display:none" onchange="_loadSignatureImage(this)">
                    <canvas id="sign-canvas-upload" width="720" height="180" style="display:none;width:100%;height:180px;border-radius:8px;border:2px solid #1B4F8A"></canvas>
                </div>
                <div id="sign-panel-text" style="display:none">
                    <input type="text" id="sign-text-input" placeholder="Ex: JT" maxlength="4" style="width:100%;padding:0.75rem;border:2px solid #1B4F8A;border-radius:10px;font-size:1.5rem;text-align:center;font-family:serif;font-weight:700;color:#0F2D52;margin-bottom:0.75rem;box-sizing:border-box" oninput="_previewTextSignature(this.value)">
                    <canvas id="sign-canvas-text" width="720" height="120" style="display:block;width:100%;height:120px;border-radius:8px;border:1.5px solid #E2E8F0;background:#FAFAFA"></canvas>
                </div>
                <div style="font-size:0.73rem;color:#94A3B8;line-height:1.5;margin:0.75rem 0 1rem">
                    En signant, vous confirmez avoir lu et accepté les termes du devis. Votre adresse IP et la date seront enregistrées.
                </div>
                <div style="display:flex;gap:0.75rem;justify-content:flex-end">
                    <button onclick="document.getElementById('vnk-canvas-panel').remove()" style="padding:0.6rem 1.4rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer">Annuler</button>
                    <button id="sign-submit-btn" onclick="submitQuoteAcceptance()" style="padding:0.6rem 1.75rem;background:#1B4F8A;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Accepter et signer
                    </button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(panel);
    // Stocker le quoteId sur le modal parent
    const signModal = document.getElementById('vnk-sign-modal');
    if (signModal) signModal._quoteId = quoteId;
    initSignatureCanvas();
}

// ── Soumettre la signature du devis = accepter ──────────────────────
async function submitQuoteAcceptance() {
    if (_clientSignMode === 'draw' && isCanvasEmpty()) {
        showPortalToast('Veuillez dessiner votre signature avant de soumettre.', 'error');
        return;
    }
    const overlay = document.getElementById('vnk-sign-modal');
    const quoteId = overlay?._quoteId;
    if (!quoteId) return;

    const btn = document.getElementById('sign-submit-btn');
    if (btn?._submitting) return;
    if (btn) { btn._submitting = true; btn.disabled = true; btn.textContent = 'Envoi en cours...'; }

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
        const r = await fetch('/api/quotes/' + quoteId + '/accept', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ signature_data: signatureData })
        });
        const d = await r.json();
        if (d.success) {
            const canvasPanel = document.getElementById('vnk-canvas-panel');
            if (canvasPanel) canvasPanel.remove();
            closeSignatureModal();
            _clientSignMode = 'draw';
            _uploadedSignatureData = null;
            const msg = d.contract
                ? 'Devis accepté ! Le contrat ' + d.contract.contract_number + ' a été créé et est disponible dans Contrats.'
                : 'Devis accepté — un contrat vous sera envoyé.';
            showPortalToast(msg, 'success');
            await loadAllData();
        } else {
            showPortalToast(d.message || 'Erreur lors de l\'acceptation.', 'error');
            if (btn) { btn._submitting = false; btn.disabled = false; btn.textContent = 'Accepter et signer'; }
        }
    } catch (e) {
        showPortalToast('Erreur de connexion.', 'error');
        if (btn) { btn._submitting = false; btn.disabled = false; btn.textContent = 'Accepter et signer'; }
    }
}

// ── Vue PDF devis archivé (sans signature) ───────────────────────────
async function openQuoteViewModal(quoteId, quoteNumber) {
    const token = localStorage.getItem('vnk-token');
    const existing = document.getElementById('vnk-sign-modal');
    if (existing) existing.remove();

    const q = (window._allQuotes || []).find(x => x.id === quoteId) || {};
    const overlay = document.createElement('div');
    overlay.id = 'vnk-sign-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;flex-direction:column';
    overlay.innerHTML = `
        <div style="background:#0F2D52;padding:0.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
            <div>
                <div style="font-size:0.95rem;font-weight:700;color:white">${q.quote_number || quoteNumber} — ${q.title || ''}</div>
                <div style="font-size:0.72rem;color:rgba(255,255,255,0.6);margin-top:1px">Devis accepté</div>
            </div>
            <button onclick="closeSignatureModal()" style="background:rgba(255,255,255,0.1);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <div style="flex:1;overflow:auto;background:#525659">
            <iframe id="sign-modal-iframe" src="" style="width:100%;height:100%;border:none;display:block;min-height:500px"></iframe>
        </div>
        <div style="background:white;border-top:1px solid #E2E8F0;padding:1rem 1.5rem;flex-shrink:0;display:flex;justify-content:flex-end">
            <button onclick="closeSignatureModal()" style="padding:0.6rem 1.25rem;background:white;color:#64748B;border:1.5px solid #E2E8F0;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer">Fermer</button>
        </div>`;
    document.body.appendChild(overlay);

    fetch('/api/quotes/' + quoteId + '/pdf', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.blob())
        .then(blob => {
            const iframe = document.getElementById('sign-modal-iframe');
            if (iframe) iframe.src = URL.createObjectURL(blob);
        })
        .catch(() => showPortalToast('Impossible de charger le devis.', 'error'));
}

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
            actionDiv.innerHTML = '';
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
// ════════════════════════════════════════════════════════════════
// NOUVEAU PROJET — Modal multi-étapes
// ════════════════════════════════════════════════════════════════

let _npStep = 1;
const _npStepLabels = ['', 'Étape 1 sur 4 — Type de service', 'Étape 2 sur 4 — Détails techniques', 'Étape 3 sur 4 — Choisir un créneau', 'Étape 4 sur 4 — Révision et envoi'];
const _svcLabels = { 'plc-support': 'Support PLC', 'audit': 'Audit technique', 'documentation': 'Documentation industrielle', 'refactoring': 'Refactorisation PLC' };
const _urgLabels = { 'normal': 'Normal — prochaines semaines', 'urgent': 'Urgent — cette semaine', 'critical': '🚨 Critique — production arrêtée' };
const _budgetLabels = { '': 'Non défini', 'lt2k': 'Moins de 2 000 $', '2k5k': '2 000 – 5 000 $', '5k15k': '5 000 – 15 000 $', '15k50k': '15 000 – 50 000 $', 'gt50k': 'Plus de 50 000 $' };
const _deadlineLabels = { '': 'Non défini', 'asap': 'Dès que possible', '1month': 'Dans 1 mois', '3months': 'Dans 3 mois', '6months': 'Dans 6 mois', 'flexible': 'Flexible' };

function openNewProjectModal() {
    const overlay = document.getElementById('new-project-overlay');
    if (!overlay) return;

    // Pré-remplir les infos client
    const name = document.getElementById('sidebar-name')?.textContent?.trim() || '';
    const company = document.getElementById('sidebar-company')?.textContent?.trim() || '';
    const el = (id) => document.getElementById(id);

    if (el('np-client-name')) el('np-client-name').textContent = name || 'Client VNK';
    if (el('np-client-company')) el('np-client-company').textContent = company;
    if (el('np-client-avatar')) el('np-client-avatar').textContent = (name || 'CL').substring(0, 2).toUpperCase();

    // Reset complet
    _npStep = 1;
    _npSelectedSlot = null;
    _npBookingSlots = [];
    _npBookingMonthOffset = 0;
    // Réinitialiser l'affichage des steps manuellement (fail-safe)
    for (let i = 1; i <= 5; i++) { const s = document.getElementById('np-step-' + i); if (s) s.style.display = i === 1 ? 'block' : 'none'; }
    // Réactiver le bouton submit (désactivé après soumission) + reset couleur bleue
    const btnNext = document.getElementById('np-btn-next');
    if (btnNext) { btnNext.disabled = false; btnNext.textContent = 'Suivant'; btnNext.style.background = '#1B4F8A'; }
    ['np-service', 'np-plc', 'np-description', 'np-extra', 'np-budget', 'np-deadline'].forEach(id => { const f = el(id); if (f) f.value = ''; });
    document.querySelectorAll('.np-service-card').forEach(c => c.classList.remove('selected'));
    el('np-urgency') && (el('np-urgency').value = 'normal');
    const fb = el('np-feedback'); if (fb) fb.style.display = 'none';
    // Forcer le footer visible (peut être caché après step 5)
    const footer = el('np-footer'); if (footer) footer.style.display = 'flex';
    // Forcer le bouton Back caché à step 1
    const btnBack = el('np-btn-back'); if (btnBack) btnBack.style.display = 'none';
    // Cacher le badge créneau sélectionné
    const slotBadge = el('np-slot-selected-badge'); if (slotBadge) slotBadge.style.display = 'none';

    _npRenderStep();
    overlay.style.display = 'block';
}

function closeNewProjectModal() {
    const overlay = document.getElementById('new-project-overlay');
    if (overlay) overlay.style.display = 'none';
    document.querySelectorAll('.portal-mandate-row').forEach(r => r.style.background = '');
    const sidePanel = document.getElementById('portal-mandate-side-panel');
    if (sidePanel) sidePanel.style.display = 'none';
}

function npSelectService(card, value) {
    document.querySelectorAll('.np-service-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const input = document.getElementById('np-service');
    if (input) input.value = value;
}

function _npRenderStep() {
    const el = (id) => document.getElementById(id);

    // Afficher l'étape courante
    for (let i = 1; i <= 5; i++) {
        const step = el('np-step-' + i);
        if (step) step.style.display = i === _npStep ? 'block' : 'none';
    }

    // Label
    if (el('np-step-label')) el('np-step-label').textContent = _npStepLabels[_npStep] || '';

    // Dots dans le header
    for (let i = 1; i <= 4; i++) {
        const dot = el('np-step-' + i + '-dot');
        if (!dot) continue;
        const circle = dot.querySelector('div');
        const label = dot.querySelector('span');
        if (i < _npStep) {
            // Complété
            circle.style.background = 'white';
            circle.style.color = '#059669';
            circle.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
            if (label) label.style.color = 'white';
        } else if (i === _npStep) {
            // Actif
            circle.style.background = 'white';
            circle.style.color = '#1B4F8A';
            circle.innerHTML = String(i);
            if (label) label.style.color = 'white';
            if (label) label.style.fontWeight = '700';
        } else {
            // Futur
            circle.style.background = 'rgba(255,255,255,0.25)';
            circle.style.color = 'white';
            circle.innerHTML = String(i);
            if (label) label.style.color = 'rgba(255,255,255,0.6)';
            if (label) label.style.fontWeight = '600';
        }
    }

    // Lignes entre étapes
    for (let i = 1; i <= 3; i++) {
        const line = el('np-line-' + i);
        if (line) line.style.background = i < _npStep ? 'white' : 'rgba(255,255,255,0.3)';
    }

    // Boutons footer
    const btnBack = el('np-btn-back');
    const btnNext = el('np-btn-next');
    const footer = el('np-footer');

    if (_npStep === 1) {
        if (btnBack) btnBack.style.display = 'none';
        if (btnNext) { btnNext.style.display = 'flex'; btnNext.style.background = '#1B4F8A'; btnNext.innerHTML = 'Suivant <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>'; }
    } else if (_npStep === 2) {
        if (btnBack) { btnBack.style.display = 'inline-block'; btnBack.textContent = '← Retour'; }
        if (btnNext) { btnNext.style.display = 'flex'; btnNext.style.background = '#1B4F8A'; btnNext.innerHTML = 'Choisir un créneau <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>'; }
    } else if (_npStep === 3) {
        // Charger les créneaux
        if (btnBack) { btnBack.style.display = 'inline-block'; btnBack.textContent = '← Retour'; }
        if (btnNext) {
            btnNext.style.display = 'flex';
            btnNext.style.background = _npSelectedSlot ? '#059669' : 'var(--primary,#1B4F8A)';
            btnNext.innerHTML = _npSelectedSlot
                ? 'Réviser ma demande <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>'
                : 'Passer cette étape <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
        }
        // Reset de la colonne droite
        const noDate = document.getElementById('np-booking-no-date');
        const daySlots = document.getElementById('np-booking-day-slots');
        if (!_npSelectedSlot) {
            if (noDate) noDate.style.display = 'flex';
            if (daySlots) daySlots.style.display = 'none';
        }
        setTimeout(function () { _npInitBookingSlots(); }, 200);
    } else if (_npStep === 4) {
        // Remplir le résumé avec le créneau sélectionné
        _npBuildSummary();
        if (btnBack) { btnBack.style.display = 'inline-block'; btnBack.textContent = '← Retour'; }
        if (btnNext) { btnNext.style.display = 'flex'; btnNext.style.background = '#059669'; btnNext.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Envoyer la demande'; }
    } else if (_npStep === 5) {
        if (footer) footer.style.display = 'none';
    }

    if (_npStep < 4 && footer) footer.style.display = 'flex';
    if (_npStep >= 5 && footer) footer.style.display = 'none';
    const fb = el('np-feedback'); if (fb) fb.style.display = 'none';
}

function _npBuildSummary() {
    const el = (id) => document.getElementById(id);
    const service = el('np-service')?.value;
    const desc = el('np-description')?.value?.trim();
    const plc = el('np-plc')?.value;
    const urgency = el('np-urgency')?.value;
    const budget = el('np-budget')?.value;
    const deadline = el('np-deadline')?.value;
    const extra = el('np-extra')?.value?.trim();
    const name = el('np-client-name')?.textContent;
    const company = el('np-client-company')?.textContent;

    const row = (label, value) => value
        ? '<div style="display:flex;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid #F1F5F9"><span style="font-size:0.75rem;font-weight:700;color:#94A3B8;min-width:130px;flex-shrink:0">' + label + '</span><span style="font-size:0.82rem;color:#0F172A;font-weight:500">' + value + '</span></div>'
        : '';

    const sumEl = el('np-summary');
    if (sumEl) {
        sumEl.innerHTML =
            row('Client', name + (company ? ' — ' + company : ''))
            + row('Service', _svcLabels[service] || service)
            + row('Automate', plc || '—')
            + row('Urgence', _urgLabels[urgency] || urgency)
            + row('Budget estimé', _budgetLabels[budget] || budget)
            + row('Délai souhaité', _deadlineLabels[deadline] || deadline)
            + '<div style="padding:0.45rem 0;border-bottom:1px solid #F1F5F9"><span style="font-size:0.75rem;font-weight:700;color:#94A3B8;display:block;margin-bottom:4px">Description</span><span style="font-size:0.82rem;color:#0F172A;line-height:1.5;display:block">' + desc + '</span></div>'
            + (extra ? row('Détails techniques', extra) : '');
    }

    // Recap service étape 2
    const serviceRecap = el('np-service-recap');
    if (serviceRecap) serviceRecap.textContent = _svcLabels[service] || service;

    // Afficher/masquer le résumé du créneau en étape 4
    const slotBadge = el('np-summary-slot');
    const noSlotBadge = el('np-summary-no-slot');
    const slotTxt = el('np-summary-slot-text');
    if (_npSelectedSlot) {
        const ds = _npSelectedSlot.ds;
        const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
        if (slotTxt) slotTxt.textContent = dateStr + ' à ' + _npSelectedSlot.time + ' · 30 min';
        if (slotBadge) { slotBadge.style.display = 'flex'; }
        if (noSlotBadge) { noSlotBadge.style.display = 'none'; }
    } else {
        if (slotBadge) { slotBadge.style.display = 'none'; }
        if (noSlotBadge) { noSlotBadge.style.display = 'block'; }
    }
}

async function npGoStep(direction) {
    const el = (id) => document.getElementById(id);
    const fb = el('np-feedback');
    if (fb) fb.style.display = 'none';

    if (direction === 1) {
        // Validation avant de passer à l'étape suivante
        if (_npStep === 1) {
            const service = el('np-service')?.value;
            const desc = el('np-description')?.value?.trim();
            if (!service) {
                _npShowError('Veuillez sélectionner un type de service.');
                return;
            }
            if (!desc || desc.length < 15) {
                _npShowError('Veuillez décrire votre besoin (minimum 15 caractères).');
                return;
            }
            // Mettre à jour le recap de service dans l'étape 2
            const recap = el('np-service-recap');
            if (recap) recap.textContent = _svcLabels[service] || service;
        }

        if (_npStep === 4) {
            // Soumettre
            await _npSubmit();
            return;
        }
    }

    _npStep = Math.max(1, Math.min(4, _npStep + direction));
    _npRenderStep();

    // Scroll vers le haut du corps
    const body = document.querySelector('#new-project-modal > div:nth-child(2)');
    if (body) body.scrollTop = 0;
}

function _npShowError(msg) {
    const fb = document.getElementById('np-feedback');
    if (fb) {
        fb.style.display = 'block';
        fb.style.background = '#FEE2E2';
        fb.style.color = '#DC2626';
        fb.style.border = '1px solid #FECACA';
        fb.style.borderRadius = '8px';
        fb.style.padding = '0.65rem 1rem';
        fb.textContent = msg;
    }
}

async function _npSubmit() {
    const el = (id) => document.getElementById(id);
    const btnNext = el('np-btn-next');
    const service = el('np-service')?.value;
    const desc = el('np-description')?.value?.trim();
    const plc = el('np-plc')?.value;
    const urgency = el('np-urgency')?.value;
    const budget = el('np-budget')?.value;
    const deadline = el('np-deadline')?.value;
    const extra = el('np-extra')?.value?.trim();
    const name = el('np-client-name')?.textContent;
    const company = el('np-client-company')?.textContent;

    if (btnNext) { btnNext.disabled = true; btnNext.textContent = 'Envoi en cours...'; }

    const lines = [
        '🚀 NOUVELLE DEMANDE DE PROJET',
        '──────────────────────────────',
        'Client      : ' + name + (company ? ' — ' + company : ''),
        'Service     : ' + (_svcLabels[service] || service),
        'Automate    : ' + (plc || 'Non précisé'),
        'Urgence     : ' + (_urgLabels[urgency] || urgency),
        'Budget est. : ' + (_budgetLabels[budget] || 'Non défini'),
        'Délai       : ' + (_deadlineLabels[deadline] || 'Non défini'),
        '──────────────────────────────',
        'DESCRIPTION :',
        desc,
        extra ? '\nDÉTAILS TECHNIQUES :\n' + extra : null,
    ].filter(Boolean);

    const msgContent = lines.join('\n');

    try {
        const token = localStorage.getItem('vnk-token');
        const resp = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ content: msgContent })
        });
        const data = await resp.json();

        if (data.success || resp.ok) {
            _npStep = 5;
            _npRenderStep();

            // Afficher le créneau réservé dans la confirmation
            const sentSlot = document.getElementById('np-sent-slot');
            const sentNoSlot = document.getElementById('np-sent-no-slot');
            const sentTxt = document.getElementById('np-sent-slot-text');
            if (_npSelectedSlot) {
                const ds = _npSelectedSlot.ds;
                const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
                if (sentTxt) sentTxt.textContent = dateStr + ' à ' + _npSelectedSlot.time;
                if (sentSlot) sentSlot.style.display = 'block';
                if (sentNoSlot) sentNoSlot.style.display = 'none';
                // Réserver le créneau via l'API
                try {
                    const token2 = localStorage.getItem('vnk-token');
                    await fetch('/api/calendar/book', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token2 },
                        body: JSON.stringify({ slot_id: _npSelectedSlot.id, subject: 'Appel de qualification — demande de projet', meeting_type: 'video' })
                    });
                } catch (e) { /* booking non bloquant */ }
            } else {
                if (sentSlot) sentSlot.style.display = 'none';
                if (sentNoSlot) sentNoSlot.style.display = 'block';
            }

            if (typeof pushPortalNotif === 'function') {
                pushPortalNotif('mandate', 'Demande de projet envoyée à VNK', 'mandates');
            }
        } else {
            throw new Error(data.message || 'Erreur serveur');
        }
    } catch (err) {
        _npShowError('Erreur lors de l\'envoi : ' + err.message);
        if (btnNext) { btnNext.disabled = false; btnNext.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Envoyer la demande'; btnNext.style.background = '#059669'; }
    }
}

// Ancienne fonction npSelectService (alias)
function submitNewProject() { npGoStep(1); }


// ── BOOKING INTÉGRÉ DANS LE MODAL NOUVEAU PROJET ────────────────
let _npBookingSlots = [], _npBookingMonthOffset = 0, _npSelectedSlot = null;

async function _npInitBookingSlots() {
    const loadEl = document.getElementById('np-booking-loading');
    const emptyEl = document.getElementById('np-booking-empty');
    const slotsEl = document.getElementById('np-booking-slots');
    if (loadEl) loadEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (slotsEl) slotsEl.style.display = 'none';

    try {
        const token = localStorage.getItem('vnk-token');
        const resp = await fetch('/api/calendar/available', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await resp.json();
        _npBookingSlots = data.slots || [];
    } catch (e) {
        _npBookingSlots = [];
    }

    if (loadEl) loadEl.style.display = 'none';

    if (!_npBookingSlots.length) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    // Naviguer au premier mois avec des créneaux
    const firstDate = _npBookingSlots[0]?.slot_date?.split('T')[0];
    if (firstDate) {
        const now = new Date();
        const first = new Date(firstDate + 'T12:00:00');
        _npBookingMonthOffset = (first.getFullYear() - now.getFullYear()) * 12 + (first.getMonth() - now.getMonth());
    } else {
        _npBookingMonthOffset = 0;
    }

    if (slotsEl) slotsEl.style.display = 'block';
    _npRenderBookingCal();
}

function npBookingNavMonth(dir) {
    _npBookingMonthOffset += dir;
    _npRenderBookingCal();
    // Masquer les créneaux et remettre l'état vide
    const daySlots = document.getElementById('np-booking-day-slots');
    const noDate = document.getElementById('np-booking-no-date');
    if (daySlots) daySlots.style.display = 'none';
    if (noDate) noDate.style.display = 'flex';
}

function _npRenderBookingCal() {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + _npBookingMonthOffset, 1);
    const year = target.getFullYear();
    const month = target.getMonth();
    const today = now.toISOString().split('T')[0];

    // Label mois capitalisé
    const lbl = document.getElementById('np-booking-month-label');
    if (lbl) {
        const raw = target.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
        lbl.textContent = raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    const datesWithSlots = new Set(_npBookingSlots.map(s => (s.slot_date || '').split('T')[0]));

    // Calculer le premier jour de la semaine (lundi = 0)
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay(); // 0=dim, 1=lun...
    startDow = startDow === 0 ? 6 : startDow - 1; // convertir en lundi=0

    const grid = document.getElementById('np-booking-cal-grid');
    if (!grid) return;

    let html = '';
    // Cellules vides avant le 1er
    for (let i = 0; i < startDow; i++) {
        html += '<div style="aspect-ratio:1"></div>';
    }

    const selectedDs = _npSelectedSlot ? _npSelectedSlot.ds : null;

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const hasSlot = datesWithSlots.has(ds);
        const isPast = ds < today;
        const isToday = ds === today;
        const isSelected = ds === selectedDs;

        if (!isPast && hasSlot) {
            // Jour disponible
            const bg = isSelected ? '#1B4F8A' : 'white';
            const color = isSelected ? 'white' : '#0F172A';
            const border = isSelected ? '2px solid #1B4F8A' : '2px solid #E2E8F0';
            const dotColor = isSelected ? 'rgba(255,255,255,0.6)' : '#059669';
            html += '<div onclick="npSelectBookingDate(\'' + ds + '\')" '
                + 'data-cal-date="' + ds + '" '
                + 'style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:9px;background:' + bg + ';border:' + border + ';cursor:pointer;transition:all .15s;position:relative" '
                + 'onmouseenter="npCalDayHover(this,true,\'' + ds + '\')" '
                + 'onmouseleave="npCalDayHover(this,false,\'' + ds + '\')">'
                + '<span style="font-size:0.75rem;font-weight:700;color:' + color + ';line-height:1">' + d + '</span>'
                + '<span style="width:4px;height:4px;border-radius:50%;background:' + dotColor + ';margin-top:2px;display:block"></span>'
                + '</div>';
        } else if (isToday) {
            // Aujourd'hui sans créneau
            html += '<div style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:9px;border:2px solid #CBD5E1;background:#F8FAFC">'
                + '<span style="font-size:0.75rem;font-weight:700;color:#94A3B8;line-height:1">' + d + '</span>'
                + '</div>';
        } else {
            // Jour passé ou sans créneau
            html += '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:9px">'
                + '<span style="font-size:0.75rem;color:' + (isPast ? '#E2E8F0' : '#CBD5E1') + ';font-weight:500">' + d + '</span>'
                + '</div>';
        }
    }
    grid.innerHTML = html;
}

function npCalDayHover(el, entering, ds) {
    const isSelected = _npSelectedSlot && _npSelectedSlot.ds === ds;
    if (isSelected) return;
    if (entering) {
        el.style.background = '#EBF5FB';
        el.style.borderColor = '#1B4F8A';
        el.querySelector('span').style.color = '#1B4F8A';
    } else {
        el.style.background = 'white';
        el.style.borderColor = '#E2E8F0';
        el.querySelector('span').style.color = '#0F172A';
    }
}

function npSelectBookingDate(ds) {
    // Mettre à jour visuellement les cases du calendrier
    document.querySelectorAll('[data-cal-date]').forEach(function (el) {
        const isThis = el.dataset.calDate === ds;
        el.style.background = isThis ? '#1B4F8A' : 'white';
        el.style.borderColor = isThis ? '#1B4F8A' : '#E2E8F0';
        const span = el.querySelector('span');
        if (span) span.style.color = isThis ? 'white' : '#0F172A';
        const dot = el.querySelectorAll('span')[1];
        if (dot) dot.style.background = isThis ? 'rgba(255,255,255,0.6)' : '#059669';
    });

    const daySlots = document.getElementById('np-booking-day-slots');
    const noDate = document.getElementById('np-booking-no-date');
    const lbl = document.getElementById('np-booking-day-label');
    const timesEl = document.getElementById('np-booking-times');

    if (!daySlots || !lbl || !timesEl) return;

    // Afficher la colonne droite
    if (noDate) noDate.style.display = 'none';
    daySlots.style.display = 'flex';

    // Label date dans le badge bleu
    const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    lbl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    // Créneaux du jour
    const daySlotsList = _npBookingSlots.filter(s => (s.slot_date || '').split('T')[0] === ds);

    if (!daySlotsList.length) {
        timesEl.innerHTML = '<div style="font-size:0.78rem;color:#94A3B8;grid-column:span 2">Aucun créneau ce jour.</div>';
        return;
    }

    // Réinitialiser la sélection si on change de jour
    if (_npSelectedSlot && _npSelectedSlot.ds !== ds) {
        _npSelectedSlot = null;
        const badge = document.getElementById('np-slot-selected-badge');
        if (badge) badge.style.display = 'none';
        _npUpdateNextBtn();
    }

    timesEl.innerHTML = daySlotsList.map(function (s) {
        const time = (s.start_time || '').substring(0, 5);
        const dur = s.duration_min || 30;
        const isSelTime = _npSelectedSlot && _npSelectedSlot.id === s.id;
        const bg = isSelTime ? '#1B4F8A' : 'white';
        const color = isSelTime ? 'white' : '#334155';
        const border = isSelTime ? '#1B4F8A' : '#E2E8F0';
        return '<button onclick="npSelectBookingSlot(' + s.id + ', \'' + ds + '\', \'' + time + '\', ' + dur + ')" '
            + 'data-slot-id="' + s.id + '" '
            + 'style="padding:0.55rem 0.4rem;border:2px solid ' + border + ';border-radius:8px;background:' + bg + ';'
            + 'color:' + color + ';font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .12s;text-align:center" '
            + 'onmouseenter="npTimeHover(this,true)" '
            + 'onmouseleave="npTimeHover(this,false)">'
            + time
            + '</button>';
    }).join('');
}

function npTimeHover(el, entering) {
    const isSelected = el.style.background === 'rgb(27, 79, 138)' || el.style.borderColor === 'rgb(27, 79, 138)';
    if (isSelected) return;
    if (entering) {
        el.style.background = '#F0F7FF';
        el.style.borderColor = '#93C5FD';
        el.style.color = '#1B4F8A';
    } else {
        el.style.background = 'white';
        el.style.borderColor = '#E2E8F0';
        el.style.color = '#334155';
    }
}

function npSelectBookingSlot(slotId, ds, time, dur) {
    _npSelectedSlot = { id: slotId, ds, time, dur };

    // Mettre à jour les boutons de créneaux
    document.querySelectorAll('#np-booking-times button').forEach(function (btn) {
        const sel = parseInt(btn.dataset.slotId) === slotId;
        btn.style.background = sel ? '#1B4F8A' : 'white';
        btn.style.color = sel ? 'white' : '#334155';
        btn.style.borderColor = sel ? '#1B4F8A' : '#E2E8F0';
    });

    // Afficher le badge créneau confirmé
    const badge = document.getElementById('np-slot-selected-badge');
    const txt = document.getElementById('np-slot-selected-text');
    if (txt) {
        const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
        txt.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + ' · ' + time;
    }
    if (badge) { badge.style.display = 'flex'; }

    // Mettre à jour le bouton Suivant
    _npUpdateNextBtn();
}

function _npUpdateNextBtn() {
    const btnNext = document.getElementById('np-btn-next');
    if (!btnNext) return;
    if (_npSelectedSlot) {
        btnNext.innerHTML = 'Réviser ma demande <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
        btnNext.style.background = '#059669';
    } else {
        btnNext.innerHTML = 'Passer cette étape <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
        btnNext.style.background = '#1B4F8A';
    }
}

function npClearSlotSelection() {
    _npSelectedSlot = null;
    const badge = document.getElementById('np-slot-selected-badge');
    if (badge) badge.style.display = 'none';
    // Remettre visuellement les boutons temps
    document.querySelectorAll('#np-booking-times button').forEach(function (btn) {
        btn.style.background = 'white';
        btn.style.color = '#334155';
        btn.style.borderColor = '#E2E8F0';
    });
    // Remettre visuellement les jours calendrier
    document.querySelectorAll('[data-cal-date]').forEach(function (el) {
        el.style.background = 'white';
        el.style.borderColor = '#E2E8F0';
        const span = el.querySelector('span');
        if (span) span.style.color = '#0F172A';
        const dot = el.querySelectorAll('span')[1];
        if (dot) dot.style.background = '#059669';
    });
    // Remettre panneau vide
    const daySlots = document.getElementById('np-booking-day-slots');
    const noDate = document.getElementById('np-booking-no-date');
    if (daySlots) daySlots.style.display = 'none';
    if (noDate) noDate.style.display = 'flex';
    _npUpdateNextBtn();
}

async function npConfirmBooking() {
    if (!_npSelectedSlot) return;
    const subject = document.getElementById('np-booking-subject')?.value?.trim();
    const meetType = document.getElementById('np-booking-meet-type')?.value || 'video';
    const btnEl = document.getElementById('np-booking-confirm-btn');
    const errEl = document.getElementById('np-booking-err');
    const successEl = document.getElementById('np-booking-success');
    const txtEl = document.getElementById('np-booking-success-text');
    const formEl = document.getElementById('np-booking-form');

    if (errEl) errEl.style.display = 'none';
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Réservation...'; }

    try {
        const token = localStorage.getItem('vnk-token');
        const resp = await fetch('/api/calendar/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ slot_id: _npSelectedSlot.id, subject, meeting_type: meetType })
        });
        const data = await resp.json();
        if (data.success) {
            const dateStr = new Date(_npSelectedSlot.ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
            if (txtEl) txtEl.textContent = dateStr + ' à ' + _npSelectedSlot.time;
            if (formEl) formEl.style.display = 'none';
            if (successEl) successEl.style.display = 'block';
            // Supprimer le créneau localement
            _npBookingSlots = _npBookingSlots.filter(s => s.id !== _npSelectedSlot.id);
            if (_availableSlots) _availableSlots = _availableSlots.filter(s => s.id !== _npSelectedSlot.id);
            if (typeof pushPortalNotif === 'function') {
                pushPortalNotif('mandate', 'RDV confirmé — ' + dateStr + ' à ' + _npSelectedSlot.time, null);
            }
        } else {
            throw new Error(data.message || 'Créneau non disponible');
        }
    } catch (e) {
        if (errEl) { errEl.textContent = 'Erreur : ' + e.message; errEl.style.display = 'block'; }
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Confirmer le rendez-vous'; }
    }
}
// ── FIN BOOKING MODAL ────────────────────────────────────────────


// ════════════════════════════════════════════════════════════════
// BOOKING CALENDRIER — Portail client
// ════════════════════════════════════════════════════════════════

let _availableSlots = [];
let _bookingMonthOffset = 0;
let _selectedSlotId = null;
let _selectedSlotData = null;
let _selectedDateDs = null;

async function loadMyAppointments() {
    const section = document.getElementById('booking-my-appts-section');
    const list = document.getElementById('booking-my-appts-list');
    if (!section || !list) return;
    try {
        const token = localStorage.getItem('vnk-token');
        const resp = await fetch('/api/calendar/my-appointments', { headers: { Authorization: 'Bearer ' + token } });
        const data = await resp.json();
        // Détecter si un lien a été ajouté pour notifier le client
        const prev = window._allMyAppts || [];
        const fresh = data.appointments || [];
        fresh.forEach(a => {
            const old = prev.find(p => p.id === a.id);
            if (old && !old.meeting_link && a.meeting_link) {
                if (typeof pushPortalNotif === 'function') {
                    pushPortalNotif('mandate', 'Lien de réunion disponible — ' + (a.subject || 'Rendez-vous'), 'booking');
                }
            }
        });
        window._allMyAppts = fresh;
        window._bkApptFilter = window._bkApptFilter || 'all';
        // Ne pas reset la page courante sauf premier chargement
        if (!window._bkApptPage) window._bkApptPage = 1;
        // Update badge
        const total = window._allMyAppts.filter(a => a.status !== 'cancelled').length;
        const badge = document.getElementById('bk-appts-count-badge');
        if (badge) badge.textContent = total;
        // Open accordion if has appointments
        if (total > 0) {
            const panel = document.getElementById('bk-appts-panel');
            const arrow = document.getElementById('bk-accordion-arrow');
            if (panel) panel.style.display = 'flex';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
        _renderMyAppts();
    } catch (e) { console.warn('loadMyAppointments:', e); }
}

function bkFilterAppts(filter, btn) {
    window._bkApptFilter = filter;
    window._bkApptPage = 1;
    document.querySelectorAll('.bk-filt').forEach(b => {
        b.style.background = 'white';
        b.style.borderColor = '#E2E8F0';
        b.style.color = '#64748B';
        b.style.fontWeight = '600';
    });
    if (btn) {
        btn.style.background = '#EBF5FB';
        btn.style.borderColor = '#1B4F8A';
        btn.style.color = '#1B4F8A';
        btn.style.fontWeight = '700';
    }
    _renderMyAppts();
}

function _renderMyAppts() {
    const section = document.getElementById('booking-my-appts-section');
    const list = document.getElementById('booking-my-appts-list');
    const pager = document.getElementById('booking-appts-pager');
    if (!list) return;

    const all = window._allMyAppts || [];
    if (!all.length) { if (section) section.style.display = 'none'; return; }
    if (section) section.style.display = 'flex';

    const filter = window._bkApptFilter || 'all';
    let filtered = filter === 'all' ? all.slice() : all.filter(a => a.status === filter);

    // Tri : groupe 1 = à venir avec lien (date ASC)
    //        groupe 2 = à venir sans lien (date ASC)
    //        groupe 3 = passés (date DESC)
    const today = new Date().toISOString().split('T')[0];
    filtered.sort((a, b) => {
        const aHasLink = !!a.meeting_link;
        const bHasLink = !!b.meeting_link;
        const aFuture = a.appointment_date >= today;
        const bFuture = b.appointment_date >= today;
        const aGroup = aFuture && aHasLink ? 0 : aFuture ? 1 : 2;
        const bGroup = bFuture && bHasLink ? 0 : bFuture ? 1 : 2;
        if (aGroup !== bGroup) return aGroup - bGroup;
        // Dans groupe 0 et 1 : date ASC (plus tôt d'abord)
        // Dans groupe 2 (passés) : date DESC (plus récent d'abord)
        const cmp = a.appointment_date.localeCompare(b.appointment_date);
        return aGroup === 2 ? -cmp : cmp;
    });

    const PER_PAGE = 10;
    const page = window._bkApptPage || 1;
    const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const STATUS = {
        confirmed: { label: 'Confirmé', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0', icon: '✓' },
        pending: { label: 'En attente', bg: '#FEF9EC', color: '#92400E', border: '#FDE68A', icon: '⏳' },
        cancelled: { label: 'Annulé', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', icon: '✕' },
    };

    if (!slice.length) {
        list.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#94A3B8;font-size:0.85rem">Aucun rendez-vous dans cette catégorie</div>';
        if (pager) pager.innerHTML = '';
        return;
    }

    // Grille auto-fill — s'ajuste à la résolution, min 220px par carte
    const _sectionW = document.getElementById('booking-my-appts-section')?.offsetWidth || window.innerWidth - 260;
    const _cols = Math.max(2, Math.floor(_sectionW / 327));
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(' + _cols + ',1fr)';
    list.style.gap = '.5rem';
    list.style.padding = '.65rem .9rem';

    list.innerHTML = slice.map(function (a) {
        const st = STATUS[a.status] || STATUS.pending;
        const ds = (a.appointment_date || '').split('T')[0];
        const isPast = ds < new Date().toISOString().split('T')[0];
        const dateObj = ds ? new Date(ds + 'T12:00:00') : null;
        const dateStr = dateObj ? dateObj.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
        const startT = (a.start_time || '').substring(0, 5);
        const endT = (a.end_time || '').substring(0, 5);
        const timeStr = startT + ' – ' + endT;
        const dur = (a.duration_min || 30) + ' min';
        const fmt = a.meeting_type === 'phone' ? 'Téléphone' : 'Vidéo';
        const fmtIcon = a.meeting_type === 'phone'
            ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
            : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
        const hasLink = !!a.meeting_link;
        const isCancelled = a.status === 'cancelled';
        const opacity = (isCancelled || isPast) ? ';opacity:.6' : '';

        return '<div onclick="openApptDetailModal(' + a.id + ')" style="background:white;border:1.5px solid #E2E8F0;border-radius:8px;padding:.75rem .9rem;cursor:pointer;transition:all .12s;display:flex;flex-direction:column;gap:.35rem' + opacity + '" onmouseenter="this.style.borderColor=\'#BFDBFE\';this.style.background=\'#F8FAFC\'" onmouseleave="this.style.borderColor=\'#E2E8F0\';this.style.background=\'white\'">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.4rem">'
            + '<span style="font-size:.78rem;font-weight:700;color:#0F172A;text-transform:capitalize;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + dateStr + '</span>'
            + '<span style="font-size:.6rem;font-weight:700;background:' + st.bg + ';color:' + st.color + ';padding:2px 7px;border-radius:20px;flex-shrink:0;white-space:nowrap">' + st.label + '</span>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:.4rem">'
            + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
            + '<span style="font-size:.73rem;font-weight:600;color:#475569">' + timeStr + '</span>'
            + '<span style="font-size:.68rem;color:#94A3B8">·</span>'
            + '<span style="font-size:.68rem;color:#94A3B8">' + dur + '</span>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:.35rem;overflow:hidden">'
            + '<span style="display:flex;align-items:center;gap:.2rem;font-size:.68rem;color:#64748B;flex-shrink:0">' + fmtIcon + ' ' + fmt + '</span>'
            + (a.subject ? '<span style="font-size:.68rem;color:#94A3B8;flex-shrink:0">·</span><span style="font-size:.68rem;color:#64748B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + a.subject + '</span>' : '')
            + '</div>'
            + (hasLink && !isCancelled && !isPast
                ? '<a href="' + a.meeting_link + '" target="_blank" onclick="event.stopPropagation()" style="margin-top:.1rem;display:inline-flex;align-items:center;gap:.3rem;font-size:.68rem;font-weight:700;color:#1B4F8A;background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:6px;padding:3px 9px;text-decoration:none;align-self:flex-start">Rejoindre</a>'
                : (!isCancelled && !isPast && !hasLink ? '<span style="font-size:.65rem;color:#D97706;font-weight:600;margin-top:.05rem">Lien à venir</span>' : ''))
            + '</div>';
    }).join('');

    // Pagination
    if (pager) {
        if (pages <= 1) { pager.innerHTML = ''; return; }
        const from = (page - 1) * PER_PAGE + 1;
        const to = Math.min(page * PER_PAGE, filtered.length);
        pager.innerHTML = '<span>' + from + '–' + to + ' sur ' + filtered.length + ' RDV</span>'
            + '<div style="display:flex;gap:0.3rem">'
            + (page > 1 ? '<button onclick="_bkApptPg(' + (page - 1) + ')" style="padding:3px 9px;border:1.5px solid #E2E8F0;border-radius:6px;background:white;font-size:0.75rem;cursor:pointer;font-family:inherit">←</button>' : '')
            + '<span style="padding:3px 9px;border:1.5px solid #1B4F8A;border-radius:6px;background:#EBF5FB;color:#1B4F8A;font-size:0.75rem;font-weight:700">' + page + '/' + pages + '</span>'
            + (page < pages ? '<button onclick="_bkApptPg(' + (page + 1) + ')" style="padding:3px 9px;border:1.5px solid #E2E8F0;border-radius:6px;background:white;font-size:0.75rem;cursor:pointer;font-family:inherit">→</button>' : '')
            + '</div>';
    }
}

function _bkApptPg(p) { window._bkApptPage = p; _renderMyAppts(); }


async function cancelMyAppointment(apptId) {
    if (!confirm('Annuler ce rendez-vous ?')) return;
    try {
        const token = localStorage.getItem('vnk-token');
        const r = await fetch('/api/calendar/appointments/' + apptId + '/cancel', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ reason: 'Annulé par le client' })
        });
        const data = await r.json();
        if (data.success) {
            if (typeof pushPortalNotif === 'function') pushPortalNotif('mandate', 'RDV annulé', null);
            loadMyAppointments();
            initBookingTab();
        }
    } catch (e) { }
}

async function initBookingTab() {
    const grid = document.getElementById('booking-month-grid');
    const slotsDay = document.getElementById('booking-slots-day');
    const sep = document.getElementById('booking-day-separator');
    if (grid) grid.innerHTML = '';
    if (slotsDay) slotsDay.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:#CBD5E0;font-size:0.85rem"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" stroke-width="1.5" stroke-linecap="round" style="display:block;margin:0 auto 0.5rem"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Chargement des disponibilités...</div>';
    if (sep) sep.style.display = 'none';
    resetBookingSelection();

    // Charger mes RDV en parallèle
    loadMyAppointments();

    // Toujours recharger depuis le serveur (temps réel)
    try {
        const token = localStorage.getItem('vnk-token');
        const resp = await fetch('/api/calendar/available?ts=' + Date.now(), {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await resp.json();
        _availableSlots = data.slots || [];
    } catch (e) {
        _availableSlots = [];
    }

    // Naviguer automatiquement au premier mois avec des créneaux
    if (_availableSlots.length > 0) {
        const firstDate = _availableSlots[0].slot_date?.split('T')[0];
        if (firstDate) {
            const now = new Date();
            const first = new Date(firstDate + 'T12:00:00');
            _bookingMonthOffset = (first.getFullYear() - now.getFullYear()) * 12 + (first.getMonth() - now.getMonth());
        }
    } else {
        _bookingMonthOffset = 0;
    }

    resetBookingSelection();
    renderBookingMonth();
}

function bookingNavMonth(dir) {
    _bookingMonthOffset += dir;
    renderBookingMonth();
    // Cacher les créneaux quand on change de mois
    const sep = document.getElementById('booking-day-separator');
    const slots = document.getElementById('booking-slots-day');
    if (sep) sep.style.display = 'none';
    if (slots) slots.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:#CBD5E0;font-size:0.85rem">Sélectionnez une date disponible</div>';
    resetBookingSelection();
    // Vider les créneaux du jour
    const dl = document.getElementById('booking-slots-day');
    const lbl = document.getElementById('booking-slots-date-label');
    if (dl) dl.innerHTML = '<div style="font-size:0.85rem;color:#94A3B8">Sélectionnez un jour pour voir les créneaux.</div>';
    if (lbl) lbl.textContent = '';
}

function renderBookingMonth() {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + _bookingMonthOffset, 1);
    const year = target.getFullYear();
    const month = target.getMonth();
    const lbl = document.getElementById('booking-month-label');
    if (lbl) lbl.textContent = target.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });

    const datesWithSlots = new Set(_availableSlots.map(s => (s.slot_date || '').split('T')[0]));
    const todayDs = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const selectedDs = _selectedDateDs || (_selectedSlotData ? (_selectedSlotData.slot_date || '').split('T')[0] : null);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay(); // Dim=0


    const grid = document.getElementById('booking-month-grid');
    if (!grid) return;
    let html = '';

    for (let i = 0; i < startDow; i++) html += '<div></div>';

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const hasSlot = datesWithSlots.has(ds);
        const isPast = ds < todayDs;
        const isToday = ds === todayDs;
        const isSelected = ds === selectedDs;
        const slotCount = hasSlot ? _availableSlots.filter(s => (s.slot_date || '').split('T')[0] === ds).length : 0;

        if (isSelected) {
            html += '<div class="bk-day selected" onclick="selectBookingDate(\'' + ds + '\')" title="' + slotCount + ' créneaux">'
                + '<span style="font-size:.85rem">' + d + '</span>'
                + '</div>';
        } else if (!isPast && hasSlot) {
            html += '<div class="bk-day available" onclick="selectBookingDate(\'' + ds + '\')" title="' + slotCount + ' créneaux">'
                + '<span style="font-size:.85rem;display:block;line-height:1.1">' + d + '</span>'
                + '<span style="font-size:.5rem;opacity:.8;display:block;line-height:1">' + slotCount + ' dispo</span>'
                + '</div>';
        } else if (isToday && !isPast) {
            html += '<div class="bk-day today">' + d + '</div>';
        } else if (isPast) {
            html += '<div class="bk-day past">' + d + '</div>';
        } else {
            html += '<div class="bk-day other-month">' + d + '</div>';
        }
    }
    grid.innerHTML = html;
}

function bkSetMeetType(type, btn) {
    document.querySelectorAll('.bk-fmt').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const hidden = document.getElementById('booking-meet-type');
    if (hidden) hidden.value = type;
}

function selectBookingDate(ds) {
    _selectedDateDs = ds;
    // Réinitialiser le slot si on change de date
    if (_selectedSlotData && (_selectedSlotData.slot_date || '').split('T')[0] !== ds) {
        _selectedSlotId = null;
        _selectedSlotData = null;
        const emptyEl = document.getElementById('booking-form-empty');
        const contentEl = document.getElementById('booking-form-content');
        if (emptyEl) emptyEl.style.display = 'flex';
        if (contentEl) contentEl.style.display = 'none';
    }
    renderBookingMonth();
    const daySlots = _availableSlots.filter(s => (s.slot_date || '').split('T')[0] === ds);
    const sep = document.getElementById('booking-day-separator');
    const lbl = document.getElementById('booking-slots-date-label');
    const container = document.getElementById('booking-slots-day');
    if (!sep || !lbl || !container) return;

    sep.style.display = 'block';
    const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    lbl.textContent = dateStr;

    if (!daySlots.length) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:#94A3B8;font-size:.82rem">Aucun créneau ce jour.</div>';
        return;
    }

    container.style.gridTemplateColumns = 'repeat(4,1fr)';
    container.innerHTML = daySlots.map(function (s) {
        const time = (s.start_time || '').substring(0, 5);
        const dur = s.duration_min || 30;
        return '<button onclick="selectBookingSlot(' + s.id + ')" data-slot-id="' + s.id + '" class="bk-slot">'
            + time
            + '<span style="display:block;font-size:.62rem;font-weight:400;color:inherit;opacity:.7;margin-top:1px">' + dur + ' min</span>'
            + '</button>';
    }).join('');
}

function selectBookingSlot(slotId) {
    _selectedSlotId = slotId;
    _selectedSlotData = _availableSlots.find(s => s.id === slotId);

    document.querySelectorAll('#booking-slots-day .bk-slot').forEach(function (btn) {
        btn.classList.toggle('selected', parseInt(btn.dataset.slotId) === slotId);
    });

    const emptyEl = document.getElementById('booking-form-empty');
    const contentEl = document.getElementById('booking-form-content');
    const banner = document.getElementById('bk-selected-banner');
    const bannerText = document.getElementById('bk-selected-text');
    if (emptyEl) emptyEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'flex';
    if (banner) banner.style.display = 'block';

    if (_selectedSlotData) {
        const ds = (_selectedSlotData.slot_date || '').split('T')[0];
        const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
        const startT = (_selectedSlotData.start_time || '').substring(0, 5);
        const endT = (_selectedSlotData.end_time || '').substring(0, 5);
        const dur = _selectedSlotData.duration_min || 30;
        const formLbl = document.getElementById('bk-form-slot-label');
        const formDur = document.getElementById('bk-form-slot-dur');
        if (formLbl) formLbl.textContent = dateStr + ' · ' + startT + ' – ' + endT;
        if (formDur) formDur.textContent = dur + ' min · Vidéo ou téléphone';
        if (bannerText) bannerText.textContent = dateStr + ' · ' + startT;
    }

    // Step 2 active
    const s2 = document.getElementById('bk-step2-wrap');
    const s3 = document.getElementById('bk-step3-wrap');
    if (s2) { s2.style.opacity = '1'; const d = s2.querySelector('.bk-step-dot2'); if (d) d.style.background = '#10B981'; }
    if (s3) { s3.style.opacity = '1'; const d = s3.querySelector('.bk-step-dot3'); if (d) d.style.background = '#1B4F8A'; }

    const name = document.getElementById('sidebar-name')?.textContent?.trim() || '';
    const company = document.getElementById('sidebar-company')?.textContent?.trim() || '';
    const avEl = document.getElementById('booking-client-avatar');
    const nameEl = document.getElementById('booking-client-name-label');
    if (avEl) avEl.textContent = (name || 'CL').split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
    if (nameEl) nameEl.textContent = name + (company ? ' — ' + company : '');

    const err = document.getElementById('np-booking-err');
    const suc = document.getElementById('np-booking-success');
    const btn = document.getElementById('np-booking-confirm-btn');
    if (err) err.style.display = 'none';
    if (suc) suc.style.display = 'none';
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Confirmer le rendez-vous'; }
}

function resetBookingSelection() {
    _selectedSlotId = null;
    _selectedSlotData = null;
    _selectedDateDs = null;
    const emptyEl = document.getElementById('booking-form-empty');
    const contentEl = document.getElementById('booking-form-content');
    const banner = document.getElementById('bk-selected-banner');
    const sep = document.getElementById('booking-day-separator');
    const slotsDay = document.getElementById('booking-slots-day');
    if (emptyEl) emptyEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';
    if (banner) banner.style.display = 'none';
    // Vider les créneaux et le séparateur
    if (sep) sep.style.display = 'none';
    if (slotsDay) slotsDay.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem .5rem">'
        + '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" stroke-width="1.5" stroke-linecap="round" style="display:block;margin:0 auto .5rem"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
        + '<div style="font-size:.78rem;font-weight:600;color:#CBD5E0">Sélectionnez une date bleue</div>'
        + '</div>';
    // Reset step indicators
    const s2 = document.getElementById('bk-step2-wrap');
    const s3 = document.getElementById('bk-step3-wrap');
    if (s2) { s2.style.opacity = '.4'; const d = s2.querySelector('.bk-step-dot2'); if (d) d.style.background = '#94A3B8'; }
    if (s3) { s3.style.opacity = '.4'; const d = s3.querySelector('.bk-step-dot3'); if (d) d.style.background = '#94A3B8'; }
    // Re-render le calendrier pour déselectionner la date
    renderBookingMonth();
}

async function confirmBooking() {
    if (!_selectedSlotId) return;
    const subject = document.getElementById('booking-subject')?.value?.trim();
    const meetType = document.getElementById('booking-meet-type')?.value || 'video';
    const btn = document.getElementById('booking-confirm-btn');
    const err = document.getElementById('booking-error');
    const res = document.getElementById('booking-result');
    if (err) err.style.display = 'none';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Réservation en cours...'; }

    try {
        const token = localStorage.getItem('vnk-token');
        const resp = await fetch('/api/calendar/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                slot_id: _selectedSlotId, subject, meeting_type: meetType,
                notes_client: document.getElementById('booking-notes')?.value?.trim() || null
            })
        });
        const data = await resp.json();
        if (data.success) {
            const ds = (_selectedSlotData?.slot_date || '').split('T')[0];
            const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
            const time = (_selectedSlotData?.start_time || '').substring(0, 5);
            const resText = document.getElementById('booking-result-text');
            if (resText) resText.textContent = dateStr + ' à ' + time;
            if (res) res.style.display = 'block';
            if (btn) btn.style.display = 'none';
            // Retirer le créneau localement
            _availableSlots = _availableSlots.filter(s => s.id !== _selectedSlotId);
            renderBookingMonth();
            if (typeof pushPortalNotif === 'function') {
                pushPortalNotif('mandate', 'RDV confirmé — ' + dateStr + ' à ' + time, null);
            }
        } else {
            throw new Error(data.message || 'Créneau non disponible');
        }
    } catch (e) {
        if (err) { err.textContent = 'Erreur : ' + e.message; err.style.display = 'block'; }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Confirmer le rendez-vous';
        }
    }
}

// Alias compatibilité
function loadAvailableSlots() { initBookingTab(); }
// ═══════════════════════════════════════════════════════════
// MES DEMANDES — Page statut des demandes de projet du client
// ═══════════════════════════════════════════════════════════
async function loadMyRequests() {
    const container = document.getElementById('my-requests-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:2rem;color:#94A3B8;font-size:0.82rem">Chargement...</div>';

    try {
        const token = localStorage.getItem('vnk-token');
        // Cache:no-store pour toujours avoir le statut à jour
        const resp = await fetch('/api/messages', {
            headers: { 'Authorization': 'Bearer ' + token, 'Cache-Control': 'no-store' }
        });
        const data = await resp.json();
        if (!data.success) throw new Error('Erreur chargement');

        const allMsgs = [];
        (data.threads || []).forEach(t => {
            (t.messages || []).forEach(m => {
                if (m.content && m.content.includes('🚀 NOUVELLE DEMANDE DE PROJET') && m.sender === 'client') {
                    allMsgs.push({ ...m, request_status: m.request_status || 'new' });
                }
            });
        });
        (data.messages || []).forEach(m => {
            if (m.content && m.content.includes('🚀 NOUVELLE DEMANDE DE PROJET') && m.sender === 'client') {
                if (!allMsgs.find(x => x.id === m.id)) allMsgs.push({ ...m, request_status: m.request_status || 'new' });
            }
        });

        // Badge dot si des demandes ont changé de statut
        const hasUpdate = allMsgs.some(r => r.request_status === 'in_progress' || r.request_status === 'converted');
        const badge = document.getElementById('badge-my-requests');
        if (badge) badge.style.display = hasUpdate ? 'inline-block' : 'none';

        // Tri
        const sortVal = document.getElementById('req-sort-portal')?.value || 'urgent';
        const statusFilter = document.getElementById('req-status-portal')?.value || 'all';

        let filtered = [...allMsgs];
        if (statusFilter !== 'all') filtered = filtered.filter(r => r.request_status === statusFilter);

        if (sortVal === 'date_asc') filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        else if (sortVal === 'urgent') filtered.sort((a, b) => {
            const u = r => { const l = (r.content || '').split('\n').find(x => x.startsWith('Urgence')); return l && l.includes('Critique') ? 0 : l && l.includes('Urgent') ? 1 : 2; };
            const us = u(a) - u(b);
            return us !== 0 ? us : new Date(b.created_at) - new Date(a.created_at);
        });
        else filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        window._lastMyRequests = filtered;
        renderMyRequests(filtered);
    } catch (e) {
        if (container) container.innerHTML = '<div style="text-align:center;padding:2rem;color:#DC2626;font-size:0.82rem">Erreur de chargement. Vérifiez votre connexion.</div>';
    }
}


function renderMyRequests(requests, force) {
    const container = document.getElementById('my-requests-list');
    if (!container) return;

    if (!requests.length) {
        container.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#94A3B8">'
            + '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5" stroke-linecap="round" style="display:block;margin:0 auto 0.75rem"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>'
            + '<div style="font-size:0.85rem;font-weight:600;color:#475569">Aucune demande</div>'
            + '<div style="font-size:0.75rem;margin-top:4px">Cliquez sur &quot;+ Démarrer un projet&quot; en haut à droite</div>'
            + '</div>';
        return;
    }

    // Si le nombre de cartes correspond et pas de force → patch doux sans re-render
    const existingCards = container.querySelectorAll('[data-req-id]');
    if (!force && existingCards.length === requests.length) {
        requests.forEach(req => {
            const st = req.request_status || 'new';
            const card = container.querySelector('[data-req-id="' + (req.message_id || req.id) + '"]');
            if (!card) return;
            const prevSt = card.dataset.reqStatus;
            if (prevSt === st) return; // Rien à changer
            // Mettre à jour seulement le badge statut et la timeline
            card.dataset.reqStatus = st;
            const statusCfg = {
                new: { label: 'Reçue', color: '#1B4F8A', bg: '#EBF5FB', step: 0, desc: "Votre demande a été reçue. Nous l'analysons." },
                in_progress: { label: 'En traitement', color: '#D97706', bg: '#FEF3C7', step: 1, desc: 'Un technicien VNK travaille sur votre demande.' },
                converted: { label: 'Devis en cours', color: '#059669', bg: '#D1FAE5', step: 2, desc: 'Un devis est en cours de préparation pour vous.' },
                closed: { label: 'Traitée', color: '#64748B', bg: '#F1F5F9', step: 3, desc: 'Votre demande a été traitée. Vérifiez vos devis.' },
            };
            const sc = statusCfg[st] || statusCfg.new;
            const badge = card.querySelector('[data-role="status-badge"]');
            if (badge) {
                badge.style.background = sc.bg;
                badge.style.color = sc.color;
                badge.innerHTML = '<span style="font-size:0.72rem;font-weight:700;color:' + sc.color + '">' + sc.label + '</span>'
                    + '<span style="font-size:0.67rem;color:' + sc.color + ';opacity:0.8">— ' + sc.desc + '</span>';
            }
        });
        return;
    }

    const statusCfg = {
        new: { label: 'Reçue', color: '#1B4F8A', bg: '#EBF5FB', step: 0, desc: "Votre demande a été reçue. Nous l\'analysons." },
        in_progress: { label: 'En traitement', color: '#D97706', bg: '#FEF3C7', step: 1, desc: 'Un technicien VNK travaille sur votre demande.' },
        converted: { label: 'Devis en cours', color: '#059669', bg: '#D1FAE5', step: 2, desc: 'Un devis est en cours de préparation pour vous.' },
        closed: { label: 'Traitée', color: '#64748B', bg: '#F1F5F9', step: 3, desc: 'Votre demande a été traitée. Vérifiez vos devis.' },
    };
    const STEPS = ['new', 'in_progress', 'converted', 'closed'];
    const STEP_LABELS = ['Reçue', 'En traitement', 'Devis', 'Traitée'];

    const relTime = iso => {
        const d = Date.now() - new Date(iso).getTime();
        if (d < 3600000) return Math.floor(d / 60000) + ' min';
        if (d < 86400000) return Math.floor(d / 3600000) + 'h';
        if (d < 604800000) return Math.floor(d / 86400000) + 'j';
        return new Date(iso).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' });
    };
    const fmtDate = d => new Date(d).toLocaleDateString('fr-CA', { day: '2-digit', month: 'long', year: 'numeric' });

    const view = (typeof _reqView !== 'undefined') ? _reqView : 'cards';

    // ── VUE LISTE ──────────────────────────────────────────────
    if (view === 'list') {
        const rows = requests.map(req => {
            const lines = (req.content || '').split('\n');
            const pf = k => { const l = lines.find(x => x.startsWith(k)); return l ? l.replace(k, '').trim() : '—'; };
            const service = pf('Service     :');
            const automate = pf('Automate    :');
            const urgency = pf('Urgence     :');
            const st = req.request_status || 'new';
            const sc = statusCfg[st] || statusCfg.new;
            const isCrit = urgency.includes('Critique');
            const isUrg = urgency.includes('Urgent') || isCrit;

            return '<div class="requests-list-row" style="display:grid;grid-template-columns:2fr 140px 1fr auto;align-items:center;gap:1rem;padding:0.75rem 1rem;border-bottom:1px solid #F1F5F9;cursor:default;transition:background .1s" onmouseenter="this.style.background=\'#F8FAFC\'" onmouseleave="this.style.background=\'white\'">'
                // Col 1 : service + automate
                + '<div style="min-width:0">'
                + '<div style="font-weight:600;font-size:0.85rem;color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + service + '</div>'
                + '<div style="font-size:0.68rem;color:#94A3B8;margin-top:1px">'
                + (automate !== '—' ? automate + ' · ' : '')
                + fmtDate(req.created_at)
                + '</div>'
                + '</div>'
                // Col 2 : timeline compacte
                + '<div style="display:flex;align-items:center;gap:1px">'
                + STEPS.map((s, i) => {
                    const done = i <= sc.step;
                    const cfg = statusCfg[s];
                    return '<div style="width:' + (i < STEPS.length - 1 ? '24px' : '0') + ';height:2px;background:' + (i < sc.step ? cfg.color : '#E2E8F0') + '"></div>'
                        + '<div style="width:10px;height:10px;border-radius:50%;background:' + (done ? cfg.bg : '#F8FAFC') + ';border:1.5px solid ' + (done ? cfg.color : '#E2E8F0') + ';flex-shrink:0" title="' + STEP_LABELS[i] + '"></div>';
                }).join('')
                + '</div>'
                // Col 3 : urgence + temps
                + '<div style="font-size:0.7rem;color:#94A3B8;text-align:right">'
                + (isCrit ? '<span style="color:#DC2626;font-weight:700">🚨 Critique</span> · ' : isUrg ? '<span style="color:#D97706;font-weight:700">⚡ Urgent</span> · ' : '')
                + relTime(req.created_at)
                + '</div>'
                // Col 4 : badge statut
                + '<span style="font-size:0.68rem;font-weight:700;padding:3px 10px;border-radius:20px;background:' + sc.bg + ';color:' + sc.color + ';white-space:nowrap;flex-shrink:0">' + sc.label + '</span>'
                + '</div>';
        }).join('');
        container.innerHTML = '<div style="background:white;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">' + rows + '</div>';
        return;
    }

    // ── VUE GRILLE 3 colonnes ──────────────────────────────────
    const cards = requests.map(req => {
        const lines = (req.content || '').split('\n');
        const pf = k => { const l = lines.find(x => x.startsWith(k)); return l ? l.replace(k, '').trim() : '—'; };
        const service = pf('Service     :');
        const automate = pf('Automate    :');
        const urgency = pf('Urgence     :');
        const budget = pf('Budget est. :');
        const di = lines.findIndex(l => l === 'DESCRIPTION :');
        const desc = di > -1 ? lines.slice(di + 1).filter(l => l && !l.startsWith('DÉTAILS') && !l.startsWith('──')).join(' ').trim().substring(0, 100) : '';
        const st = req.request_status || 'new';
        const sc = statusCfg[st] || statusCfg.new;
        const stepIdx = sc.step;
        const isCrit = urgency.includes('Critique');
        const isUrg = urgency.includes('Urgent') || isCrit;

        // Timeline 4 étapes compacte
        const timeline = '<div style="display:flex;align-items:center;gap:0;margin-bottom:0.6rem">'
            + STEPS.map((s, i) => {
                const done = i <= stepIdx;
                const cur = i === stepIdx;
                const cfg = statusCfg[s];
                return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;z-index:1">'
                    + '<div style="width:20px;height:20px;border-radius:50%;background:' + (done ? cfg.bg : '#F8FAFC') + ';border:2px solid ' + (done ? cfg.color : '#E2E8F0') + ';display:flex;align-items:center;justify-content:center;font-size:0.55rem;font-weight:800;color:' + (done ? cfg.color : '#CBD5E0') + '">'
                    + (done && !cur ? '✓' : (i + 1))
                    + '</div>'
                    + '<span style="font-size:0.55rem;color:' + (done ? cfg.color : '#94A3B8') + ';font-weight:' + (cur ? '700' : '500') + ';text-align:center;line-height:1.2;white-space:nowrap">' + STEP_LABELS[i] + '</span>'
                    + '</div>'
                    + (i < STEPS.length - 1 ? '<div style="flex:1;height:1.5px;background:' + (i < stepIdx ? statusCfg[STEPS[i]].color : '#E2E8F0') + ';margin-bottom:14px"></div>' : '');
            }).join('')
            + '</div>';

        return '<div data-req-id="' + (req.message_id || req.id) + '" data-req-status="' + st + '" style="background:white;border:1.5px solid ' + (isCrit ? '#FECACA' : '#E8EEF6') + ';border-radius:12px;padding:0.9rem;display:flex;flex-direction:column;gap:0.45rem;transition:box-shadow .15s" onmouseenter="this.style.boxShadow=\'0 2px 8px rgba(27,79,138,0.07)\'" onmouseleave="this.style.boxShadow=\'\'">'

            // Ligne 1 : service + urgence + temps
            + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem">'
            + '<div style="min-width:0;flex:1">'
            + '<div style="font-weight:700;font-size:0.82rem;color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + service + '</div>'
            + '<div style="font-size:0.67rem;color:#94A3B8;margin-top:1px">' + (automate !== '—' ? automate + ' · ' : '') + fmtDate(req.created_at) + '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:0.3rem;flex-shrink:0">'
            + (isCrit ? '<span style="font-size:0.58rem;font-weight:700;color:#DC2626;background:#FEE2E2;padding:1px 5px;border-radius:5px">🚨</span>' : isUrg ? '<span style="font-size:0.58rem;font-weight:700;color:#D97706;background:#FEF3C7;padding:1px 5px;border-radius:5px">⚡</span>' : '')
            + '<span style="font-size:0.62rem;color:#94A3B8">' + relTime(req.created_at) + '</span>'
            + '</div>'
            + '</div>'

            // Timeline
            + timeline

            // Statut actuel
            + '<div data-role="status-badge" style="background:' + sc.bg + ';border-radius:7px;padding:0.4rem 0.65rem;display:flex;align-items:center;gap:0.4rem">'
            + '<span style="font-size:0.72rem;font-weight:700;color:' + sc.color + '">' + sc.label + '</span>'
            + '<span style="font-size:0.67rem;color:' + sc.color + ';opacity:0.8">— ' + sc.desc + '</span>'
            + '</div>'

            // Description courte
            + (desc ? '<div style="font-size:0.7rem;color:#64748B;line-height:1.4;border-left:2px solid #E2E8F0;padding-left:0.55rem">' + desc + (desc.length >= 100 ? '…' : '') + '</div>' : '')
            + (budget !== '—' && budget !== 'Non défini' ? '<div style="font-size:0.67rem;color:#94A3B8">Budget : <strong style="color:#475569">' + budget + '</strong></div>' : '')

            + '</div>';
    }).join('');

    container.innerHTML = '<div class="requests-cards-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.65rem;padding:0.25rem 0">' + cards + '</div>';
}

// ═══════════════════════════════════════════════════════════
// SWITCHER MANDATS / MES DEMANDES
// ═══════════════════════════════════════════════════════════
let _reqView = 'cards'; // 'cards' ou 'list'

function setReqView(view) {
    _reqView = view;
    const btnCards = document.getElementById('req-view-cards-btn');
    const btnList = document.getElementById('req-view-list-btn');
    if (btnCards) { btnCards.style.background = view === 'cards' ? '#1B4F8A' : 'transparent'; btnCards.style.color = view === 'cards' ? 'white' : '#94A3B8'; }
    if (btnList) { btnList.style.background = view === 'list' ? '#1B4F8A' : 'transparent'; btnList.style.color = view === 'list' ? 'white' : '#94A3B8'; }
    renderMyRequests(window._lastMyRequests || []);
}

function switchMandatesSubTab(tab) {
    const mandats = document.getElementById('mandates-sub-content-mandats');
    const requests = document.getElementById('mandates-sub-content-requests');
    const btnMandats = document.getElementById('mandates-sub-mandats');
    const btnRequests = document.getElementById('mandates-sub-requests');

    // Persister le choix
    localStorage.setItem('vnk-portal-mandates-subtab', tab);

    if (tab === 'mandats') {
        if (mandats) mandats.style.display = 'block';
        if (requests) requests.style.display = 'none';
        if (btnMandats) { btnMandats.style.background = '#1B4F8A'; btnMandats.style.color = 'white'; btnMandats.style.border = 'none'; }
        if (btnRequests) { btnRequests.style.background = 'white'; btnRequests.style.color = '#64748B'; btnRequests.style.border = '1.5px solid #E2E8F0'; }
        const svgReq = btnRequests?.querySelector('svg'); if (svgReq) svgReq.style.stroke = '#64748B';
        const svgMan = btnMandats?.querySelector('svg'); if (svgMan) svgMan.style.stroke = 'white';
    } else {
        if (mandats) mandats.style.display = 'none';
        if (requests) { requests.style.display = 'flex'; requests.style.flexDirection = 'column'; }
        if (btnRequests) { btnRequests.style.background = '#1B4F8A'; btnRequests.style.color = 'white'; btnRequests.style.border = 'none'; }
        if (btnMandats) { btnMandats.style.background = 'white'; btnMandats.style.color = '#64748B'; btnMandats.style.border = '1.5px solid #E2E8F0'; }
        const svgReq = btnRequests?.querySelector('svg'); if (svgReq) svgReq.style.stroke = 'white';
        const svgMan = btnMandats?.querySelector('svg'); if (svgMan) svgMan.style.stroke = '#64748B';
        const badge = document.getElementById('badge-my-requests');
        if (badge) badge.style.display = 'none';
        loadMyRequests();
    }
}
// ── Alias confirmBookingSlot → npConfirmBooking ───────────────
function confirmBookingSlot() {
    if (!_selectedSlotId || !_selectedSlotData) return;
    // Map to npConfirmBooking variables
    _npSelectedSlot = {
        id: _selectedSlotId,
        ds: (_selectedSlotData.slot_date || '').split('T')[0],
        time: (_selectedSlotData.start_time || '').substring(0, 5),
        dur: _selectedSlotData.duration_min || 30
    };
    const subject = document.getElementById('booking-subject')?.value?.trim() || '';
    const meetType = window._bkMeetType || 'video';
    const btn = document.getElementById('np-booking-confirm-btn');
    const err = document.getElementById('np-booking-err');
    const suc = document.getElementById('np-booking-success');
    const sucTxt = document.getElementById('np-booking-success-text');
    if (err) err.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Réservation en cours...'; }

    const token = localStorage.getItem('vnk-token');
    fetch('/api/calendar/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ slot_id: _selectedSlotId, subject, meeting_type: meetType })
    }).then(r => r.json()).then(data => {
        if (data.success) {
            const dateStr = new Date(_npSelectedSlot.ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
            if (sucTxt) sucTxt.textContent = dateStr + ' à ' + _npSelectedSlot.time + ' — Vous recevrez une confirmation par courriel.';
            if (suc) suc.style.display = 'block';
            if (btn) {
                btn.disabled = false;
                btn.style.display = 'flex';
                btn.style.background = '#059669';
                btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Réserver un autre créneau';
                btn.onclick = function () { resetBookingSelection(); btn.style.background = '#0F172A'; btn.onmouseenter = function () { this.style.background = '#1B4F8A'; }; btn.onmouseleave = function () { this.style.background = '#0F172A'; }; };
            }
            _availableSlots = (_availableSlots || []).filter(s => s.id !== _selectedSlotId);
            _selectedSlotId = null; _selectedSlotData = null; _selectedDateDs = null;
            setTimeout(() => { loadMyAppointments(); renderBookingMonth(); }, 800);
        } else {
            throw new Error(data.message || 'Créneau non disponible');
        }
    }).catch(e => {
        if (err) { err.textContent = e.message; err.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Confirmer le rendez-vous'; }
    });
}

// ── bkSetMeetType ─────────────────────────────────────────────
function bkSetMeetType(type, btn) {
    window._bkMeetType = type;
    document.querySelectorAll('#tab-booking .bk-fmt').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

// ── bkToggleAppts ─────────────────────────────────────────────
function bkToggleAppts() {
    const panel = document.getElementById('bk-appts-panel');
    const arrow = document.getElementById('bk-accordion-arrow');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'flex';
    if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

// ── Modal détail RDV client ────────────────────────────────────
function openApptDetailModal(apptId) {
    const all = window._allMyAppts || [];
    const a = all.find(x => x.id === apptId);
    if (!a) return;

    const ds = (a.appointment_date || '').split('T')[0];
    const dateStr = ds ? new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const timeStr = (a.start_time || '').substring(0, 5) + ' – ' + (a.end_time || '').substring(0, 5);
    const isCancelled = a.status === 'cancelled';
    const isPast = ds < new Date().toISOString().split('T')[0];
    const statusColor = isCancelled ? '#EF4444' : '#10B981';
    const statusLabel = isCancelled ? 'Annulé' : 'Confirmé';

    const existing = document.getElementById('appt-detail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'appt-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';

    overlay.innerHTML = `
    <div style="background:white;border-radius:20px;width:100%;max-width:460px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.25);margin:1rem">
        <!-- Header gradient -->
        <div style="background:linear-gradient(135deg,#1B4F8A,#1d4ed8);padding:1.4rem 1.5rem 1.1rem;position:relative">
            <button onclick="document.getElementById('appt-detail-overlay').remove()" style="position:absolute;top:.85rem;right:.85rem;background:rgba(255,255,255,.15);border:none;color:white;border-radius:8px;width:28px;height:28px;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s" onmouseenter="this.style.background='rgba(255,255,255,.25)'" onmouseleave="this.style.background='rgba(255,255,255,.15)'">×</button>
            <div style="font-size:.6rem;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.35rem">Détails du rendez-vous</div>
            <div style="font-size:1.05rem;font-weight:800;color:white;text-transform:capitalize;margin-bottom:.25rem">${dateStr}</div>
            <div style="font-size:.85rem;font-weight:600;color:rgba(255,255,255,.75)">${timeStr} · ${a.duration_min || 30} min</div>
            <div style="margin-top:.65rem">
                <span style="background:rgba(255,255,255,.18);color:white;font-size:.68rem;font-weight:700;padding:3px 10px;border-radius:20px">${statusLabel}</span>
                ${a.meeting_type === 'phone'
            ? '<span style="background:rgba(255,255,255,.12);color:rgba(255,255,255,.8);font-size:.65rem;padding:3px 9px;border-radius:20px;margin-left:.4rem">📞 Téléphone</span>'
            : '<span style="background:rgba(255,255,255,.12);color:rgba(255,255,255,.8);font-size:.65rem;padding:3px 9px;border-radius:20px;margin-left:.4rem">📹 Vidéo</span>'}
            </div>
        </div>

        <!-- Contenu -->
        <div style="padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:.85rem">

            <!-- Avec qui -->
            <div style="display:flex;align-items:center;gap:.75rem;padding:.7rem .85rem;background:#F8FAFC;border-radius:12px;border:1px solid #F1F5F9">
                <div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#1B4F8A,#2563EB);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg width="18" height="18" viewBox="0 0 40 40" fill="none"><polygon points="20,4 36,32 4,32" fill="white"/></svg>
                </div>
                <div>
                    <div style="font-size:.7rem;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:1px">Avec</div>
                    <div style="font-size:.88rem;font-weight:700;color:#0F172A">VNK Automatisation Inc.</div>
                    <div style="font-size:.72rem;color:#64748B">Yan Verone — Spécialiste automatisation</div>
                </div>
            </div>

            <!-- Sujet -->
            ${a.subject ? `<div>
                <div style="font-size:.68rem;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Sujet</div>
                <div style="font-size:.85rem;color:#0F172A;font-weight:600">${a.subject}</div>
            </div>` : ''}

            <!-- Lien de réunion -->
            <div>
                <div style="font-size:.68rem;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem">Lien de réunion</div>
                ${a.meeting_link
            ? `<a href="${a.meeting_link}" target="_blank" style="display:flex;align-items:center;gap:.5rem;padding:.6rem .85rem;background:#EBF5FB;border:1.5px solid #BFDBFE;border-radius:10px;text-decoration:none;transition:all .12s" onmouseenter="this.style.background='#DBEAFE'" onmouseleave="this.style.background='#EBF5FB'">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        <span style="font-size:.8rem;font-weight:700;color:#1B4F8A;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.meeting_link}</span>
                        <span style="font-size:.65rem;font-weight:700;background:#1B4F8A;color:white;padding:2px 8px;border-radius:6px;flex-shrink:0">Rejoindre</span>
                    </a>
                    ${(a.meeting_id || a.meeting_password) ? `<div style="display:flex;gap:.5rem;margin-top:.45rem">
                        ${a.meeting_id ? `<div style="flex:1;padding:.4rem .65rem;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px">
                            <div style="font-size:.6rem;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em">ID réunion</div>
                            <div style="font-size:.78rem;font-weight:700;color:#0F172A;margin-top:1px">${a.meeting_id}</div>
                        </div>` : ''}
                        ${a.meeting_password ? `<div style="flex:1;padding:.4rem .65rem;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px">
                            <div style="font-size:.6rem;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em">Mot de passe</div>
                            <div style="font-size:.78rem;font-weight:700;color:#0F172A;margin-top:1px">${a.meeting_password}</div>
                        </div>` : ''}
                    </div>` : ''}`
            : `<div style="padding:.6rem .85rem;background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;display:flex;align-items:center;gap:.5rem">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span style="font-size:.78rem;color:#D97706;font-weight:600">Lien à venir — vous recevrez un courriel</span>
                    </div>`}
            </div>

            <!-- Notes admin visibles par le client -->
            ${a.notes_admin ? `<div style="padding:.65rem .85rem;background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:10px">
                <div style="font-size:.65rem;font-weight:700;color:#15803D;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Note de VNK</div>
                <div style="font-size:.78rem;color:#15803D;line-height:1.55">${a.notes_admin}</div>
            </div>` : ''}
        </div>

        <!-- Footer -->
        <div style="padding:.85rem 1.5rem;border-top:1px solid #F1F5F9;display:flex;gap:.5rem">
            <button onclick="document.getElementById('appt-detail-overlay').remove()" style="flex:1;padding:.52rem;border:1.5px solid #E2E8F0;border-radius:10px;background:white;font-size:.8rem;cursor:pointer;font-family:inherit;color:#64748B;transition:all .12s" onmouseenter="this.style.borderColor='#94A3B8'" onmouseleave="this.style.borderColor='#E2E8F0'">Fermer</button>
            ${!isCancelled && !isPast
            ? `<button onclick="openRescheduleModal(${a.id})" style="flex:1;padding:.52rem;border:1.5px solid #DBEAFE;border-radius:10px;background:#EFF6FF;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit;color:#1B4F8A;transition:all .12s;display:flex;align-items:center;justify-content:center;gap:.35rem" onmouseenter="this.style.background='#DBEAFE'" onmouseleave="this.style.background='#EFF6FF'">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Changer
                </button>
                <button onclick="document.getElementById('appt-detail-overlay').remove();cancelMyAppointment(${a.id})" style="flex:1;padding:.52rem;border:1.5px solid #FECACA;border-radius:10px;background:white;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit;color:#DC2626;transition:all .12s" onmouseenter="this.style.background='#FEF2F2'" onmouseleave="this.style.background='white'">Annuler</button>`
            : (a.meeting_link && !isCancelled && !isPast
                ? `<a href="${a.meeting_link}" target="_blank" style="flex:2;padding:.52rem;border:none;border-radius:10px;background:linear-gradient(135deg,#1B4F8A,#2563EB);color:white;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:.4rem;box-shadow:0 2px 8px rgba(27,79,138,.3)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/></svg>
                    Rejoindre
                </a>`
                : '')}
        </div>
    </div>`;

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

// ════════════════════════════════════════════════════════════════
// RESCHEDULE — Changer un rendez-vous existant
// ════════════════════════════════════════════════════════════════

let _rsApptId = null;
let _rsSlots = [];
let _rsMonthOffset = 0;
let _rsSelectedSlot = null;
let _rsSelectedDate = null;

async function openRescheduleModal(apptId) {
    _rsApptId = apptId;
    _rsSlots = [];
    _rsMonthOffset = 0;
    _rsSelectedSlot = null;
    _rsSelectedDate = null;

    // Retirer le modal détail s'il est ouvert
    const prev = document.getElementById('appt-detail-overlay');
    if (prev) prev.remove();

    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.id = 'rs-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,0.75);z-index:9500;backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center';

    overlay.innerHTML = `
    <div style="background:white;border-radius:18px;width:100%;max-width:640px;max-height:92vh;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.35);display:flex;flex-direction:column">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1B4F8A,#2563EB);padding:1.1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
            <div>
                <div style="font-size:1rem;font-weight:800;color:white">Changer le rendez-vous</div>
                <div style="font-size:0.75rem;color:rgba(255,255,255,.7);margin-top:2px">Choisissez un nouveau créneau</div>
            </div>
            <button onclick="document.getElementById('rs-overlay').remove()" style="background:rgba(255,255,255,.15);border:none;border-radius:8px;color:white;font-size:1.1rem;cursor:pointer;padding:.3rem .65rem;line-height:1">×</button>
        </div>

        <!-- Corps -->
        <div style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1">

            <!-- Info bande -->
            <div style="display:flex;align-items:center;gap:.75rem;padding:.7rem .9rem;background:linear-gradient(135deg,#F0F7FF,#EBF5FB);border-radius:10px;margin-bottom:1rem;border:1px solid #DBEAFE">
                <div style="width:32px;height:32px;border-radius:8px;background:#1B4F8A;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                    <div style="font-size:.82rem;font-weight:700;color:#0F172A">Appel de qualification</div>
                    <div style="font-size:.72rem;color:#64748B">30 min · Vidéo ou téléphone · Gratuit</div>
                </div>
            </div>

            <!-- Chargement -->
            <div id="rs-loading" style="text-align:center;padding:2.5rem;color:#94A3B8;font-size:.85rem">
                <div style="width:32px;height:32px;border-radius:50%;border:3px solid #E2E8F0;border-top-color:#1B4F8A;animation:np-spin .8s linear infinite;margin:0 auto .85rem"></div>
                Chargement des disponibilités...
            </div>

            <!-- Calendrier split -->
            <div id="rs-cal-wrap" style="display:none">
                <div style="display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #E2E8F0;border-radius:14px;overflow:hidden">

                    <!-- Gauche : calendrier -->
                    <div style="padding:1rem;border-right:1.5px solid #E2E8F0;background:#FAFBFC">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem">
                            <button onclick="rsNavMonth(-1)" style="width:28px;height:28px;border-radius:50%;background:white;border:1.5px solid #E2E8F0;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748B;font-family:inherit;transition:all .12s" onmouseenter="this.style.borderColor='#1B4F8A';this.style.color='#1B4F8A'" onmouseleave="this.style.borderColor='#E2E8F0';this.style.color='#64748B'">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <div id="rs-month-label" style="font-size:.82rem;font-weight:800;color:#0F172A;text-transform:capitalize"></div>
                            <button onclick="rsNavMonth(1)" style="width:28px;height:28px;border-radius:50%;background:white;border:1.5px solid #E2E8F0;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748B;font-family:inherit;transition:all .12s" onmouseenter="this.style.borderColor='#1B4F8A';this.style.color='#1B4F8A'" onmouseleave="this.style.borderColor='#E2E8F0';this.style.color='#64748B'">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:.35rem">
                            ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div style="text-align:center;font-size:.6rem;font-weight:700;color:#94A3B8;padding:3px 0">${d}</div>`).join('')}
                        </div>
                        <div id="rs-cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px"></div>
                    </div>

                    <!-- Droite : créneaux -->
                    <div style="padding:1rem;display:flex;flex-direction:column">
                        <div id="rs-no-date" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
                            <div style="width:40px;height:40px;border-radius:50%;background:#F1F5F9;display:flex;align-items:center;justify-content:center;margin-bottom:.65rem">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </div>
                            <div style="font-size:.78rem;font-weight:600;color:#94A3B8">Sélectionnez une date</div>
                        </div>
                        <div id="rs-day-slots" style="display:none;flex:1;flex-direction:column">
                            <div id="rs-date-badge" style="background:#1B4F8A;border-radius:10px;padding:.7rem .9rem;margin-bottom:.85rem">
                                <div style="font-size:.6rem;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Nouveau créneau</div>
                                <div id="rs-date-label" style="font-size:.85rem;font-weight:800;color:white;text-transform:capitalize"></div>
                                <div style="font-size:.68rem;color:rgba(255,255,255,.65);margin-top:1px">30 min · Vidéo ou téléphone</div>
                            </div>
                            <div style="font-size:.65rem;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Heure de début</div>
                            <div id="rs-times" style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;overflow-y:auto;max-height:150px"></div>
                        </div>
                    </div>
                </div>

                <!-- Badge sélectionné -->
                <div id="rs-selected-badge" style="display:none;margin-top:.85rem;background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border:1.5px solid #86EFAC;border-radius:12px;padding:.8rem 1rem;align-items:center;gap:.75rem">
                    <div style="width:32px;height:32px;border-radius:50%;background:#059669;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,.3)">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="font-size:.72rem;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px">Nouveau créneau choisi</div>
                        <div id="rs-selected-text" style="font-size:.85rem;font-weight:700;color:#0F172A"></div>
                    </div>
                </div>
            </div>

            <!-- Aucun créneau -->
            <div id="rs-empty" style="display:none;background:#FEF3C7;border:1px solid #FDE68A;border-radius:12px;padding:1.25rem;text-align:center">
                <div style="font-size:.88rem;font-weight:700;color:#92400E;margin-bottom:4px">Aucun créneau disponible</div>
                <div style="font-size:.78rem;color:#92400E">Contactez VNK directement pour reprogrammer.</div>
            </div>
        </div>

        <!-- Footer -->
        <div style="padding:.9rem 1.5rem;border-top:1px solid #F1F5F9;display:flex;gap:.5rem;flex-shrink:0;background:white">
            <button onclick="document.getElementById('rs-overlay').remove()" style="flex:1;padding:.65rem;border:1.5px solid #E2E8F0;border-radius:10px;background:white;font-size:.85rem;cursor:pointer;font-family:inherit;color:#64748B">Annuler</button>
            <button id="rs-confirm-btn" onclick="rsConfirm()" disabled style="flex:2;padding:.65rem;border:none;border-radius:10px;background:#CBD5E1;color:white;font-size:.85rem;font-weight:700;cursor:not-allowed;font-family:inherit;transition:all .15s">Confirmer le nouveau créneau</button>
        </div>
    </div>`;

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Charger les disponibilités
    try {
        const token = localStorage.getItem('vnk-token');
        const resp = await fetch('/api/calendar/available', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await resp.json();
        _rsSlots = data.slots || [];
    } catch (e) { _rsSlots = []; }

    document.getElementById('rs-loading').style.display = 'none';

    if (!_rsSlots.length) {
        document.getElementById('rs-empty').style.display = 'block';
        return;
    }

    // Naviguer au premier mois disponible
    const firstDate = _rsSlots[0]?.slot_date?.split('T')[0];
    if (firstDate) {
        const now = new Date();
        const first = new Date(firstDate + 'T12:00:00');
        _rsMonthOffset = (first.getFullYear() - now.getFullYear()) * 12 + (first.getMonth() - now.getMonth());
    }

    document.getElementById('rs-cal-wrap').style.display = 'block';
    rsRenderCal();
}

function rsNavMonth(dir) {
    _rsMonthOffset += dir;
    rsRenderCal();
    const daySlots = document.getElementById('rs-day-slots');
    const noDate = document.getElementById('rs-no-date');
    if (daySlots) daySlots.style.display = 'none';
    if (noDate) noDate.style.display = 'flex';
}

function rsRenderCal() {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + _rsMonthOffset, 1);
    const year = target.getFullYear();
    const month = target.getMonth();
    const today = now.toISOString().split('T')[0];

    const lbl = document.getElementById('rs-month-label');
    if (lbl) { const r = target.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' }); lbl.textContent = r.charAt(0).toUpperCase() + r.slice(1); }

    const datesWithSlots = new Set(_rsSlots.map(s => (s.slot_date || '').split('T')[0]));
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const grid = document.getElementById('rs-cal-grid');
    if (!grid) return;

    let html = '';
    for (let i = 0; i < startDow; i++) html += '<div style="aspect-ratio:1"></div>';

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const hasSlot = datesWithSlots.has(ds);
        const isPast = ds < today;
        const isSelected = ds === _rsSelectedDate;

        if (!isPast && hasSlot) {
            const bg = isSelected ? '#1B4F8A' : 'white';
            const color = isSelected ? 'white' : '#0F172A';
            const border = isSelected ? '2px solid #1B4F8A' : '2px solid #E2E8F0';
            html += `<div onclick="rsSelectDate('${ds}')" data-rs-date="${ds}" style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:9px;background:${bg};border:${border};cursor:pointer;transition:all .15s" onmouseenter="rsCalHover(this,'${ds}',true)" onmouseleave="rsCalHover(this,'${ds}',false)"><span style="font-size:.75rem;font-weight:700;color:${color};line-height:1">${d}</span><span style="width:4px;height:4px;border-radius:50%;background:${isSelected ? 'rgba(255,255,255,.6)' : '#059669'};margin-top:2px;display:block"></span></div>`;
        } else if (!isPast) {
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:9px"><span style="font-size:.75rem;color:#CBD5E1;font-weight:500">${d}</span></div>`;
        } else {
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:9px"><span style="font-size:.75rem;color:#E2E8F0;font-weight:500">${d}</span></div>`;
        }
    }
    grid.innerHTML = html;
}

function rsCalHover(el, ds, entering) {
    if (ds === _rsSelectedDate) return;
    if (entering) { el.style.background = '#EBF5FB'; el.style.borderColor = '#1B4F8A'; el.querySelector('span').style.color = '#1B4F8A'; }
    else { el.style.background = 'white'; el.style.borderColor = '#E2E8F0'; el.querySelector('span').style.color = '#0F172A'; }
}

function rsSelectDate(ds) {
    _rsSelectedDate = ds;
    _rsSelectedSlot = null;

    // Màj visuel calendrier
    document.querySelectorAll('[data-rs-date]').forEach(function (el) {
        const isThis = el.dataset.rsDate === ds;
        el.style.background = isThis ? '#1B4F8A' : 'white';
        el.style.borderColor = isThis ? '#1B4F8A' : '#E2E8F0';
        const spans = el.querySelectorAll('span');
        if (spans[0]) spans[0].style.color = isThis ? 'white' : '#0F172A';
        if (spans[1]) spans[1].style.background = isThis ? 'rgba(255,255,255,.6)' : '#059669';
    });

    // Afficher colonne droite
    document.getElementById('rs-no-date').style.display = 'none';
    document.getElementById('rs-day-slots').style.display = 'flex';

    // Label date badge
    const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
    const lbl = document.getElementById('rs-date-label');
    if (lbl) lbl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    // Cacher badge sélectionné
    const selBadge = document.getElementById('rs-selected-badge');
    if (selBadge) selBadge.style.display = 'none';
    rsUpdateConfirmBtn();

    // Créneaux du jour
    const daySlotsList = _rsSlots.filter(s => (s.slot_date || '').split('T')[0] === ds);
    const timesEl = document.getElementById('rs-times');
    if (!timesEl) return;

    if (!daySlotsList.length) {
        timesEl.innerHTML = '<div style="font-size:.78rem;color:#94A3B8;grid-column:span 2">Aucun créneau ce jour.</div>';
        return;
    }

    timesEl.innerHTML = daySlotsList.map(function (s) {
        const time = (s.start_time || '').substring(0, 5);
        return `<button onclick="rsSelectSlot(${s.id},'${ds}','${time}',${s.duration_min || 30})" data-rs-slot="${s.id}" style="padding:.55rem .4rem;border:2px solid #E2E8F0;border-radius:8px;background:white;color:#334155;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .12s;text-align:center" onmouseenter="rsTimeHover(this,true)" onmouseleave="rsTimeHover(this,false)">${time}</button>`;
    }).join('');
}

function rsTimeHover(el, entering) {
    if (el.style.background === 'rgb(27, 79, 138)') return;
    if (entering) { el.style.background = '#F0F7FF'; el.style.borderColor = '#93C5FD'; el.style.color = '#1B4F8A'; }
    else { el.style.background = 'white'; el.style.borderColor = '#E2E8F0'; el.style.color = '#334155'; }
}

function rsSelectSlot(slotId, ds, time, dur) {
    _rsSelectedSlot = { id: slotId, ds, time, dur };

    document.querySelectorAll('[data-rs-slot]').forEach(function (btn) {
        const sel = parseInt(btn.dataset.rsSlot) === slotId;
        btn.style.background = sel ? '#1B4F8A' : 'white';
        btn.style.color = sel ? 'white' : '#334155';
        btn.style.borderColor = sel ? '#1B4F8A' : '#E2E8F0';
    });

    const badge = document.getElementById('rs-selected-badge');
    const txt = document.getElementById('rs-selected-text');
    if (txt) {
        const dateStr = new Date(ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
        txt.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + ' · ' + time;
    }
    if (badge) badge.style.display = 'flex';
    rsUpdateConfirmBtn();
}

function rsUpdateConfirmBtn() {
    const btn = document.getElementById('rs-confirm-btn');
    if (!btn) return;
    if (_rsSelectedSlot) {
        btn.disabled = false;
        btn.style.background = '#059669';
        btn.style.cursor = 'pointer';
        btn.textContent = 'Confirmer le nouveau créneau';
    } else {
        btn.disabled = true;
        btn.style.background = '#CBD5E1';
        btn.style.cursor = 'not-allowed';
    }
}

async function rsConfirm() {
    if (!_rsSelectedSlot || !_rsApptId) return;
    const btn = document.getElementById('rs-confirm-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Confirmation...'; btn.style.background = '#64748B'; }

    try {
        const token = localStorage.getItem('vnk-token');
        // Annuler l'ancien RDV
        await fetch('/api/calendar/appointments/' + _rsApptId + '/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
        });
        // Réserver le nouveau
        const resp = await fetch('/api/calendar/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ slot_id: _rsSelectedSlot.id, subject: 'Appel de qualification — reprogrammé', meeting_type: 'video' })
        });
        const data = await resp.json();
        if (data.success) {
            document.getElementById('rs-overlay').remove();
            if (typeof pushPortalNotif === 'function') {
                const dateStr = new Date(_rsSelectedSlot.ds + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
                pushPortalNotif('mandate', 'RDV reprogrammé — ' + dateStr + ' à ' + _rsSelectedSlot.time, 'booking');
            }
            if (typeof loadMyAppointments === 'function') loadMyAppointments();
            if (typeof _bkRenderCal === 'function') _bkRenderCal();
        } else {
            throw new Error(data.message || 'Créneau non disponible');
        }
    } catch (e) {
        if (btn) { btn.disabled = false; btn.style.background = '#DC2626'; btn.textContent = 'Erreur : ' + e.message; }
        setTimeout(() => { if (btn) { btn.disabled = false; btn.style.background = '#059669'; btn.textContent = 'Confirmer le nouveau créneau'; } }, 3000);
    }
}