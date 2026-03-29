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
                <button class="vnk-chat-close" onclick="vnkChatToggle()" title="Fermer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="vnk-chat-messages" id="vnk-chat-messages">
                <div class="vnk-chat-msg vnk">
                    <div class="vnk-chat-msg-bubble">Bonjour 👋 Comment puis-je vous aider aujourd'hui ?</div>
                    <div class="vnk-chat-msg-time">VNK Automatisation</div>
                </div>
            </div>
            <div class="vnk-chat-compose">
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
            // Marquer comme lu
            _unreadCount = 0;
            const badge = document.getElementById('vnk-chat-unread');
            if (badge) badge.style.display = 'none';
            // Charger les messages si connecté
            vnkChatLoad();
            setTimeout(() => document.getElementById('vnk-chat-input')?.focus(), 100);
        }
    };

    window.vnkChatLoad = async function () {
        const token = localStorage.getItem('vnk-token');
        if (!token) return; // Pas connecté — widget fonctionne comme formulaire de contact
        try {
            const r = await fetch('/api/messages', { headers: { Authorization: 'Bearer ' + token } });
            if (!r.ok) return;
            const d = await r.json();
            const msgs = d.messages || [];
            if (msgs.length === _messages.length) return; // Pas de nouveaux
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

    // Démarrer le polling toutes les 20s
    _polling = setInterval(vnkChatPoll, 20000);
    vnkChatPoll(); // Premier appel immédiat

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