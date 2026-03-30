/* ════════════════════════════════════════════════
   VNK Automatisation Inc. — Widget Chat Flottant
   ════════════════════════════════════════════════ */
(function () {
    if (document.getElementById('vnk-chat-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'vnk-chat-widget';
    widget.className = 'vnk-chat-widget';
    widget.innerHTML = `
        <div class="vnk-chat-panel" id="vnk-chat-panel">
            <div class="vnk-chat-header" style="background:linear-gradient(135deg,#0F2D52,#1B4F8A)">
                <div id="vnk-header-avatar" style="border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;background:rgba(255,255,255,0.15);position:relative">
                    <svg width="36" height="36" viewBox="0 0 60 60">
                        <polygon points="30,2 55,15.5 55,44.5 30,58 5,44.5 5,15.5" fill="none" stroke="white" stroke-width="3"/>
                        <text x="30" y="36" text-anchor="middle" style="font-size:12px;font-weight:900;fill:white;font-family:sans-serif;letter-spacing:-0.5px">VNK</text>
                    </svg>
                </div>
                <div class="vnk-chat-header-info">
                    <strong>VNK Automatisation</strong>
                    <span>Disponible maintenant</span>
                </div>
                <div style="position:relative;margin-left:auto;display:flex;align-items:center;gap:6px">
                    <button id="vnk-chat-menu-btn" onclick="vnkChatMenuToggle()" title="Options"
                        style="width:32px;height:32px;border:none;background:rgba(255,255,255,0.12);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s"
                        onmouseenter="this.style.background='rgba(255,255,255,0.22)'"
                        onmouseleave="this.style.background='rgba(255,255,255,0.12)'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                    </button>
                    <button onclick="vnkChatToggle()" title="Fermer"
                        style="width:32px;height:32px;border:none;background:rgba(255,255,255,0.12);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s"
                        onmouseenter="this.style.background='rgba(255,255,255,0.22)'"
                        onmouseleave="this.style.background='rgba(255,255,255,0.12)'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div id="vnk-chat-menu" style="display:none;position:absolute;top:calc(100% + 8px);right:0;background:white;border:1.5px solid #E2E8F0;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.15);min-width:180px;padding:6px 0;z-index:99999">
                        <div onclick="vnkChatExpand()" id="vnk-expand-btn"
                            style="padding:10px 16px;font-size:0.83rem;cursor:pointer;color:#1E293B;display:flex;align-items:center;gap:10px;border-radius:6px;margin:2px 4px" class="vnk-menu-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                            Agrandir la fenêtre
                        </div>
                        <div onclick="vnkChatClear()"
                            style="padding:10px 16px;font-size:0.83rem;cursor:pointer;color:#64748B;display:flex;align-items:center;gap:10px;border-radius:6px;margin:2px 4px" class="vnk-menu-item">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.29"/></svg>
                            Effacer l'historique
                        </div>
                    </div>
                </div>
            </div>

            <div class="vnk-chat-messages" id="vnk-chat-messages">
                <div class="vnk-chat-msg vnk">
                    <div class="vnk-chat-msg-bubble">Bonjour ! Comment puis-je vous aider ?</div>
                    <div class="vnk-chat-msg-time">VNK Automatisation</div>
                </div>
            </div>

            <div class="vnk-chat-compose">
                <div class="vnk-chat-actions" style="margin-bottom:0.3rem">
                    <button class="vnk-chat-action-btn" onclick="vnkChatAttach('all')" title="Fichier / PDF">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </button>
                    <button class="vnk-chat-action-btn" onclick="vnkChatAttach('image')" title="Photo">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </button>
                    <button class="vnk-chat-action-btn" id="vnk-record-btn" onclick="vnkChatToggleRecord()" title="Message vocal">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </button>
                    <input type="file" id="vnk-chat-file-all" style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onchange="vnkChatFileSelected(this,'all')">
                    <input type="file" id="vnk-chat-file-image" style="display:none" accept="image/*" capture="environment" onchange="vnkChatFileSelected(this,'image')">
                </div>
                <div id="vnk-record-indicator" style="display:none;align-items:center;gap:8px;padding:6px 10px;background:#FEE2E2;border-radius:8px;margin-bottom:6px;font-size:0.8rem;color:#DC2626;font-weight:600">
                    <span style="width:8px;height:8px;background:#DC2626;border-radius:50%;animation:vnkBlink 1s infinite;flex-shrink:0"></span>
                    Enregistrement...
                    <button onclick="vnkChatStopRecord(true)" style="margin-left:auto;border:none;background:#DC2626;color:white;border-radius:6px;padding:2px 10px;cursor:pointer;font-size:0.75rem;font-family:inherit">Envoyer</button>
                    <button onclick="vnkChatStopRecord(false)" style="border:none;background:#94A3B8;color:white;border-radius:6px;padding:2px 10px;cursor:pointer;font-size:0.75rem;font-family:inherit">Annuler</button>
                </div>
                <div style="display:flex;gap:0.4rem;align-items:flex-end">
                    <textarea class="vnk-chat-input" id="vnk-chat-input" rows="1" placeholder="Écrivez votre message..."
                        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();vnkChatSend()}"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"></textarea>
                    <button class="vnk-chat-send" id="vnk-chat-send-btn" onclick="vnkChatSend()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            </div>
        </div>

        <button class="vnk-chat-bubble" onclick="vnkChatToggle()" id="vnk-chat-bubble-btn" title="Contacter VNK Automatisation">
            <div class="vnk-bubble-inner" id="vnk-bubble-inner">
                <svg id="vnk-chat-icon-closed" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <svg id="vnk-chat-icon-open" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" style="display:none">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </div>
            <div class="vnk-chat-unread" id="vnk-chat-unread" style="display:none">0</div>
        </button>`;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes vnkBlink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes vnkBubblePop{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        @keyframes vnkBadgeBounce{0%,100%{transform:scale(1)}40%{transform:scale(1.4)}70%{transform:scale(0.9)}}
        @keyframes vnkPulseRing{0%{transform:scale(1);opacity:0.7}100%{transform:scale(1.6);opacity:0}}
        @keyframes vnkShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-5deg)}80%{transform:rotate(5deg)}}

        .vnk-chat-widget{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9998;display:flex;flex-direction:column;align-items:flex-end;pointer-events:none}
        .vnk-chat-widget>*{pointer-events:auto}

        .vnk-chat-bubble{width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#1B4F8A,#0F2D52);box-shadow:0 6px 20px rgba(15,45,82,0.45),0 2px 6px rgba(0,0,0,0.2);transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.2s;outline:none;animation:vnkBubblePop 0.4s cubic-bezier(0.34,1.56,0.64,1)}
        .vnk-chat-bubble:hover{transform:scale(1.08);box-shadow:0 10px 28px rgba(15,45,82,0.55)}
        .vnk-chat-bubble:active{transform:scale(0.95)}
        .vnk-chat-bubble.has-unread::before{content:'';position:absolute;inset:-4px;border-radius:50%;border:2.5px solid rgba(230,57,70,0.6);animation:vnkPulseRing 1.8s ease-out infinite}
        .vnk-bubble-inner{display:flex;align-items:center;justify-content:center;transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1)}
        .vnk-chat-bubble.open-state .vnk-bubble-inner{transform:rotate(90deg) scale(0.88)}
        .vnk-chat-bubble.shake{animation:vnkShake 0.5s ease}

        .vnk-chat-unread{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;padding:0 5px;background:#E63946;color:white;font-size:0.7rem;font-weight:900;border-radius:11px;border:2.5px solid white;display:none;align-items:center;justify-content:center;line-height:1;box-shadow:0 2px 10px rgba(230,57,70,0.6);font-family:system-ui,sans-serif;letter-spacing:-0.3px}

        .vnk-chat-panel{display:none;flex-direction:column;position:fixed;bottom:5rem;right:1.5rem;width:360px;max-height:520px;background:white;border-radius:18px;box-shadow:0 8px 32px rgba(10,18,35,0.18),0 0 0 1px rgba(0,0,0,0.05);overflow:hidden;z-index:9997;transform:scale(0.92) translateY(10px);opacity:0;transition:transform 0.28s cubic-bezier(0.34,1.4,0.64,1),opacity 0.22s ease}
        .vnk-chat-panel.open{display:flex;transform:scale(1) translateY(0);opacity:1}
        #vnk-chat-panel.vnk-expanded{position:fixed!important;top:0!important;right:0!important;bottom:0!important;width:420px!important;max-width:100vw!important;max-height:100vh!important;border-radius:0!important;z-index:99999!important;box-shadow:-4px 0 32px rgba(0,0,0,0.18)!important}

        .vnk-chat-messages{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:0.5rem;background:#F8FAFC;scrollbar-width:thin;scrollbar-color:#E2E8F0 transparent}
        .vnk-chat-msg{display:flex;flex-direction:column;max-width:82%}
        .vnk-chat-msg.client{align-items:flex-end;align-self:flex-end}
        .vnk-chat-msg.vnk{align-items:flex-start;align-self:flex-start}
        .vnk-chat-msg-bubble{padding:0.6rem 0.9rem;border-radius:14px;font-size:0.875rem;line-height:1.5;word-break:break-word}
        .vnk-chat-msg.client .vnk-chat-msg-bubble{background:linear-gradient(135deg,#1B4F8A,#2563EB);color:white;border-radius:14px 14px 4px 14px}
        .vnk-chat-msg.vnk .vnk-chat-msg-bubble{background:white;color:#1E293B;border:1px solid #E2E8F0;border-radius:14px 14px 14px 4px}
        .vnk-chat-msg-time{font-size:0.65rem;color:#94A3B8;margin-top:3px;padding:0 4px}

        .vnk-chat-compose{border-top:1px solid #F1F5F9;padding:0.65rem 0.75rem 0.75rem;background:white}
        .vnk-chat-actions{display:flex;gap:4px}
        .vnk-chat-action-btn{width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94A3B8;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background 0.15s,color 0.15s}
        .vnk-chat-action-btn:hover{background:#F1F5F9;color:#1B4F8A}
        .vnk-chat-input{flex:1;resize:none;border:1.5px solid #E2E8F0;border-radius:10px;padding:0.55rem 0.8rem;font-size:0.875rem;font-family:inherit;outline:none;min-height:38px;max-height:100px;line-height:1.5;transition:border-color 0.15s}
        .vnk-chat-input:focus{border-color:#1B4F8A}
        .vnk-chat-send{width:38px;height:38px;border:none;background:linear-gradient(135deg,#1B4F8A,#2563EB);border-radius:10px;cursor:pointer;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;box-shadow:0 2px 8px rgba(27,79,138,0.3)}
        .vnk-chat-send:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(27,79,138,0.4)}
        .vnk-chat-send:disabled{opacity:0.5;transform:none}

        .vnk-chat-header{display:flex;align-items:center;gap:0.65rem;padding:0.85rem 1rem;flex-shrink:0}
        .vnk-chat-header-info{flex:1;min-width:0}
        .vnk-chat-header-info strong{display:block;font-size:0.88rem;font-weight:700;color:white}
        .vnk-chat-header-info span{font-size:0.72rem;color:rgba(255,255,255,0.65)}

        .vnk-msg-read{font-size:0.65rem;color:#94A3B8;margin-top:1px;display:flex;align-items:center;gap:3px;justify-content:flex-end}
        .vnk-msg-read.seen{color:#2E75B6}
        .vnk-file-msg{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(27,79,138,0.08);border-radius:8px;border:1px solid rgba(27,79,138,0.15);text-decoration:none;color:#1B4F8A;font-size:0.82rem;font-weight:600}
        .vnk-file-msg:hover{background:rgba(27,79,138,0.14)}
        .vnk-menu-item:hover{background:#F1F5F9}
        @media(max-width:480px){.vnk-chat-panel{width:calc(100vw - 2rem);right:1rem;bottom:4.5rem}.vnk-chat-bubble{width:52px;height:52px}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(widget);

    let _isOpen = false, _messages = [], _sending = false, _polling = null;
    let _unreadCount = 0, _expanded = false, _mediaRecorder = null, _audioChunks = [];

    window.vnkChatToggle = function () {
        _isOpen = !_isOpen;
        const panel = document.getElementById('vnk-chat-panel');
        const ic = document.getElementById('vnk-chat-icon-closed');
        const io = document.getElementById('vnk-chat-icon-open');
        panel.classList.toggle('open', _isOpen);
        if (ic) ic.style.display = _isOpen ? 'none' : 'block';
        if (io) io.style.display = _isOpen ? 'block' : 'none';
        const _bubble = document.getElementById('vnk-chat-bubble-btn');
        if (_bubble) _bubble.classList.toggle('open-state', _isOpen);
        if (_isOpen) {
            _unreadCount = 0;
            const b = document.getElementById('vnk-chat-unread');
            if (b) { b.style.display = 'none'; b.textContent = '0'; }
            if (_bubble) _bubble.classList.remove('has-unread');
            _unreadCount = 0;
            // Sauvegarder le dernier ID VNK vu → badge ne reviendra pas sur les anciens msgs
            if (_messages.length) {
                const lastVnkMsg = [..._messages].reverse().find(m => m.sender === 'vnk');
                if (lastVnkMsg) localStorage.setItem('vnk-chat-last-seen-id', String(lastVnkMsg.id));
            }
            // Afficher l'avatar client dans le header si disponible
            try {
                const user = JSON.parse(localStorage.getItem('vnk-user') || '{}');
                const avatarEl = document.getElementById('vnk-header-avatar');
                if (avatarEl && user.avatar_url) {
                    avatarEl.innerHTML = `<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
                } else if (avatarEl && user.name) {
                    const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    avatarEl.innerHTML = `<span style="font-size:0.85rem;font-weight:800;color:white">${initials}</span>`;
                }
            } catch (e) { }
            vnkChatLoad();
            setTimeout(() => document.getElementById('vnk-chat-input')?.focus(), 150);
        }
    };

    window.vnkChatLoad = async function (forceNoMark) {
        const token = localStorage.getItem('vnk-token');
        if (!token) return;
        try {
            // markRead=true quand le chat est ouvert — marque les messages VNK comme lus
            const url = '/api/messages' + (_isOpen && !forceNoMark ? '?markRead=true' : '');
            const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
            if (!r.ok) return;
            const d = await r.json();
            const msgs = d.messages || [];
            const lastId = _messages.length ? _messages[_messages.length - 1].id : null;
            const newLastId = msgs.length ? msgs[msgs.length - 1].id : null;
            if (msgs.length === _messages.length && lastId === newLastId) return;
            _messages = msgs;
            vnkChatRender(msgs);
            // Si chat ouvert → mettre à jour last-seen-id avec le dernier msg VNK
            if (_isOpen && msgs.length) {
                const lastVnk = [...msgs].reverse().find(m => m.sender === 'vnk');
                if (lastVnk) localStorage.setItem('vnk-chat-last-seen-id', String(lastVnk.id));
            }
        } catch { }
    };


    // ── Formater le contenu d'un message ──
    // Supporte : **gras**, *italique*, __souligné__, `code`
    // Détecte le type de message pour afficher un tag coloré
    function _fmtMsg(raw) {
        if (!raw) return { html: '', tag: null };
        let text = raw
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/__(.+?)__/g, '<u>$1</u>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em">$1</code>')
            .replace(/\n/g, '<br>');

        // Détecter le type pour le tag
        const lower = raw.toLowerCase();
        let tag = null;
        if (/facture|invoice|F-\d{4}-\d{3}/.test(raw))
            tag = { label: 'Facture', bg: '#FFF7ED', color: '#C2410C', icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' };
        else if (/devis|quote|D-\d{4}-\d{3}/.test(raw))
            tag = { label: 'Devis', bg: '#EFF6FF', color: '#1D4ED8', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' };
        else if (/contrat|contract|CT-\d{4}-\d{3}/.test(raw))
            tag = { label: 'Contrat', bg: '#F5F3FF', color: '#6D28D9', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' };
        else if (/document|rapport|fichier/.test(lower))
            tag = { label: 'Document', bg: '#F0FDF4', color: '#15803D', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' };
        else if (/paiement|payé|payment/.test(lower))
            tag = { label: 'Paiement', bg: '#DCFCE7', color: '#15803D', icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' };
        else if (/mandat|mandate/.test(lower))
            tag = { label: 'Mandat', bg: '#FEF9C3', color: '#854D0E', icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' };
        return { html: text, tag };
    }

    function vnkChatRender(msgs) {
        const container = document.getElementById('vnk-chat-messages');
        if (!container || !msgs.length) return;
        container.innerHTML = msgs.map((m, i) => {
            const isClient = m.sender === 'client';
            const time = new Date(m.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
            const isLast = i === msgs.length - 1;
            const raw = m.content || '';
            let bubble = '';

            const fileMatch = raw.match(/^\[Fichier\]\s*(.+?)\s*\((.+?)\)\s*\|\|URL:(.+)$/);
            const imgMatch = raw.match(/^\[Image\]\s*(.+?)\s*\|\|URL:(.+)$/);
            const audioMatch = raw.match(/^\[Audio\]\|\|URL:(.+)$/);
            let tag = null;
            if (fileMatch) {
                const [, name, size, url] = fileMatch;
                bubble = '<a href="' + url + '" download="' + name + '" target="_blank" class="vnk-file-msg">'
                    + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
                    + '<span>' + name + '</span><span style="opacity:0.6;font-size:0.75rem">' + size + '</span>'
                    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
                    + '</a>';
            } else if (imgMatch) {
                const [, name, url] = imgMatch;
                bubble = '<a href="' + url + '" target="_blank"><img src="' + url + '" alt="' + name + '" style="max-width:200px;max-height:160px;border-radius:8px;display:block"></a>';
            } else if (audioMatch) {
                bubble = '<audio controls style="max-width:200px"><source src="' + audioMatch[1] + '"></audio>';
            } else {
                const fmt = _fmtMsg(raw);
                bubble = fmt.html;
                tag = fmt.tag;
            }

            const tagHtml = (!isClient && tag)
                ? '<div style="display:flex;align-items:center;gap:4px;margin-bottom:5px">'
                + '<span style="display:inline-flex;align-items:center;gap:4px;background:' + tag.bg + ';color:' + tag.color + ';font-size:10px;font-weight:700;padding:2px 7px;border-radius:12px;letter-spacing:0.3px">'
                + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="' + tag.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + tag.icon + '</svg>'
                + tag.label + '</span></div>'
                : '';

            let readInd = '';
            if (isClient && isLast) {
                readInd = '<div class="vnk-msg-read ' + (m.is_read ? 'seen' : '') + '">'
                    + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">'
                    + (m.is_read ? '<polyline points="1 12 7 18 23 6"/>' : '<polyline points="9 12 11 14 15 10"/>')
                    + '</svg>' + (m.is_read ? 'Lu' : 'Envoyé') + '</div>';
            }

            return '<div class="vnk-chat-msg ' + (isClient ? 'client' : 'vnk') + '">'
                + '<div class="vnk-chat-msg-bubble">' + tagHtml + bubble + '</div>'
                + '<div class="vnk-chat-msg-time">' + (isClient ? 'Vous' : 'VNK') + ' · ' + time + '</div>'
                + (isClient ? readInd : '')
                + '</div>';
        }).join('');
        container.scrollTop = container.scrollHeight;
    }

    window.vnkChatSend = async function () {
        const input = document.getElementById('vnk-chat-input');
        const btn = document.getElementById('vnk-chat-send-btn');
        const content = input?.value.trim();
        if (!content || _sending) return;
        const token = localStorage.getItem('vnk-token');
        if (!token) { vnkChatAddMsg('Veuillez vous connecter pour envoyer un message.', 'vnk'); input.value = ''; return; }
        _sending = true; btn.disabled = true;
        vnkChatAddMsg(content, 'client');
        input.value = ''; input.style.height = 'auto';
        try {
            const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content }) });
            if (r.ok) await vnkChatLoad(true); // forceNoMark — ne pas marquer les msgs VNK comme lus
        } catch { }
        _sending = false; btn.disabled = false;
    };

    function vnkChatAddMsg(content, sender) {
        const c = document.getElementById('vnk-chat-messages');
        if (!c) return;
        const div = document.createElement('div');
        div.className = 'vnk-chat-msg ' + sender;
        const time = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
        div.innerHTML = `<div class="vnk-chat-msg-bubble">${content}</div><div class="vnk-chat-msg-time">${sender === 'client' ? 'Vous' : 'VNK'} · ${time}</div>`;
        c.appendChild(div);
        c.scrollTop = c.scrollHeight;
    }

    window.vnkChatAttach = function (type) {
        document.getElementById(type === 'image' ? 'vnk-chat-file-image' : 'vnk-chat-file-all')?.click();
    };

    window.vnkChatFileSelected = async function (input, type) {
        const file = input.files?.[0];
        if (!file) return;
        const token = localStorage.getItem('vnk-token');
        if (!token) { vnkChatAddMsg('Connectez-vous pour envoyer des fichiers.', 'vnk'); return; }
        const isImg = file.type.startsWith('image/');
        const sizeFmt = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' Mo' : Math.round(file.size / 1024) + ' Ko';
        if (isImg) {
            const reader = new FileReader();
            reader.onload = e => vnkChatAddMsg(`<img src="${e.target.result}" style="max-width:200px;max-height:160px;border-radius:8px;display:block">`, 'client');
            reader.readAsDataURL(file);
        } else {
            vnkChatAddMsg(`<div class="vnk-file-msg"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${file.name}</span><span style="font-weight:400;color:#94A3B8;font-size:0.75rem">${sizeFmt}</span><span style="margin-left:auto;font-size:0.72rem;color:#94A3B8">Envoi...</span></div>`, 'client');
        }
        input.value = '';
        try {
            // Encoder le fichier en base64 pour le stocker dans le message
            const reader2 = new FileReader();
            reader2.onload = async (e) => {
                const b64 = e.target.result; // data:type;base64,...
                const msgContent = isImg
                    ? `[Image] ${file.name} ||URL:${b64}`
                    : `[Fichier] ${file.name} (${sizeFmt}) ||URL:${b64}`;
                await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content: msgContent }) });
                await vnkChatLoad(true);
            };
            reader2.readAsDataURL(file);
        } catch { }
    };

    window.vnkChatToggleRecord = async function () {
        if (_mediaRecorder && _mediaRecorder.state === 'recording') { vnkChatStopRecord(true); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            _audioChunks = [];
            _mediaRecorder = new MediaRecorder(stream);
            _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _audioChunks.push(e.data); };
            _mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                if (!_audioChunks.length) return;
                const blob = new Blob(_audioChunks, { type: 'audio/webm' });
                const token = localStorage.getItem('vnk-token');
                if (!token) return;
                const url = URL.createObjectURL(blob);
                vnkChatAddMsg(`<audio controls style="max-width:200px"><source src="${url}"></audio>`, 'client');
                try {
                    const reader3 = new FileReader();
                    reader3.onload = async (ev) => {
                        const b64 = ev.target.result;
                        const msgContent = `[Audio]||URL:${b64}`;
                        await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content: msgContent }) });
                    };
                    reader3.readAsDataURL(blob);
                } catch { }
            };
            _mediaRecorder.start();
            const ind = document.getElementById('vnk-record-indicator');
            if (ind) ind.style.display = 'flex';
            const btn = document.getElementById('vnk-record-btn');
            if (btn) { btn.style.color = '#DC2626'; }
        } catch (e) { vnkChatAddMsg('Microphone non disponible ou accès refusé.', 'vnk'); }
    };

    window.vnkChatStopRecord = function (send) {
        const ind = document.getElementById('vnk-record-indicator');
        if (ind) ind.style.display = 'none';
        const btn = document.getElementById('vnk-record-btn');
        if (btn) btn.style.color = '';
        if (_mediaRecorder && _mediaRecorder.state === 'recording') {
            if (!send) _audioChunks = [];
            _mediaRecorder.stop();
        }
    };

    function vnkChatPoll() {
        const token = localStorage.getItem('vnk-token');
        if (!token) return;
        fetch('/api/messages', { headers: { Authorization: 'Bearer ' + token } })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (!d) return;
                const msgs = d.messages || [];
                // Compter les messages VNK non vus : après le dernier ID vu par le client
                const lastSeenId = parseInt(localStorage.getItem('vnk-chat-last-seen-id') || '0');
                const unread = msgs.filter(m => m.sender === 'vnk' && m.id > lastSeenId).length;

                const badge = document.getElementById('vnk-chat-unread');
                const bbl = document.getElementById('vnk-chat-bubble-btn');
                if (badge) {
                    if (unread > 0 && !_isOpen) {
                        const prev = _unreadCount;
                        badge.textContent = String(unread);
                        badge.style.display = 'flex';
                        _unreadCount = unread;
                        if (bbl) bbl.classList.add('has-unread');
                        if (unread > prev && bbl) {
                            bbl.classList.remove('shake'); void bbl.offsetWidth;
                            bbl.classList.add('shake');
                            setTimeout(() => bbl.classList.remove('shake'), 600);
                        }
                        badge.style.animation = 'none'; void badge.offsetWidth;
                        badge.style.animation = 'vnkBadgeBounce 0.4s cubic-bezier(0.34,1.56,0.64,1)';
                    } else if (!_isOpen) {
                        badge.style.display = 'none'; badge.textContent = '0'; _unreadCount = 0;
                        if (bbl) bbl.classList.remove('has-unread');
                    }
                }
                // Mettre à jour si nouveau message ou premier chargement
                if (msgs.length !== _messages.length || (!_messages.length && msgs.length)) {
                    _messages = msgs;
                    if (_isOpen) vnkChatRender(msgs);
                }
            }).catch(() => { });
    }

    // Polling réduit — le WebSocket de portal.js pousse les mises à jour via vnkChatNotify()
    // On garde un polling léger seulement comme fallback
    function _startChatPolling() {
        if (_polling) clearInterval(_polling);
        _polling = setInterval(vnkChatPoll, 15000); // 15s fallback
    }
    _startChatPolling();
    // Charger les messages immédiatement au démarrage pour le badge et l'historique
    setTimeout(() => vnkChatLoad(true), 800);

    // Si le WS portal est actif, désactiver le polling du chat (vnkChatNotify gère tout)
    // Vérification toutes les 3s au démarrage, puis stop si WS connecté
    const _wsCheck = setInterval(() => {
        if (window._wsPortal && window._wsPortal.readyState === WebSocket.OPEN) {
            clearInterval(_polling); _polling = null;
            clearInterval(_wsCheck);
        }
    }, 3000);

    vnkChatLoad();
    vnkChatPoll(); // Le poll initial calcule les non-vus via last-seen-id immédiatement

    window.vnkChatMenuToggle = function () {
        const menu = document.getElementById('vnk-chat-menu');
        if (!menu) return;
        const isOpen = menu.style.display !== 'none';
        menu.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
            setTimeout(() => document.addEventListener('click', function _c(e) {
                if (!menu.contains(e.target) && !e.target.closest('#vnk-chat-menu-btn')) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', _c);
                }
            }), 50);
        }
    };

    window.vnkChatExpand = function () {
        const panel = document.getElementById('vnk-chat-panel');
        const menu = document.getElementById('vnk-chat-menu');
        const btn = document.getElementById('vnk-expand-btn');
        if (!panel) return;
        _expanded = !_expanded;
        panel.classList.toggle('vnk-expanded', _expanded);
        if (!_expanded) panel.classList.add('open');
        if (btn) btn.innerHTML = _expanded
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg> Réduire`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Agrandir la fenêtre`;
        if (menu) menu.style.display = 'none';
    };

    window.vnkChatClear = function () {
        _messages = [];
        const c = document.getElementById('vnk-chat-messages');
        if (c) c.innerHTML = `<div class="vnk-chat-msg vnk"><div class="vnk-chat-msg-bubble">Bonjour ! Comment puis-je vous aider ?</div><div class="vnk-chat-msg-time">VNK Automatisation</div></div>`;
        const menu = document.getElementById('vnk-chat-menu');
        if (menu) menu.style.display = 'none';
    };

    window.vnkChatNotify = function (msgs, unread) {
        if (msgs && msgs.length !== _messages.length) { _messages = msgs; if (_isOpen) vnkChatRender(msgs); }
        const badge = document.getElementById('vnk-chat-unread');
        const bbl = document.getElementById('vnk-chat-bubble-btn');
        if (badge) {
            if (unread > 0 && !_isOpen) {
                const prev = _unreadCount;
                badge.textContent = String(unread); badge.style.display = 'flex'; _unreadCount = unread;
                if (bbl) bbl.classList.add('has-unread');
                if (unread > prev && bbl) {
                    bbl.classList.remove('shake'); void bbl.offsetWidth;
                    bbl.classList.add('shake');
                    setTimeout(() => bbl.classList.remove('shake'), 600);
                }
                badge.style.animation = 'none'; void badge.offsetWidth;
                badge.style.animation = 'vnkBadgeBounce 0.4s cubic-bezier(0.34,1.56,0.64,1)';
            } else {
                badge.style.display = 'none'; badge.textContent = '0';
                if (bbl) bbl.classList.remove('has-unread');
            }
        }
    };
})();