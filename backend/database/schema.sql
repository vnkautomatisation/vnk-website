-- ============================================
-- VNK Automatisation Inc. — Phase 1 Schema
-- Exécuter dans pgAdmin sur Railway
-- ============================================

-- 1. Table remboursements (credit notes)
CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  refund_number VARCHAR(50) UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  tps_amount DECIMAL(10,2) DEFAULT 0,
  tvq_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Table litiges
CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  mandate_id INTEGER REFERENCES mandates(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  resolution TEXT,
  opened_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Table déclarations fiscales
CREATE TABLE IF NOT EXISTS tax_declarations (
  id SERIAL PRIMARY KEY,
  period_type VARCHAR(20) NOT NULL,
  period_label VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue_ht DECIMAL(10,2) DEFAULT 0,
  total_tps DECIMAL(10,2) DEFAULT 0,
  total_tvq DECIMAL(10,2) DEFAULT 0,
  total_taxes DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  submitted_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Table dépenses professionnelles
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  tps_paid DECIMAL(10,2) DEFAULT 0,
  tvq_paid DECIMAL(10,2) DEFAULT 0,
  vendor VARCHAR(255),
  receipt_url TEXT,
  expense_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Table contrats clients
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  mandate_id INTEGER REFERENCES mandates(id) ON DELETE SET NULL,
  quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  file_url TEXT,
  signed_at TIMESTAMP,
  signature_url TEXT,
  hellosign_request_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Pièces jointes messages
CREATE TABLE IF NOT EXISTS message_attachments (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_refunds_client ON refunds(client_id);
CREATE INDEX IF NOT EXISTS idx_disputes_client ON disputes(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Vérification
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('refunds','disputes','tax_declarations','expenses','contracts','message_attachments')
ORDER BY table_name;