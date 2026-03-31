-- ============================================================
-- VNK Automatisation Inc. — Schéma complet base de données
-- Version 5.0 — Demandes de projet avec suivi de statut
-- Mis à jour : 2026-03-31
-- Changements v5.0 :
--   + messages.request_status (suivi statut demandes portail)
--   + index idx_messages_request_status
--   + page_views (analytics trafic site)
--   + Toutes les colonnes ALTER TABLE intégrées directement
-- ATTENTION: Supprime TOUTES les tables et repart de zéro
-- Pour migration sans perte de données → voir section MIGRATION en bas
-- ============================================================

-- ============================================================
-- ÉTAPE 1: Supprimer toutes les tables (ordre des FK)
-- ============================================================
DROP TABLE IF EXISTS message_attachments CASCADE;
DROP TABLE IF EXISTS ws_connections CASCADE;
DROP TABLE IF EXISTS workflow_events CASCADE;
DROP TABLE IF EXISTS page_views CASCADE;
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
-- ÉTAPE 2: Créer toutes les tables
-- ============================================================

-- ADMINS
CREATE TABLE admins (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- CLIENTS
CREATE TABLE clients (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    company_name    VARCHAR(255),
    phone           VARCHAR(50),
    address         TEXT,
    city            VARCHAR(100),
    province        VARCHAR(50)  DEFAULT 'QC',
    postal_code     VARCHAR(20),
    sector          VARCHAR(100),
    technologies    TEXT,
    internal_notes  TEXT,
    avatar_url      TEXT,
    is_active       BOOLEAN      DEFAULT true,
    last_login      TIMESTAMP,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW()
);

-- MANDATS
CREATE TABLE mandates (
    id              SERIAL PRIMARY KEY,
    client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    service_type    VARCHAR(100) DEFAULT 'plc-support',
    status          VARCHAR(50)  DEFAULT 'pending',   -- pending | active | in_progress | completed | cancelled | paused
    progress        INTEGER      DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    start_date      DATE,
    end_date        DATE,
    notes           TEXT,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW()
);

-- DEVIS
CREATE TABLE quotes (
    id                      SERIAL PRIMARY KEY,
    client_id               INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    quote_number            VARCHAR(50) UNIQUE NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    service_type            VARCHAR(100),
    amount_ht               DECIMAL(10,2) NOT NULL DEFAULT 0,
    tps_amount              DECIMAL(10,2) DEFAULT 0,
    tvq_amount              DECIMAL(10,2) DEFAULT 0,
    amount_ttc              DECIMAL(10,2) DEFAULT 0,
    status                  VARCHAR(50)  DEFAULT 'pending',   -- pending | accepted | declined | expired
    expiry_date             DATE,
    accepted_at             TIMESTAMP,
    signed_at               TIMESTAMP,
    payment_plan            VARCHAR(30)  DEFAULT 'split_50_50',
    payment_pct1            INT          DEFAULT 50,
    payment_pct2            INT          DEFAULT 50,
    payment_conditions      TEXT,
    client_signature_data   TEXT,
    created_at              TIMESTAMP    DEFAULT NOW(),
    updated_at              TIMESTAMP    DEFAULT NOW()
);

-- CONTRATS
-- status: draft | pending | signed | cancelled
CREATE TABLE contracts (
    id                      SERIAL PRIMARY KEY,
    client_id               INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id              INTEGER REFERENCES mandates(id),
    quote_id                INTEGER REFERENCES quotes(id),
    contract_number         VARCHAR(50) UNIQUE NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    content                 TEXT,
    file_url                TEXT,
    status                  VARCHAR(50)  DEFAULT 'pending',   -- draft | pending | signed | cancelled
    amount_ttc              DECIMAL(10,2) DEFAULT 0,
    hellosign_request_id    VARCHAR(255),
    signed_at               TIMESTAMP,
    client_signature_data   TEXT,
    client_signature_ip     VARCHAR(64),
    admin_signature_data    TEXT,
    admin_signed_at         TIMESTAMPTZ,
    created_at              TIMESTAMP    DEFAULT NOW(),
    updated_at              TIMESTAMP    DEFAULT NOW()
);

-- FACTURES
-- status: unpaid | paid | overdue | cancelled
CREATE TABLE invoices (
    id                          SERIAL PRIMARY KEY,
    client_id                   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id                  INTEGER REFERENCES mandates(id),
    quote_id                    INTEGER REFERENCES quotes(id),
    contract_id                 INTEGER REFERENCES contracts(id),
    invoice_number              VARCHAR(50) UNIQUE NOT NULL,
    title                       VARCHAR(255) NOT NULL,
    description                 TEXT,
    amount_ht                   DECIMAL(10,2) NOT NULL DEFAULT 0,
    tps_amount                  DECIMAL(10,2) DEFAULT 0,
    tvq_amount                  DECIMAL(10,2) DEFAULT 0,
    amount_ttc                  DECIMAL(10,2) DEFAULT 0,
    status                      VARCHAR(50)  DEFAULT 'unpaid',
    due_date                    DATE,
    paid_at                     TIMESTAMP,
    payment_method              VARCHAR(50),
    invoice_phase               VARCHAR(20),
    phase_number                INT          DEFAULT 1,
    stripe_payment_intent_id    VARCHAR(255),
    stripe_session_id           VARCHAR(255),
    created_at                  TIMESTAMP    DEFAULT NOW(),
    updated_at                  TIMESTAMP    DEFAULT NOW()
);

-- PAIEMENTS
CREATE TABLE payments (
    id                          SERIAL PRIMARY KEY,
    invoice_id                  INTEGER REFERENCES invoices(id),
    client_id                   INTEGER REFERENCES clients(id),
    stripe_payment_intent_id    VARCHAR(255),
    stripe_charge_id            VARCHAR(255),
    amount                      DECIMAL(10,2) NOT NULL,
    currency                    VARCHAR(10)  DEFAULT 'cad',
    status                      VARCHAR(50)  DEFAULT 'pending',
    payment_method              VARCHAR(100),
    paid_at                     TIMESTAMP,
    created_at                  TIMESTAMP    DEFAULT NOW()
);

-- REMBOURSEMENTS
CREATE TABLE refunds (
    id               SERIAL PRIMARY KEY,
    client_id        INTEGER NOT NULL REFERENCES clients(id),
    invoice_id       INTEGER REFERENCES invoices(id),
    stripe_refund_id VARCHAR(255),
    refund_number    VARCHAR(50) UNIQUE NOT NULL,
    reason           TEXT NOT NULL,
    amount           DECIMAL(10,2) NOT NULL,
    tps_amount       DECIMAL(10,2) DEFAULT 0,
    tvq_amount       DECIMAL(10,2) DEFAULT 0,
    total_amount     DECIMAL(10,2) NOT NULL,
    status           VARCHAR(50)  DEFAULT 'pending',
    notes            TEXT,
    processed_at     TIMESTAMP,
    created_at       TIMESTAMP    DEFAULT NOW()
);

-- LITIGES
CREATE TABLE disputes (
    id                SERIAL PRIMARY KEY,
    client_id         INTEGER NOT NULL REFERENCES clients(id),
    invoice_id        INTEGER REFERENCES invoices(id),
    mandate_id        INTEGER REFERENCES mandates(id),
    stripe_dispute_id VARCHAR(255),
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    status            VARCHAR(50)  DEFAULT 'open',
    priority          VARCHAR(20)  DEFAULT 'medium',
    resolution        TEXT,
    opened_at         TIMESTAMP    DEFAULT NOW(),
    resolved_at       TIMESTAMP,
    created_at        TIMESTAMP    DEFAULT NOW()
);

-- DÉPENSES
CREATE TABLE expenses (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    category     VARCHAR(100) DEFAULT 'autre',
    amount       DECIMAL(10,2) NOT NULL,
    tps_paid     DECIMAL(10,2) DEFAULT 0,
    tvq_paid     DECIMAL(10,2) DEFAULT 0,
    vendor       VARCHAR(255),
    receipt_url  TEXT,
    expense_date DATE NOT NULL,
    notes        TEXT,
    created_at   TIMESTAMP    DEFAULT NOW()
);

-- DÉCLARATIONS FISCALES
CREATE TABLE tax_declarations (
    id               SERIAL PRIMARY KEY,
    period_type      VARCHAR(50)  NOT NULL,
    period_label     VARCHAR(100) NOT NULL,
    period_start     DATE         NOT NULL,
    period_end       DATE         NOT NULL,
    total_revenue_ht DECIMAL(10,2) DEFAULT 0,
    total_tps        DECIMAL(10,2) DEFAULT 0,
    total_tvq        DECIMAL(10,2) DEFAULT 0,
    total_taxes      DECIMAL(10,2) DEFAULT 0,
    status           VARCHAR(50)  DEFAULT 'draft',
    notes            TEXT,
    submitted_at     TIMESTAMP,
    created_at       TIMESTAMP    DEFAULT NOW()
);

-- DOCUMENTS
CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id  INTEGER REFERENCES mandates(id),
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    file_type   VARCHAR(50)  DEFAULT 'pdf',
    file_name   VARCHAR(255),
    file_url    TEXT,
    file_size   INTEGER,
    uploaded_by VARCHAR(100),
    category    VARCHAR(100),
    status      VARCHAR(50)  DEFAULT 'disponible',
    is_read     BOOLEAN      DEFAULT false,
    created_at  TIMESTAMP    DEFAULT NOW(),
    updated_at  TIMESTAMP    DEFAULT NOW()
);

-- MESSAGES (chat portail + emails + demandes de projet)
-- sender        : 'client' | 'vnk'
-- channel       : 'chat' | 'email' | 'both' | 'email_received'
-- request_status: statut de la demande de projet (si le message est une demande)
--   new         → demande reçue, pas encore traitée
--   in_progress → admin travaille sur la demande
--   converted   → un mandat ou devis a été créé depuis cette demande
--   closed      → demande rejetée ou annulée
--   NULL        → message ordinaire (pas une demande de projet)
CREATE TABLE messages (
    id              SERIAL PRIMARY KEY,
    client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sender          VARCHAR(20) NOT NULL CHECK (sender IN ('client', 'vnk')),
    content         TEXT,
    attachment_data JSONB        DEFAULT NULL,
    is_read         BOOLEAN      DEFAULT false,
    channel         VARCHAR(30)  DEFAULT 'chat',
    request_status  VARCHAR(20)  DEFAULT NULL,   -- NULL | new | in_progress | converted | closed
    created_at      TIMESTAMP    DEFAULT NOW()
);

-- MESSAGES CONTACT (formulaire public du site)
CREATE TABLE contact_messages (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL,
    company    VARCHAR(255),
    service    VARCHAR(100),
    message    TEXT NOT NULL,
    is_read    BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- LOGS MANDATS
CREATE TABLE mandate_logs (
    id         SERIAL PRIMARY KEY,
    mandate_id INTEGER REFERENCES mandates(id) ON DELETE CASCADE,
    action     VARCHAR(100),
    description TEXT,
    created_by VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ÉVÉNEMENTS WORKFLOW
CREATE TABLE workflow_events (
    id           SERIAL PRIMARY KEY,
    client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id   INTEGER REFERENCES mandates(id),
    quote_id     INTEGER REFERENCES quotes(id),
    contract_id  INTEGER REFERENCES contracts(id),
    invoice_id   INTEGER REFERENCES invoices(id),
    event_type   VARCHAR(100) NOT NULL,
    event_label  VARCHAR(255),
    triggered_by VARCHAR(50)  DEFAULT 'admin',
    ws_broadcast BOOLEAN      DEFAULT false,
    metadata     JSONB        DEFAULT NULL,
    created_at   TIMESTAMP    DEFAULT NOW()
);

-- CONNEXIONS WEBSOCKET (monitoring)
CREATE TABLE ws_connections (
    id              SERIAL PRIMARY KEY,
    client_id       INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,
    connected_at    TIMESTAMP    DEFAULT NOW(),
    disconnected_at TIMESTAMP,
    is_active       BOOLEAN      DEFAULT true,
    ip_address      VARCHAR(64),
    user_agent      TEXT
);

-- ANALYTICS — Trafic site et présence portail
CREATE TABLE page_views (
    id          SERIAL PRIMARY KEY,
    session_id  VARCHAR(64),
    client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    page        VARCHAR(255)    NOT NULL,
    referrer    VARCHAR(512),
    user_agent  VARCHAR(512),
    ip_hash     VARCHAR(64),
    duration_ms INTEGER,
    created_at  TIMESTAMP       DEFAULT NOW()
);

-- ============================================================
-- ÉTAPE 3: Index pour les performances
-- ============================================================
CREATE INDEX idx_clients_email            ON clients(email);
CREATE INDEX idx_mandates_client          ON mandates(client_id);
CREATE INDEX idx_mandates_status          ON mandates(status);
CREATE INDEX idx_quotes_client            ON quotes(client_id);
CREATE INDEX idx_quotes_status            ON quotes(status);
CREATE INDEX idx_invoices_client          ON invoices(client_id);
CREATE INDEX idx_invoices_status          ON invoices(status);
CREATE INDEX idx_invoices_due_date        ON invoices(due_date);
CREATE INDEX idx_invoices_quote           ON invoices(quote_id);
CREATE INDEX idx_invoices_contract        ON invoices(contract_id);
CREATE INDEX idx_contracts_client         ON contracts(client_id);
CREATE INDEX idx_contracts_status         ON contracts(status);
CREATE INDEX idx_contracts_quote          ON contracts(quote_id);
CREATE INDEX idx_messages_client          ON messages(client_id);
CREATE INDEX idx_messages_unread          ON messages(client_id, is_read);
CREATE INDEX idx_messages_request_status  ON messages(request_status) WHERE request_status IS NOT NULL;
CREATE INDEX idx_documents_client         ON documents(client_id);
CREATE INDEX idx_documents_unread         ON documents(client_id, is_read) WHERE is_read = false;
CREATE INDEX idx_payments_invoice         ON payments(invoice_id);
CREATE INDEX idx_payments_client          ON payments(client_id);
CREATE INDEX idx_expenses_date            ON expenses(expense_date);
CREATE INDEX idx_workflow_client          ON workflow_events(client_id);
CREATE INDEX idx_workflow_type            ON workflow_events(event_type);
CREATE INDEX idx_workflow_ws              ON workflow_events(ws_broadcast) WHERE ws_broadcast = true;
CREATE INDEX idx_ws_active                ON ws_connections(is_active) WHERE is_active = true;
CREATE INDEX idx_ws_client                ON ws_connections(client_id);
CREATE INDEX idx_ws_connected             ON ws_connections(connected_at DESC);
CREATE INDEX idx_pv_created               ON page_views(created_at);
CREATE INDEX idx_pv_session               ON page_views(session_id);
CREATE INDEX idx_pv_client                ON page_views(client_id);
CREATE INDEX idx_pv_page                  ON page_views(page);

-- ============================================================
-- ÉTAPE 4: Compte admin VNK
-- (mot de passe: AdminVNK2026! — à changer après déploiement)
-- ============================================================
INSERT INTO admins (email, password_hash, full_name)
VALUES (
    'vnkautomatisation@gmail.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TqrqMGwsyMkBUFJsqVVvSxzBPvYK',
    'Yan Verone Kengne'
);

-- ============================================================
-- ÉTAPE 5: Données de test
-- (commenter ce bloc si non voulu)
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
    'Lévis', 'QC', 'G6V 3P8',
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

-- Devis test
INSERT INTO quotes (client_id, quote_number, title, description, amount_ht, tps_amount, tvq_amount, amount_ttc, status, expiry_date, accepted_at)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'D-2026-001',
    'Support PLC Siemens S7-1500 - Diagnostic',
    'Support technique diagnostic et correction PLC',
    3500.00, 175.00, 349.13, 4024.13,
    'accepted', '2026-04-30', NOW()
);

-- Contrat test
INSERT INTO contracts (client_id, mandate_id, quote_id, contract_number, title, content, status, amount_ttc, signed_at, admin_signed_at)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM mandates WHERE client_id = (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com') LIMIT 1),
    (SELECT id FROM quotes WHERE quote_number = 'D-2026-001'),
    'CT-2026-001',
    'Contrat de service — Support PLC Siemens S7-1500 - Diagnostic',
    'Services d''automatisation industrielle conformément au devis D-2026-001.',
    'signed', 4024.13, NOW(), NOW()
);

-- Facture test
INSERT INTO invoices (client_id, mandate_id, quote_id, contract_id, invoice_number, title, description, amount_ht, tps_amount, tvq_amount, amount_ttc, status, due_date)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM mandates WHERE client_id = (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com') LIMIT 1),
    (SELECT id FROM quotes WHERE quote_number = 'D-2026-001'),
    (SELECT id FROM contracts WHERE contract_number = 'CT-2026-001'),
    'F-2026-001',
    'Support PLC - Acompte 50%',
    'Conformément au contrat CT-2026-001 et au devis D-2026-001',
    1750.00, 87.50, 174.56, 2012.06,
    'unpaid', '2026-04-15'
);

-- Document test (non lu → badge portail)
INSERT INTO documents (client_id, title, description, file_type, file_name, category, status, is_read)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'Rapport diagnostic PLC Ligne 3',
    'Rapport complet du diagnostic effectué sur la ligne 3',
    'pdf', 'rapport-diagnostic-ligne3.pdf',
    'Rapports', 'disponible', false
);

-- Messages test
INSERT INTO messages (client_id, sender, content, is_read)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'client',
    'Bonjour, avez-vous une mise à jour sur l''avancement du diagnostic ?',
    false
);

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
    'mandate_created', 'Mandat ouvert — Support PLC Siemens S7-1500 — Ligne 3', 'admin',
    '{"service_type": "plc-support"}'
);

INSERT INTO workflow_events (client_id, quote_id, event_type, event_label, triggered_by, metadata)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM quotes WHERE quote_number = 'D-2026-001'),
    'quote_sent', 'Devis D-2026-001 envoyé — 4 024,13 $ TTC', 'admin',
    '{"amount_ttc": 4024.13, "quote_number": "D-2026-001"}'
);

INSERT INTO workflow_events (client_id, quote_id, contract_id, event_type, event_label, triggered_by, metadata)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM quotes WHERE quote_number = 'D-2026-001'),
    (SELECT id FROM contracts WHERE contract_number = 'CT-2026-001'),
    'quote_accepted', 'Devis D-2026-001 accepté — Contrat CT-2026-001 généré', 'client',
    '{"contract_number": "CT-2026-001"}'
);

INSERT INTO workflow_events (client_id, contract_id, event_type, event_label, triggered_by, metadata)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM contracts WHERE contract_number = 'CT-2026-001'),
    'contract_signed_both', 'Contrat CT-2026-001 signé par les deux parties', 'system',
    '{"contract_number": "CT-2026-001"}'
);

INSERT INTO workflow_events (client_id, contract_id, invoice_id, event_type, event_label, triggered_by, metadata)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    (SELECT id FROM contracts WHERE contract_number = 'CT-2026-001'),
    (SELECT id FROM invoices WHERE invoice_number = 'F-2026-001'),
    'invoice_generated', 'Facture F-2026-001 générée automatiquement — 2 012,06 $ TTC', 'system',
    '{"invoice_number": "F-2026-001", "amount_ttc": 2012.06}'
);

-- ============================================================
-- VÉRIFICATION FINALE
-- ============================================================
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns c
        WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS colonnes
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- Résultat attendu : 18 tables
-- admins, clients, contact_messages, contracts, disputes, documents,
-- expenses, invoices, mandate_logs, mandates, messages,
-- page_views, payments, quotes, refunds, tax_declarations,
-- workflow_events, ws_connections

-- ============================================================
-- MIGRATION v4.0 → v5.0 (SANS réinitialiser la base)
-- À exécuter sur une base existante (Railway actif)
-- NE PAS exécuter si vous faites un DROP + CREATE complet
-- ============================================================

-- 1. Colonne request_status dans messages (NOUVEAU v5.0)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_status VARCHAR(20) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_request_status ON messages(request_status) WHERE request_status IS NOT NULL;

-- Initialiser les demandes de projet existantes à 'new'
UPDATE messages
SET request_status = 'new'
WHERE content LIKE '%NOUVELLE DEMANDE DE PROJET%'
  AND request_status IS NULL;

-- 2. Table page_views si manquante (ajoutée en cours de dev)
CREATE TABLE IF NOT EXISTS page_views (
    id          SERIAL PRIMARY KEY,
    session_id  VARCHAR(64),
    client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    page        VARCHAR(255) NOT NULL,
    referrer    VARCHAR(512),
    user_agent  VARCHAR(512),
    ip_hash     VARCHAR(64),
    duration_ms INTEGER,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_pv_session ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_pv_client  ON page_views(client_id);
CREATE INDEX IF NOT EXISTS idx_pv_page    ON page_views(page);

-- 3. Autres colonnes v4.x déjà appliquées (idempotentes)
ALTER TABLE messages  ADD COLUMN IF NOT EXISTS channel          VARCHAR(30)  DEFAULT 'chat';
ALTER TABLE invoices  ADD COLUMN IF NOT EXISTS payment_method   VARCHAR(50);
ALTER TABLE invoices  ADD COLUMN IF NOT EXISTS invoice_phase    VARCHAR(20);
ALTER TABLE invoices  ADD COLUMN IF NOT EXISTS phase_number     INT          DEFAULT 1;
ALTER TABLE invoices  ADD COLUMN IF NOT EXISTS contract_id      INTEGER REFERENCES contracts(id);
ALTER TABLE quotes    ADD COLUMN IF NOT EXISTS payment_plan     VARCHAR(30)  DEFAULT 'split_50_50';
ALTER TABLE quotes    ADD COLUMN IF NOT EXISTS payment_pct1     INT          DEFAULT 50;
ALTER TABLE quotes    ADD COLUMN IF NOT EXISTS payment_pct2     INT          DEFAULT 50;
ALTER TABLE quotes    ADD COLUMN IF NOT EXISTS payment_conditions TEXT;
ALTER TABLE quotes    ADD COLUMN IF NOT EXISTS client_signature_data TEXT;
ALTER TABLE quotes    ADD COLUMN IF NOT EXISTS signed_at        TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category         VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status           VARCHAR(50)  DEFAULT 'Disponible';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_read          BOOLEAN      DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS amount_ttc       DECIMAL(10,2) DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS quote_id         INTEGER REFERENCES quotes(id);
ALTER TABLE payments  ADD COLUMN IF NOT EXISTS payment_method   VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_documents_unread  ON documents(client_id, is_read) WHERE is_read = false;

-- 4. Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'messages'
ORDER BY ordinal_position;