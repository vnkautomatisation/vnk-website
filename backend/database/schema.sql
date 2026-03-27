-- ============================================
-- VNK Automatisation Inc. - Database Schema
-- ============================================

-- Create database
-- CREATE DATABASE vnk_db;
-- \c vnk_db

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contact messages table
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

-- Mandates table
CREATE TABLE IF NOT EXISTS mandates (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  service_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Mandate logs table
CREATE TABLE IF NOT EXISTS mandate_logs (
  id SERIAL PRIMARY KEY,
  mandate_id INTEGER REFERENCES mandates(id),
  log_date DATE NOT NULL,
  description TEXT NOT NULL,
  hours_spent DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quotes table
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

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER REFERENCES quotes(id),
  client_id INTEGER REFERENCES clients(id),
  content TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  signature_date TIMESTAMP,
  signature_url VARCHAR(500),
  hellosign_request_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoices table
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

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id),
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'completed',
  paid_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  sender VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_mandates_client ON mandates(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id);