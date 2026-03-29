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

        <button class="vnk-chat-bubble" onclick="vnkChatToggle()" title="Contacter VNK">
            <svg id="vnk-chat-icon-closed" width="52" height="52" viewBox="0 0 60 60">
                <polygon points="30,2 55,15.5 55,44.5 30,58 5,44.5 5,15.5" fill="none" stroke="white" stroke-width="3"/>
                <text x="30" y="36" text-anchor="middle" style="font-size:13px;font-weight:900;fill:white;font-family:sans-serif;letter-spacing:-0.5px">VNK</text>
            </svg>
            <svg id="vnk-chat-icon-open" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="display:none">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <div class="vnk-chat-unread" id="vnk-chat-unread">0</div>
        </button>`;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes vnkBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        #vnk-chat-panel.vnk-expanded {
            position:fixed!important;top:0!important;right:0!important;bottom:0!important;
            width:420px!important;max-width:100vw!important;max-height:100vh!important;
            border-radius:0!important;z-index:99999!important;
            box-shadow:-4px 0 32px rgba(0,0,0,0.18)!important;
        }
        .vnk-msg-read{font-size:0.65rem;color:#94A3B8;margin-top:1px;display:flex;align-items:center;gap:3px;justify-content:flex-end}
        .vnk-msg-read.seen{color:#2E75B6}
        .vnk-file-msg{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(27,79,138,0.08);border-radius:8px;border:1px solid rgba(27,79,138,0.15);text-decoration:none;color:#1B4F8A;font-size:0.82rem;font-weight:600}
        .vnk-file-msg:hover{background:rgba(27,79,138,0.14)}
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
        if (_isOpen) {
            _unreadCount = 0;
            const b = document.getElementById('vnk-chat-unread');
            if (b) b.style.display = 'none';
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

    window.vnkChatLoad = async function () {
        const token = localStorage.getItem('vnk-token');
        if (!token) return;
        try {
            const r = await fetch('/api/messages', { headers: { Authorization: 'Bearer ' + token } });
            if (!r.ok) return;
            const d = await r.json();
            const msgs = d.messages || [];
            const lastId = _messages.length ? _messages[_messages.length - 1].id : null;
            const newLastId = msgs.length ? msgs[msgs.length - 1].id : null;
            if (msgs.length === _messages.length && lastId === newLastId) return;
            _messages = msgs;
            vnkChatRender(msgs);
        } catch { }
    };

    function vnkChatRender(msgs) {
        const container = document.getElementById('vnk-chat-messages');
        if (!container || !msgs.length) return;
        container.innerHTML = msgs.map((m, i) => {
            const isClient = m.sender === 'client';
            const time = new Date(m.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
            const isLast = i === msgs.length - 1;
            let bubble = m.content || '';
            const fileMatch = bubble.match(/^\[Fichier\]\s*(.+?)\s*\((.+?)\)\s*\|\|URL:(.+)$/);
            const imgMatch = bubble.match(/^\[Image\]\s*(.+?)\s*\|\|URL:(.+)$/);
            const audioMatch = bubble.match(/^\[Audio\]\|\|URL:(.+)$/);
            if (fileMatch) {
                const [, name, size, url] = fileMatch;
                bubble = `<a href="${url}" download="${name}" target="_blank" class="vnk-file-msg">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>${name}</span><span style="font-weight:400;color:#64748B;font-size:0.75rem">${size}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>`;
            } else if (imgMatch) {
                const [, name, url] = imgMatch;
                bubble = `<a href="${url}" target="_blank"><img src="${url}" alt="${name}" style="max-width:200px;max-height:160px;border-radius:8px;display:block"></a>`;
            } else if (audioMatch) {
                bubble = `<audio controls style="max-width:200px"><source src="${audioMatch[1]}"></audio>`;
            }
            let readInd = '';
            if (isClient && isLast) {
                const seen = m.is_read;
                readInd = `<div class="vnk-msg-read ${seen ? 'seen' : ''}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${seen ? '<polyline points="1 12 7 18 23 6"/>' : '<polyline points="9 12 11 14 15 10"/>'}</svg>
                    ${seen ? 'Lu' : 'Envoyé'}
                </div>`;
            }
            return `<div class="vnk-chat-msg ${isClient ? 'client' : 'vnk'}">
                <div class="vnk-chat-msg-bubble">${bubble}</div>
                <div class="vnk-chat-msg-time">${isClient ? 'Vous' : 'VNK'} · ${time}</div>
                ${isClient ? readInd : ''}
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
        if (!token) { vnkChatAddMsg('Veuillez vous connecter pour envoyer un message.', 'vnk'); input.value = ''; return; }
        _sending = true; btn.disabled = true;
        vnkChatAddMsg(content, 'client');
        input.value = ''; input.style.height = 'auto';
        try {
            const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content }) });
            if (r.ok) await vnkChatLoad();
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
                await vnkChatLoad();
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
                const unread = msgs.filter(m => !m.is_read && m.sender === 'vnk').length;
                const badge = document.getElementById('vnk-chat-unread');
                if (badge) {
                    if (unread > 0 && !_isOpen) { badge.textContent = unread; badge.style.display = 'flex'; _unreadCount = unread; }
                    else badge.style.display = 'none';
                }
                if (_isOpen && msgs.length !== _messages.length) { _messages = msgs; vnkChatRender(msgs); }
            }).catch(() => { });
    }

    _polling = setInterval(vnkChatPoll, 5000);
    vnkChatLoad();
    vnkChatPoll();

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
        if (badge) {
            if (unread > 0 && !_isOpen) { badge.textContent = unread; badge.style.display = 'flex'; }
            else if (_isOpen) badge.style.display = 'none';
        }
    };
})();