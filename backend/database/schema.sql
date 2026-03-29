-- ============================================================
-- VNK Automatisation Inc. — Schéma complet base de données
-- Version finale — À exécuter dans pgAdmin sur Railway
-- ATTENTION: Supprime TOUTES les tables et repart de zéro
-- ============================================================

-- ============================================================
-- ÉTAPE 1: Supprimer toutes les tables (ordre des FK)
-- ============================================================
DROP TABLE IF EXISTS message_attachments CASCADE;
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
    amount_ht DECIMAL(10,2) NOT NULL DEFAULT 0,
    tps_amount DECIMAL(10,2) DEFAULT 0,
    tvq_amount DECIMAL(10,2) DEFAULT 0,
    amount_ttc DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- FACTURES
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
    status VARCHAR(50) DEFAULT 'unpaid',
    due_date DATE,
    paid_at TIMESTAMP,
    stripe_payment_intent_id VARCHAR(255),
    stripe_session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CONTRATS
CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    mandate_id INTEGER REFERENCES mandates(id),
    quote_id INTEGER REFERENCES quotes(id),
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    file_url TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    signature_date TIMESTAMP,
    signature_url TEXT,
    hellosign_request_id VARCHAR(255),
    signed_at TIMESTAMP,
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

-- ============================================================
-- ÉTAPE 3: Index pour les performances
-- ============================================================
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_mandates_client ON mandates(client_id);
CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_messages_client ON messages(client_id);
CREATE INDEX idx_documents_client ON documents(client_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

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

-- Devis test
INSERT INTO quotes (client_id, quote_number, title, description, amount_ht, tps_amount, tvq_amount, amount_ttc, status, expiry_date)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'D-2026-001',
    'Support PLC Siemens S7-1500 - Diagnostic',
    'Support technique diagnostic et correction PLC',
    3500.00, 175.00, 349.13, 4024.13,
    'accepted', '2026-04-30'
);

-- Facture test
INSERT INTO invoices (client_id, invoice_number, title, amount_ht, tps_amount, tvq_amount, amount_ttc, status, due_date)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'F-2026-001',
    'Support PLC - Acompte 50%',
    1750.00, 87.50, 174.56, 2012.06,
    'unpaid', '2026-04-15'
);

-- Message test
INSERT INTO messages (client_id, sender, content, is_read)
VALUES (
    (SELECT id FROM clients WHERE email = 'jean@industries-xyz.com'),
    'client',
    'Bonjour, avez-vous une mise à jour sur l''avancement du diagnostic ?',
    false
);

-- Dépense test
INSERT INTO expenses (title, category, amount, tps_paid, tvq_paid, vendor, expense_date)
VALUES ('Abonnement TIA Portal', 'logiciel', 299.99, 15.00, 29.92, 'Siemens Canada', '2026-03-01');

-- ============================================================
-- VÉRIFICATION FINALE
-- ============================================================
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as colonnes
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;