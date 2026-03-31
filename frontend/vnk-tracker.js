/* VNK Analytics Tracker — vnk-tracker.js */
(function () {
    var SESSION_KEY = 'vnk_sid';
    var START_KEY = 'vnk_start';

    function getSession() {
        var s = sessionStorage.getItem(SESSION_KEY);
        if (!s) {
            s = Math.random().toString(36).substring(2) + Date.now().toString(36);
            sessionStorage.setItem(SESSION_KEY, s);
            sessionStorage.setItem(START_KEY, Date.now());
        }
        return s;
    }

    function getClientId() {
        try {
            var token = localStorage.getItem('vnk-token');
            if (!token) return null;
            var payload = JSON.parse(atob(token.split('.')[1]));
            return payload.id || null;
        } catch (e) { return null; }
    }

    function track(duration) {
        var data = {
            session_id: getSession(),
            page: location.pathname,
            referrer: document.referrer || null,
            client_id: getClientId(),
            duration_ms: duration || null
        };
        var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/analytics/pageview', blob);
        } else {
            fetch('/api/analytics/pageview', { method: 'POST', body: blob, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function () { });
        }
    }

    // Tracker au chargement
    var startTime = Date.now();
    track(null);

    // Tracker la durée à la fermeture
    window.addEventListener('beforeunload', function () {
        track(Date.now() - startTime);
    });

    // Tracker si SPA (changement de hash)
    var lastPage = location.pathname;
    window.addEventListener('popstate', function () {
        if (location.pathname !== lastPage) {
            track(Date.now() - startTime);
            lastPage = location.pathname;
            startTime = Date.now();
            track(null);
        }
    });
})();