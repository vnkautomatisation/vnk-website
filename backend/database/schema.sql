-- ============================================================
-- VNK Automatisation Inc. — Schéma complet base de données
-- Version 3.0 — WebSocket temps réel intégré
-- Mis à jour : 2026-03-29
-- Changements v3.0 :
--   + Table ws_connections (monitoring connexions WebSocket)
--   + workflow_events.event_type : 4 nouveaux types WS
--   + Index ws_connections pour monitoring rapide
-- ATTENTION: Supprime TOUTES les tables et repart de zéro
-- Pour migration sans perte de données → voir bas du fichier
-- ============================================================

-- ============================================================
-- ÉTAPE 1: Supprimer toutes les tables (ordre des FK)
-- ============================================================
DROP TABLE IF EXISTS message_attachments CASCADE;
DROP TABLE IF EXISTS ws_connections CASCADE;
DROP TABLE IF EXISTS workflow_events CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS mandate_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS tax_declarations CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS mandates CASCADE;
DROP TABLE IF EXISTS contact_messages CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- ============================================================
-- ÉTAPE 2: Créer toutes les tables proprement
-- ============================================================

-- ADMINS
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- CLIENTS
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    company_name VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(50) DEFAULT 'QC',
    postal_code VARCHAR(20),
    sector VARCHAR(100),
    technologies TEXT,
    internal_notes TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- MANDATS
CREATE TABLE mandates (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    service_type VARCHAR(100) DEFAULT 'plc-support',
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- DEVIS
CREATE TABLE quotes (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    service_type VARCHAR(100),
    amount_ht DECIMAL(10,2) NOT NULL DEFAULT 0,
    tps_amount DECIMAL(10,2) DEFAULT 0,
    tvq_amount DECIMAL(10,2) DEFAULT 0,
    amount_ttc DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    expiry_date DATE,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- FACTURES
-- status: 'unpaid' | 'paid' | 'overdue' (retard, auto via send-reminders) | 'cancelled'
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id INTEGER REFERENCES mandates(id),
    quote_id INTEGER REFERENCES quotes(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount_ht DECIMAL(10,2) NOT NULL DEFAULT 0,
    tps_amount DECIMAL(10,2) DEFAULT 0,
    tvq_amount DECIMAL(10,2) DEFAULT 0,
    amount_ttc DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unpaid',          -- unpaid | paid | overdue | cancelled
    due_date DATE,
    paid_at TIMESTAMP,
    stripe_payment_intent_id VARCHAR(255),
    stripe_session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CONTRATS
-- status: 'draft' | 'pending' (en attente signature) | 'signed' | 'cancelled'
-- Workflow: draft → pending (envoi Dropbox Sign ou portail) → signed (les deux parties)
-- admin_signed_at + admin_signature_data : signature canvas admin
-- client_signature_data + client_signature_ip : signature canvas client (portail)
CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id INTEGER REFERENCES mandates(id),
    quote_id INTEGER REFERENCES quotes(id),
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    file_url TEXT,
    status VARCHAR(50) DEFAULT 'draft',           -- draft | pending | signed | cancelled
    signature_date TIMESTAMP,
    signature_url TEXT,
    hellosign_request_id VARCHAR(255),
    signed_at TIMESTAMP,                          -- date signature client
    client_signature_data TEXT,                   -- base64 PNG signature canvas client
    client_signature_ip VARCHAR(64),              -- IP du client lors de la signature
    admin_signature_data TEXT,                    -- base64 PNG signature canvas admin
    admin_signed_at TIMESTAMPTZ,                  -- date signature admin
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- PAIEMENTS
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id),
    client_id INTEGER REFERENCES clients(id),
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'cad',
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(100),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- REMBOURSEMENTS
CREATE TABLE refunds (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    invoice_id INTEGER REFERENCES invoices(id),
    stripe_refund_id VARCHAR(255),
    refund_number VARCHAR(50) UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tps_amount DECIMAL(10,2) DEFAULT 0,
    tvq_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- LITIGES STRIPE
CREATE TABLE disputes (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    invoice_id INTEGER REFERENCES invoices(id),
    mandate_id INTEGER REFERENCES mandates(id),
    stripe_dispute_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    resolution TEXT,
    opened_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- DÉPENSES
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'autre',
    amount DECIMAL(10,2) NOT NULL,
    tps_paid DECIMAL(10,2) DEFAULT 0,
    tvq_paid DECIMAL(10,2) DEFAULT 0,
    vendor VARCHAR(255),
    receipt_url TEXT,
    expense_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- DÉCLARATIONS FISCALES
CREATE TABLE tax_declarations (
    id SERIAL PRIMARY KEY,
    period_type VARCHAR(50) NOT NULL,
    period_label VARCHAR(100) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_revenue_ht DECIMAL(10,2) DEFAULT 0,
    total_tps DECIMAL(10,2) DEFAULT 0,
    total_tvq DECIMAL(10,2) DEFAULT 0,
    total_taxes DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    notes TEXT,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- DOCUMENTS
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id INTEGER REFERENCES mandates(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_type VARCHAR(50) DEFAULT 'pdf',
    file_name VARCHAR(255),
    file_url TEXT,
    file_size INTEGER,
    uploaded_by VARCHAR(100),
    category VARCHAR(100) DEFAULT 'Autres documents',
    status VARCHAR(50) DEFAULT 'disponible',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- MESSAGES
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('client', 'vnk')),
    content TEXT,
    attachment_data JSONB DEFAULT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- MESSAGES CONTACT (formulaire public)
CREATE TABLE contact_messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    service VARCHAR(100),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- LOGS MANDATS
CREATE TABLE mandate_logs (
    id SERIAL PRIMARY KEY,
    mandate_id INTEGER REFERENCES mandates(id) ON DELETE CASCADE,
    action VARCHAR(100),
    description TEXT,
    created_by VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ÉVÉNEMENTS WORKFLOW
-- Trace automatique de chaque étape du workflow par client
-- Alimenté par les routes admin (création mandat, acceptation devis, signature, paiement)
-- event_type WebSocket (v3.0) :
--   mandate_created   → WS: 'mandate_created'
--   mandate_updated   → WS: 'mandate_updated'
--   quote_sent        → WS: 'new_quote'
--   quote_accepted    → WS: 'quote_accepted'
--   contract_generated → WS: (inclus dans quote_accepted)
--   contract_signed_admin → WS: 'contract_signed'
--   contract_signed_client → WS: 'contract_client_signed'
--   invoice_generated → WS: 'new_invoice'
--   invoice_paid      → WS: 'invoice_paid'
--   reminder_sent     → WS: (message interne seulement)
--   new_message_vnk   → WS: 'new_message_vnk'
--   new_message_client → WS: 'new_message_client'
--   new_client        → WS: 'new_client'
CREATE TABLE workflow_events (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id INTEGER REFERENCES mandates(id),
    quote_id INTEGER REFERENCES quotes(id),
    contract_id INTEGER REFERENCES contracts(id),
    invoice_id INTEGER REFERENCES invoices(id),
    event_type VARCHAR(100) NOT NULL,
    event_label VARCHAR(255),
    triggered_by VARCHAR(50) DEFAULT 'admin',     -- 'admin' | 'client' | 'system' | 'websocket'
    ws_broadcast BOOLEAN DEFAULT false,           -- true si l'événement a été poussé via WebSocket
    metadata JSONB DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- CONNEXIONS WEBSOCKET (monitoring)
-- Optionnel — utile pour déboguer, auditer et monitorer les connexions actives
-- Nettoyage automatique via la fonction cleanup_stale_ws_connections()
CREATE TABLE ws_connections (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,                     -- 'admin' | 'client'
    connected_at TIMESTAMP DEFAULT NOW(),
    disconnected_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    ip_address VARCHAR(64),
    user_agent TEXT
);

-- ============================================================
-- ÉTAPE 3: Index pour les performances
-- ============================================================
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_mandates_client ON mandates(client_id);
CREATE INDEX idx_mandates_status ON mandates(status);
CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_quote ON invoices(quote_id);
CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_quote ON contracts(quote_id);
CREATE INDEX idx_messages_client ON messages(client_id);
CREATE INDEX idx_messages_unread ON messages(client_id, is_read);
CREATE INDEX idx_documents_client ON documents(client_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_workflow_client ON workflow_events(client_id);
CREATE INDEX idx_workflow_type ON workflow_events(event_type);
CREATE INDEX idx_workflow_ws ON workflow_events(ws_broadcast) WHERE ws_broadcast = true;
-- Index WebSocket connections
CREATE INDEX idx_ws_active ON ws_connections(is_active) WHERE is_active = true;
CREATE INDEX idx_ws_client ON ws_connections(client_id);
CREATE INDEX idx_ws_connected ON ws_connections(connected_at DESC);

-- ============================================================
-- ÉTAPE 4: Créer le compte admin VNK
-- (mot de passe: AdminVNK2026! — à changer après)
-- ============================================================
INSERT INTO admins (email, password_hash, full_name)
VALUES (
    'vnkautomatisation@gmail.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TqrqMGwsyMkBUFJsqVVvSxzBPvYK',
    'Yan Verone Kengne'
);

-- ============================================================
-- ÉTAPE 5: Données de test (optionnel — commenter si non voulu)
-- ============================================================

-- Client test
INSERT INTO clients (full_name, email, password_hash, company_name, phone, address, city, province, postal_code, sector, technologies, is_active)
VALUES (
    'Jean Tremblay',
    'jean@industries-xyz.com',
    '$2b$12$/WJ4oJadK.ae0ese2ilc6eU06XMgY8nuQwXv1NlJeV.85kZNKx/Py',
    'Industries XYZ Inc.',
    '418-000-0000',
    '123 rue Industrielle',
    'Lévis',
    'QC',
    'G6V 3P8',
    'Fabrication industrielle',
    'Siemens S7-1500,Allen-Bradley',
    true
);

-- Mandat test
INSERT INTO mandates (client_id, title, description, service_type, status, progress, start_date, notes)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'Support PLC Siemens S7-1500 — Ligne 3',
    'Diagnostic et correction programme défaillant sur ligne de production',
    'plc-support', 'active', 65, '2026-03-01',
    'Intervention en cours — 65% complété'
);

-- Devis test (lié au mandat)
INSERT INTO quotes (client_id, quote_number, title, description, amount_ht, tps_amount, tvq_amount, amount_ttc, status, expiry_date, accepted_at)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'D-2026-001',
    'Support PLC Siemens S7-1500 - Diagnostic',
    'Support technique diagnostic et correction PLC',
    3500.00, 175.00, 349.13, 4024.13,
    'accepted', '2026-04-30', NOW()
);

-- Contrat test (lié au devis)
INSERT INTO contracts (client_id, mandate_id, quote_id, contract_number, title, content, status, signed_at, admin_signed_at)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM mandates WHERE client_id = (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com') LIMIT 1),
    (SELECT id FROM quotes WHERE quote_number = 'D-2026-001'),
    'CT-2026-001',
    'Contrat de service — Support PLC Siemens S7-1500 - Diagnostic',
    'Services d''automatisation industrielle conformément au devis D-2026-001.',
    'signed', NOW(), NOW()
);

-- Facture test (liée au devis et au mandat)
INSERT INTO invoices (client_id, mandate_id, quote_id, invoice_number, title, description, amount_ht, tps_amount, tvq_amount, amount_ttc, status, due_date)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM mandates WHERE client_id = (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com') LIMIT 1),
    (SELECT id FROM quotes WHERE quote_number = 'D-2026-001'),
    'F-2026-001',
    'Support PLC - Acompte 50%',
    'Conformément au contrat CT-2026-001 et au devis D-2026-001',
    1750.00, 87.50, 174.56, 2012.06,
    'unpaid', '2026-04-15'
);

-- Message test client
INSERT INTO messages (client_id, sender, content, is_read)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'client',
    'Bonjour, avez-vous une mise à jour sur l''avancement du diagnostic ?',
    false
);

-- Message test VNK (workflow notification simulée)
INSERT INTO messages (client_id, sender, content, is_read)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'vnk',
    'Bonjour Jean,' || chr(10) || chr(10) || 'Votre mandat « Support PLC Siemens S7-1500 — Ligne 3 » est maintenant actif à 65%.' || chr(10) || chr(10) || 'Équipe VNK Automatisation Inc.',
    false
);

-- Dépense test
INSERT INTO expenses (title, category, amount, tps_paid, tvq_paid, vendor, expense_date)
VALUES ('Abonnement TIA Portal', 'logiciel', 299.99, 15.00, 29.92, 'Siemens Canada', '2026-03-01');

-- Événements workflow test
INSERT INTO workflow_events (client_id, mandate_id, event_type, event_label, triggered_by, metadata)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM mandates WHERE client_id = (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com') LIMIT 1),
    'mandate_created',
    'Mandat ouvert — Support PLC Siemens S7-1500 — Ligne 3',
    'admin',
    '{"service_type": "plc-support"}'
);

INSERT INTO workflow_events (client_id, quote_id, event_type, event_label, triggered_by, metadata)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM quotes WHERE quote_number = 'D-2026-001'),
    'quote_sent',
    'Devis D-2026-001 envoyé au client — 4 024,13 $ TTC',
    'admin',
    '{"amount_ttc": 4024.13, "quote_number": "D-2026-001"}'
);

INSERT INTO workflow_events (client_id, quote_id, contract_id, event_type, event_label, triggered_by, metadata)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM quotes WHERE quote_number = 'D-2026-001'),
    (SELECT id FROM contracts WHERE contract_number = 'CT-2026-001'),
    'quote_accepted',
    'Devis D-2026-001 accepté — Contrat CT-2026-001 généré automatiquement',
    'admin',
    '{"contract_number": "CT-2026-001"}'
);

INSERT INTO workflow_events (client_id, contract_id, invoice_id, event_type, event_label, triggered_by, metadata)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM contracts WHERE contract_number = 'CT-2026-001'),
    (SELECT id FROM invoices WHERE invoice_number = 'F-2026-001'),
    'invoice_generated',
    'Facture F-2026-001 générée automatiquement après signature du contrat — 2 012,06 $ TTC',
    'system',
    '{"invoice_number": "F-2026-001", "amount_ttc": 2012.06}'
);

-- ============================================================
-- VÉRIFICATION FINALE
-- ============================================================
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as colonnes
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- Résultat attendu : 17 tables
-- admins, clients, contact_messages, contracts, disputes, documents,
-- expenses, invoices, mandate_logs, mandates, messages,
-- payments, quotes, refunds, tax_declarations, workflow_events, ws_connections


-- ============================================================
-- MIGRATION v2.0 → v3.0 (SANS réinitialiser la base)
-- À exécuter sur une base existante qui a déjà les 16 tables
-- NE PAS exécuter si vous faites un DROP + CREATE complet
-- ============================================================

/*
-- 1. Ajouter la colonne ws_broadcast à workflow_events
ALTER TABLE workflow_events
    ADD COLUMN IF NOT EXISTS ws_broadcast BOOLEAN DEFAULT false,
    ALTER COLUMN triggered_by TYPE VARCHAR(50);

-- 2. Créer la table ws_connections
CREATE TABLE IF NOT EXISTS ws_connections (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    connected_at TIMESTAMP DEFAULT NOW(),
    disconnected_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    ip_address VARCHAR(64),
    user_agent TEXT
);

-- 3. Ajouter les nouveaux index
CREATE INDEX IF NOT EXISTS idx_workflow_ws ON workflow_events(ws_broadcast) WHERE ws_broadcast = true;
CREATE INDEX IF NOT EXISTS idx_ws_active ON ws_connections(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ws_client ON ws_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_ws_connected ON ws_connections(connected_at DESC);

-- 4. Installer le package ws (dans le terminal Railway ou local)
-- npm install ws

-- 5. Vérification
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
-- Doit retourner 17 tables dont ws_connections
*/