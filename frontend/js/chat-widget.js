/* ════════════════════════════════════════════════
   VNK Automatisation Inc. — Widget Chat Flottant
   Injecté sur toutes les pages publiques
   ════════════════════════════════════════════════ */
(function () {
    // Ne pas doubler si déjà présent ou si on est dans le portail (qui a son propre onglet messages)
    if (document.getElementById('vnk-chat-widget')) return;

    // ── Créer le widget ──────────────────────────
    const widget = document.createElement('div');
    widget.id = 'vnk-chat-widget';
    widget.className = 'vnk-chat-widget';
    widget.innerHTML = `
        <div class="vnk-chat-panel" id="vnk-chat-panel">
            <div class="vnk-chat-header">
                <div class="vnk-chat-header-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                </div>
                <div class="vnk-chat-header-info">
                    <strong>VNK Automatisation</strong>
                    <span>Disponible maintenant</span>
                </div>
                <div style="position:relative;margin-left:auto;display:flex;align-items:center;gap:4px">
                    <button id="vnk-chat-menu-btn" class="vnk-chat-close" onclick="vnkChatMenuToggle()" title="Options" style="margin-left:0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </button>
                    <button class="vnk-chat-close" onclick="vnkChatToggle()" title="Fermer" style="margin-left:0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div id="vnk-chat-menu" style="display:none;position:absolute;top:calc(100% + 4px);right:0;background:white;border:1.5px solid #E2E8F0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:160px;padding:4px 0;z-index:9999">
                        <div onclick="vnkChatExpand()" id="vnk-expand-btn" style="padding:8px 14px;font-size:0.83rem;cursor:pointer;color:#1E293B;display:flex;align-items:center;gap:8px" class="vnk-menu-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                            Agrandir la fenêtre
                        </div>
                        <div onclick="vnkChatClear()" style="padding:8px 14px;font-size:0.83rem;cursor:pointer;color:#64748B;display:flex;align-items:center;gap:8px" class="vnk-menu-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.29"/></svg>
                            Effacer l'historique
                        </div>
                    </div>
                </div>
            </div>
            <div class="vnk-chat-messages" id="vnk-chat-messages">
                <div class="vnk-chat-msg vnk">
                    <div class="vnk-chat-msg-bubble">Bonjour 👋 Comment puis-je vous aider aujourd&#39;hui ?</div>
                    <div class="vnk-chat-msg-time">VNK Automatisation</div>
                </div>
            </div>
            <div class="vnk-chat-compose">
                <div class="vnk-chat-actions">
                    <button class="vnk-chat-action-btn" onclick="vnkChatAttach()" title="Pièce jointe">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </button>
                    <button class="vnk-chat-action-btn" id="vnk-emoji-btn" onclick="vnkChatToggleEmoji()" title="Emoji">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                    <input type="file" id="vnk-chat-file-input" style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onchange="vnkChatFileSelected(this)">
                </div>
                <div style="display:flex;gap:0.4rem;align-items:flex-end">
                <textarea class="vnk-chat-input" id="vnk-chat-input" rows="1" placeholder="Écrivez votre message..."
                    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();vnkChatSend()}"
                    oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"></textarea>
                <button class="vnk-chat-send" id="vnk-chat-send-btn" onclick="vnkChatSend()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                </button>
                </div>
            </div>
            <!-- Emoji picker -->
            <div id="vnk-emoji-picker" style="display:none;padding:0.6rem;border-top:1px solid #E2E8F0;background:white;flex-wrap:wrap;gap:2px;max-height:120px;overflow-y:auto"></div>
        </div>
        <button class="vnk-chat-bubble" onclick="vnkChatToggle()" title="Contacter VNK">
            <svg id="vnk-chat-icon-closed" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <svg id="vnk-chat-icon-open" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <div class="vnk-chat-unread" id="vnk-chat-unread">0</div>
        </button>`;
    document.body.appendChild(widget);

    // ── État ─────────────────────────────────────
    let _isOpen = false;
    let _messages = [];
    let _sending = false;
    let _polling = null;
    let _unreadCount = 0;

    window.vnkChatToggle = function () {
        _isOpen = !_isOpen;
        const panel = document.getElementById('vnk-chat-panel');
        const iconClosed = document.getElementById('vnk-chat-icon-closed');
        const iconOpen = document.getElementById('vnk-chat-icon-open');
        panel.classList.toggle('open', _isOpen);
        iconClosed.style.display = _isOpen ? 'none' : 'block';
        iconOpen.style.display = _isOpen ? 'block' : 'none';
        if (_isOpen) {
            // Masquer badge
            _unreadCount = 0;
            const badge = document.getElementById('vnk-chat-unread');
            if (badge) badge.style.display = 'none';
            // Charger immédiatement + focus
            vnkChatLoad();
            setTimeout(() => document.getElementById('vnk-chat-input')?.focus(), 150);
        }
    };

    window.vnkChatLoad = async function () {
        const token = localStorage.getItem('vnk-token');
        if (!token) return;
        try {
            const r = await fetch('/api/messages', { headers: { Authorization: 'Bearer ' + token } });
            if (!r.ok) return;
            const d = await r.json();
            const msgs = d.messages || [];
            // Toujours comparer par ID du dernier message
            const lastId = _messages.length ? _messages[_messages.length - 1].id : null;
            const newLastId = msgs.length ? msgs[msgs.length - 1].id : null;
            if (msgs.length === _messages.length && lastId === newLastId) return;
            _messages = msgs;
            vnkChatRender(msgs);
        } catch { }
    };

    function vnkChatRender(msgs) {
        const container = document.getElementById('vnk-chat-messages');
        if (!container) return;
        if (!msgs.length) return;
        container.innerHTML = msgs.map(m => {
            const isClient = m.sender === 'client';
            const time = new Date(m.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
            return `<div class="vnk-chat-msg ${isClient ? 'client' : 'vnk'}">
                <div class="vnk-chat-msg-bubble">${m.content}</div>
                <div class="vnk-chat-msg-time">${isClient ? 'Vous' : 'VNK'} · ${time}</div>
            </div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
    }

    window.vnkChatSend = async function () {
        const input = document.getElementById('vnk-chat-input');
        const btn = document.getElementById('vnk-chat-send-btn');
        const content = input?.value.trim();
        if (!content || _sending) return;

        const token = localStorage.getItem('vnk-token');

        // Si pas connecté — afficher message d'invitation à se connecter
        if (!token) {
            vnkChatAddMsg('Veuillez vous connecter à votre portail client pour envoyer un message à VNK.', 'vnk');
            input.value = '';
            return;
        }

        _sending = true;
        btn.disabled = true;
        // Afficher immédiatement côté client
        vnkChatAddMsg(content, 'client');
        input.value = '';
        input.style.height = 'auto';

        try {
            const r = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ content })
            });
            if (r.ok) {
                await vnkChatLoad();
            }
        } catch { }
        _sending = false;
        btn.disabled = false;
    };

    function vnkChatAddMsg(content, sender) {
        const container = document.getElementById('vnk-chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'vnk-chat-msg ' + sender;
        const time = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
        div.innerHTML = `<div class="vnk-chat-msg-bubble">${content}</div>
            <div class="vnk-chat-msg-time">${sender === 'client' ? 'Vous' : 'VNK'} · ${time}</div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ── Polling badge notifications ───────────────
    function vnkChatPoll() {
        const token = localStorage.getItem('vnk-token');
        if (!token) return;
        fetch('/api/messages', { headers: { Authorization: 'Bearer ' + token } })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (!d) return;
                const msgs = d.messages || [];
                // Compter les messages VNK non lus
                const unread = msgs.filter(m => !m.is_read && m.sender === 'vnk').length;
                const badge = document.getElementById('vnk-chat-unread');
                if (badge) {
                    if (unread > 0 && !_isOpen) {
                        badge.textContent = unread;
                        badge.style.display = 'flex';
                        _unreadCount = unread;
                    } else {
                        badge.style.display = 'none';
                    }
                }
                if (_isOpen && msgs.length !== _messages.length) {
                    _messages = msgs;
                    vnkChatRender(msgs);
                }
            }).catch(() => { });
    }

    // Démarrer le polling toutes les 5s
    _polling = setInterval(vnkChatPoll, 5000);
    // Charger les messages immédiatement au démarrage
    vnkChatLoad();
    vnkChatPoll();

    // ── Emoji picker ──────────────────────────────
    const _emojis = ['😊', '👍', '🙏', '✅', '📋', '🔧', '⚡', '📞', '📧', '💡', '🏭', '⚙️', '🛠️', '📊', '📈', '❓', '✔️', '🚀', '💼', '📝', '⚠️', '🔴', '🟢', '🟡', '👋', '🎯', '📅', '🕐', '💬', '📎'];
    let _emojiOpen = false;

    window.vnkChatToggleEmoji = function () {
        const picker = document.getElementById('vnk-emoji-picker');
        if (!picker) return;
        _emojiOpen = !_emojiOpen;
        if (_emojiOpen) {
            if (!picker.innerHTML) {
                picker.innerHTML = _emojis.map(e =>
                    `<span onclick="vnkChatInsertEmoji('` + e + `')" style="cursor:pointer;font-size:1.35rem;padding:3px;border-radius:4px;display:inline-block" class="vnk-menu-item">` + e + `</span>`
                ).join('');
            }
            picker.style.display = 'flex';
        } else {
            picker.style.display = 'none';
        }
    };

    window.vnkChatInsertEmoji = function (emoji) {
        const input = document.getElementById('vnk-chat-input');
        if (!input) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
        // Fermer après sélection
        const picker = document.getElementById('vnk-emoji-picker');
        if (picker) picker.style.display = 'none';
        _emojiOpen = false;
    };

    // ── Pièce jointe ──────────────────────────────
    window.vnkChatAttach = function () {
        document.getElementById('vnk-chat-file-input')?.click();
    };

    window.vnkChatFileSelected = async function (input) {
        const file = input.files?.[0];
        if (!file) return;
        const token = localStorage.getItem('vnk-token');
        if (!token) { vnkChatAddMsg('Connectez-vous pour envoyer des fichiers.', 'vnk'); return; }

        // Afficher aperçu immédiatement
        const isImg = file.type.startsWith('image/');
        const preview = isImg
            ? '<em>📸 ' + file.name + ' (envoi en cours...)</em>'
            : '<em>📎 ' + file.name + ' (envoi en cours...)</em>';
        vnkChatAddMsg(preview, 'client');
        input.value = '';

        // Envoyer le nom comme message (upload fichier = phase future)
        try {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ content: '📎 Fichier joint : ' + file.name + ' (' + (file.size > 1048576 ? (file.size / 1048576).toFixed(1) + 'Mo' : Math.round(file.size / 1024) + 'Ko') + ')' })
            });
            await vnkChatLoad();
        } catch { }
    };

    // ── Mode agrandi ─────────────────────────────
    let _expanded = false;

    window.vnkChatMenuToggle = function () {
        const menu = document.getElementById('vnk-chat-menu');
        if (!menu) return;
        const isOpen = menu.style.display !== 'none';
        menu.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
            setTimeout(() => document.addEventListener('click', function _close(e) {
                if (!menu.contains(e.target) && e.target.id !== 'vnk-chat-menu-btn') {
                    menu.style.display = 'none';
                    document.removeEventListener('click', _close);
                }
            }), 0);
        }
    };

    window.vnkChatExpand = function () {
        const panel = document.getElementById('vnk-chat-panel');
        const widget = document.getElementById('vnk-chat-widget');
        const menu = document.getElementById('vnk-chat-menu');
        const expandBtn = document.getElementById('vnk-expand-btn');
        if (!panel) return;
        _expanded = !_expanded;
        if (_expanded) {
            // Mode agrandi — prend tout le côté droit comme Calendly
            panel.style.cssText = 'display:flex;position:fixed;top:0;right:0;bottom:0;width:400px;max-height:100vh;border-radius:0;z-index:9999;flex-direction:column;background:white;box-shadow:-4px 0 24px rgba(0,0,0,0.15)';
            if (expandBtn) expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg> Réduire la fenêtre';
        } else {
            // Revenir au mode normal
            panel.style.cssText = '';
            panel.classList.add('open');
            if (expandBtn) expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Agrandir la fenêtre';
        }
        if (menu) menu.style.display = 'none';
    };

    window.vnkChatClear = function () {
        _messages = [];
        const container = document.getElementById('vnk-chat-messages');
        if (container) container.innerHTML = '<div class="vnk-chat-msg vnk"><div class="vnk-chat-msg-bubble">Bonjour 👋 Comment puis-je vous aider aujourd&#39;hui ?</div><div class="vnk-chat-msg-time">VNK Automatisation</div></div>';
        const menu = document.getElementById('vnk-chat-menu');
        if (menu) menu.style.display = 'none';
    };

    // Exposer pour portal.js (portail client connecté)
    window.vnkChatNotify = function (msgs, unread) {
        if (msgs && msgs.length !== _messages.length) {
            _messages = msgs;
            if (_isOpen) vnkChatRender(msgs);
        }
        const badge = document.getElementById('vnk-chat-unread');
        if (badge) {
            if (unread > 0 && !_isOpen) {
                badge.textContent = unread;
                badge.style.display = 'flex';
            } else if (_isOpen) {
                badge.style.display = 'none';
            }
        }
    };
})();