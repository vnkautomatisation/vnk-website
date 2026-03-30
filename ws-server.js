/* ============================================================
   VNK Automatisation Inc. — WebSocket Server
   ws-server.js — À placer dans backend/

   Usage dans server.js :
     const { initWebSocket, broadcast } = require('./ws-server');
     const server = app.listen(PORT, ...);
     initWebSocket(server);

   Depuis n'importe quelle route Express :
     const { broadcast } = require('./ws-server');
     broadcast({ type: 'new_invoice', clientId: 5, data: invoice });

   Protocole :
     Client → Serveur : { type: 'auth', token: '...' }
     Serveur → Client : { type: 'event', event: '...', data: {...} }
     Serveur → Client : { type: 'pong' }  (réponse aux ping)
     Client → Serveur : { type: 'ping' }
============================================================ */
'use strict';

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// ── Map des connexions actives ────────────────────────────────
// adminClients  : Set<ws>          — tous les admins connectés
// clientSockets : Map<clientId, Set<ws>> — sockets par client
const adminClients = new Set();
const clientSockets = new Map();

let _wss = null;

// ── Initialisation ────────────────────────────────────────────
function initWebSocket(httpServer) {
    _wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

    _wss.on('connection', (ws, req) => {
        ws._authenticated = false;
        ws._role = null;      // 'admin' | 'client'
        ws._clientId = null;
        ws._pingTimeout = null;

        // Délai d'authentification : 10s pour s'identifier
        const authTimeout = setTimeout(() => {
            if (!ws._authenticated) {
                ws.close(4001, 'Auth timeout');
            }
        }, 10000);

        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }

            // ── AUTH ──────────────────────────────────────────
            if (msg.type === 'auth') {
                clearTimeout(authTimeout);
                const token = msg.token;
                if (!token) { ws.close(4002, 'No token'); return; }

                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);

                    if (decoded.isAdmin) {
                        ws._authenticated = true;
                        ws._role = 'admin';
                        adminClients.add(ws);
                        _send(ws, { type: 'authenticated', role: 'admin' });
                        console.log('[WS] Admin connected');
                    } else if (decoded.id) {
                        ws._authenticated = true;
                        ws._role = 'client';
                        ws._clientId = decoded.id;
                        if (!clientSockets.has(decoded.id)) clientSockets.set(decoded.id, new Set());
                        clientSockets.get(decoded.id).add(ws);
                        _send(ws, { type: 'authenticated', role: 'client', clientId: decoded.id });
                        console.log(`[WS] Client ${decoded.id} connected`);
                    } else {
                        ws.close(4003, 'Invalid token');
                    }
                } catch (e) {
                    ws.close(4004, 'Token invalid');
                }
                return;
            }

            if (!ws._authenticated) return;

            // ── PING ──────────────────────────────────────────
            if (msg.type === 'ping') {
                _send(ws, { type: 'pong' });
                return;
            }
        });

        ws.on('close', () => {
            clearTimeout(authTimeout);
            clearTimeout(ws._pingTimeout);
            adminClients.delete(ws);
            if (ws._clientId && clientSockets.has(ws._clientId)) {
                clientSockets.get(ws._clientId).delete(ws);
                if (clientSockets.get(ws._clientId).size === 0) {
                    clientSockets.delete(ws._clientId);
                }
            }
            console.log(`[WS] ${ws._role || 'unauthenticated'} disconnected`);
        });

        ws.on('error', (err) => {
            console.warn('[WS] Socket error:', err.message);
        });
    });

    console.log('[WS] WebSocket server initialized at /ws');
    return _wss;
}

// ── Envoi utilitaire ─────────────────────────────────────────
function _send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// ── Broadcast ────────────────────────────────────────────────
// Envoie un événement à :
//   - tous les admins si targetRole === 'admin' ou non spécifié
//   - le client spécifique si clientId est fourni
//   - les deux si broadcast === true
//
// Exemples d'utilisation depuis les routes admin :
//   broadcast({ event: 'new_message',    clientId: 5,   data: msg });
//   broadcast({ event: 'quote_accepted', clientId: 5,   data: quote, notifyAdmin: true });
//   broadcast({ event: 'new_client',                    data: client, adminOnly: true });
function broadcast({ event, data = {}, clientId = null, adminOnly = false, notifyAdmin = true }) {
    const payload = JSON.stringify({ type: 'event', event, data });

    // Notifier l'admin
    if (!clientId || notifyAdmin) {
        adminClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) ws.send(payload);
        });
    }

    // Notifier le client spécifique
    if (clientId && !adminOnly) {
        const sockets = clientSockets.get(clientId);
        if (sockets) {
            sockets.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) ws.send(payload);
            });
        }
    }
}

// ── Stats ─────────────────────────────────────────────────────
function getStats() {
    return {
        admins: adminClients.size,
        clients: clientSockets.size,
        totalConnections: adminClients.size + [...clientSockets.values()].reduce((s, set) => s + set.size, 0)
    };
}

module.exports = { initWebSocket, broadcast, getStats };