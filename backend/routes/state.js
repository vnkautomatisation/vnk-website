// @ts-nocheck
/* ════════════════════════════════════════════════
   VNK — Module de persistance d'état UI
   Sauvegarde automatiquement dans sessionStorage :
   - Section/onglet actif
   - Recherches, filtres, tris, pages courantes
   Fonctionne sur admin.html et portail.html
   ════════════════════════════════════════════════ */
(function () {

    const PREFIX = 'vnk_state_';

    // ── API publique ──────────────────────────────
    window.VNKState = {

        // Sauvegarder une valeur (clé = page + champ)
        save: function (key, value) {
            try {
                const page = window.location.pathname.split('/').pop().replace('.html', '');
                sessionStorage.setItem(PREFIX + page + '_' + key, JSON.stringify(value));
            } catch (e) { }
        },

        // Lire une valeur
        get: function (key, defaultValue) {
            try {
                const page = window.location.pathname.split('/').pop().replace('.html', '');
                const raw = sessionStorage.getItem(PREFIX + page + '_' + key);
                return raw !== null ? JSON.parse(raw) : defaultValue;
            } catch (e) { return defaultValue; }
        },

        // Supprimer une valeur
        remove: function (key) {
            try {
                const page = window.location.pathname.split('/').pop().replace('.html', '');
                sessionStorage.removeItem(PREFIX + page + '_' + key);
            } catch (e) { }
        },

        // Restaurer un input/select depuis l'état sauvegardé
        restoreInput: function (id, key) {
            const el = document.getElementById(id);
            if (!el) return;
            const saved = this.get(key);
            if (saved !== undefined && saved !== null) {
                el.value = saved;
            }
            // Sauvegarder à chaque changement
            const self = this;
            el.addEventListener('input', function () { self.save(key, el.value); });
            el.addEventListener('change', function () { self.save(key, el.value); });
        },

        // Initialiser la persistance sur tous les inputs de la page
        init: function () {
            const self = this;
            // Attendre que le DOM soit prêt
            document.addEventListener('DOMContentLoaded', function () {
                self._bindAll();
            });
            // Si déjà chargé
            if (document.readyState !== 'loading') {
                setTimeout(function () { self._bindAll(); }, 100);
            }
        },

        _bindAll: function () {
            const self = this;
            // Tous les inputs avec data-state-key
            document.querySelectorAll('[data-state-key]').forEach(function (el) {
                const key = el.getAttribute('data-state-key');
                const saved = self.get(key);
                if (saved !== undefined && saved !== null) el.value = saved;
                el.addEventListener('input', function () { self.save(key, el.value); });
                el.addEventListener('change', function () { self.save(key, el.value); });
            });
        }
    };

    window.VNKState.init();

})();