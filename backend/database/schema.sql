-- ============================================
-- VNK Automatisation Inc. - Database Schema
-- Version finale — Mars 2026
-- ============================================

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  address VARCHAR(255),
  city VARCHAR(100),
  province VARCHAR(10) DEFAULT 'QC',
  postal_code VARCHAR(10),
  sector VARCHAR(100),
  technologies VARCHAR(500),
  internal_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contact messages
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  service_interest VARCHAR(100),
  plc_brand VARCHAR(100),
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Mandates
CREATE TABLE IF NOT EXISTS mandates (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  service_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  progress INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Mandate logs
CREATE TABLE IF NOT EXISTS mandate_logs (
  id SERIAL PRIMARY KEY,
  mandate_id INTEGER REFERENCES mandates(id),
  log_date DATE NOT NULL,
  description TEXT NOT NULL,
  hours_spent DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  service_type VARCHAR(100),
  amount_ht DECIMAL(10,2) NOT NULL,
  tps_amount DECIMAL(10,2) NOT NULL,
  tvq_amount DECIMAL(10,2) NOT NULL,
  amount_ttc DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  expiry_date DATE,
  accepted_at TIMESTAMP,
  hellosign_signature_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contracts
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

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  mandate_id INTEGER REFERENCES mandates(id),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount_ht DECIMAL(10,2) NOT NULL,
  tps_amount DECIMAL(10,2) NOT NULL,
  tvq_amount DECIMAL(10,2) NOT NULL,
  amount_ttc DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'unpaid',
  due_date DATE,
  paid_at TIMESTAMP,
  stripe_payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id),
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'completed',
  paid_at TIMESTAMP DEFAULT NOW()
);

-- Refunds
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

-- Disputes
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

-- Tax declarations
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

-- Expenses
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

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  mandate_id INTEGER REFERENCES mandates(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_type VARCHAR(50),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  uploaded_by VARCHAR(50) DEFAULT 'vnk',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  sender VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Message attachments
CREATE TABLE IF NOT EXISTS message_attachments (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_mandates_client ON mandates(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_refunds_client ON refunds(client_id);
CREATE INDEX IF NOT EXISTS idx_disputes_client ON disputes(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);


