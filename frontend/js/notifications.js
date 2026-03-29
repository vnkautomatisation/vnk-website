/* ════════════════════════════════════════════════
   VNK Automatisation — Notifications navigateur + son
   Charger sur portail.html et admin.html
   ════════════════════════════════════════════════ */
(function () {

    // ── Son de notification (bip doux) ───────────
    function playNotifSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) { /* Audio non disponible */ }
    }

    // ── Demander permission notifications ────────
    async function requestNotifPermission() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        const perm = await Notification.requestPermission();
        return perm === 'granted';
    }

    // ── Afficher une notification navigateur ─────
    async function showBrowserNotif(title, body, icon) {
        const ok = await requestNotifPermission();
        if (!ok) return;
        const n = new Notification(title, {
            body,
            icon: icon || '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'vnk-message',    // Remplace la précédente (pas de spam)
            renotify: true,
        });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 6000);
    }

    // ── API publique ──────────────────────────────
    window.vnkNotif = {
        sound: playNotifSound,
        browser: showBrowserNotif,

        // Notification complète (son + navigateur)
        newMessage: async function (senderName, preview) {
            playNotifSound();
            await showBrowserNotif(
                'Nouveau message — VNK Automatisation',
                (senderName ? senderName + ' : ' : '') + (preview || 'Vous avez reçu un nouveau message'),
                null
            );
        },

        // Demander la permission au chargement (1 seule fois)
        init: async function () {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'default') {
                // Attendre une interaction utilisateur pour demander
                const ask = () => {
                    requestNotifPermission();
                    document.removeEventListener('click', ask);
                };
                document.addEventListener('click', ask);
            }
        }
    };

    // Init auto
    window.vnkNotif.init();

})();