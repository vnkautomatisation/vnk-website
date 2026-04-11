-- ════════════════════════════════════════════════════════════
-- VNK — Migration initiale Prisma (IDEMPOTENTE)
--
-- Cette migration est 100 % idempotente : elle peut être appliquée sur
-- une DB vierge OU sur une DB existante (Railway avec le schéma Express).
-- Les tables/enums/indexes déjà présents sont ignorés sans erreur.
-- ════════════════════════════════════════════════════════════

-- ─── ENUMS (DO block pour idempotence) ─────────────────────
DO $$ BEGIN CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'admin', 'accountant', 'sales', 'readonly'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MandateStatus" AS ENUM ('pending', 'active', 'in_progress', 'paused', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "QuoteStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ContractStatus" AS ENUM ('draft', 'pending', 'sent', 'signed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'unpaid', 'paid', 'overdue', 'cancelled', 'refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DisputeStatus" AS ENUM ('open', 'in_progress', 'resolved', 'escalated'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DisputePriority" AS ENUM ('low', 'medium', 'high', 'critical'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ProjectRequestStatus" AS ENUM ('new', 'in_progress', 'converted', 'closed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ProjectRequestUrgency" AS ENUM ('low', 'normal', 'urgent', 'critical'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "SettingType" AS ENUM ('string', 'number', 'boolean', 'json', 'secret'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ═══════════════════════════════════════════════════════════
-- TABLES EXISTANTES (schéma Express) — IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════

-- ADMINS
CREATE TABLE IF NOT EXISTS "admins" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_key" ON "admins"("email");
-- Colonnes Next.js
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "role" "AdminRole" NOT NULL DEFAULT 'admin';
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "last_login" TIMESTAMP(3);
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ADMIN SESSIONS (nouvelle)
CREATE TABLE IF NOT EXISTS "admin_sessions" (
    "id" TEXT NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_sessions_token_key" ON "admin_sessions"("token");
CREATE INDEX IF NOT EXISTS "admin_sessions_token_idx" ON "admin_sessions"("token");

-- CLIENTS
CREATE TABLE IF NOT EXISTS "clients" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "company_name" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "city" VARCHAR(100),
    "province" VARCHAR(50) DEFAULT 'QC',
    "postal_code" VARCHAR(20),
    "sector" VARCHAR(100),
    "technologies" TEXT,
    "internal_notes" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "clients_email_key" ON "clients"("email");
CREATE INDEX IF NOT EXISTS "clients_email_idx" ON "clients"("email");
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "storage_quota_mb" INTEGER NOT NULL DEFAULT 1024;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT;

-- CLIENT TEAM MEMBERS (nouvelle)
CREATE TABLE IF NOT EXISTS "client_team_members" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "password_hash" TEXT,
    "role" VARCHAR(50) NOT NULL DEFAULT 'viewer',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "last_login" TIMESTAMP(3),
    CONSTRAINT "client_team_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "client_team_members_client_id_email_key" ON "client_team_members"("client_id", "email");
CREATE INDEX IF NOT EXISTS "client_team_members_client_id_idx" ON "client_team_members"("client_id");

-- MANDATES
CREATE TABLE IF NOT EXISTS "mandates" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "service_type" VARCHAR(100) DEFAULT 'plc-support',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE,
    "end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mandates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mandates_client_id_idx" ON "mandates"("client_id");
CREATE INDEX IF NOT EXISTS "mandates_status_idx" ON "mandates"("status");
ALTER TABLE "mandates" ADD COLUMN IF NOT EXISTS "estimated_hours" DECIMAL(6,2);
ALTER TABLE "mandates" ADD COLUMN IF NOT EXISTS "actual_hours" DECIMAL(6,2);
ALTER TABLE "mandates" ADD COLUMN IF NOT EXISTS "hourly_rate" DECIMAL(8,2);

-- TIME ENTRIES (nouvelle)
CREATE TABLE IF NOT EXISTS "time_entries" (
    "id" SERIAL NOT NULL,
    "mandate_id" INTEGER NOT NULL,
    "admin_id" INTEGER,
    "description" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_min" INTEGER,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "hourly_rate" DECIMAL(8,2),
    "invoice_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "time_entries_mandate_id_idx" ON "time_entries"("mandate_id");

-- QUOTES
CREATE TABLE IF NOT EXISTS "quotes" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "quote_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "service_type" VARCHAR(100),
    "amount_ht" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tps_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tvq_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount_ttc" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "expiry_date" DATE,
    "accepted_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "payment_plan" VARCHAR(30) DEFAULT 'split_50_50',
    "payment_pct1" INTEGER DEFAULT 50,
    "payment_pct2" INTEGER DEFAULT 50,
    "payment_conditions" TEXT,
    "client_signature_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_quote_number_key" ON "quotes"("quote_number");
CREATE INDEX IF NOT EXISTS "quotes_client_id_idx" ON "quotes"("client_id");
CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes"("status");
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "mandate_id" INTEGER;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "declined_at" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) NOT NULL DEFAULT 'CAD';
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount_code" VARCHAR(50);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(10,2) DEFAULT 0;

-- CONTRACTS
CREATE TABLE IF NOT EXISTS "contracts" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "mandate_id" INTEGER,
    "quote_id" INTEGER,
    "contract_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "file_url" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "amount_ttc" DECIMAL(10,2) DEFAULT 0,
    "hellosign_request_id" VARCHAR(255),
    "signed_at" TIMESTAMP(3),
    "client_signature_data" TEXT,
    "client_signature_ip" VARCHAR(64),
    "admin_signature_data" TEXT,
    "admin_signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "contracts_contract_number_key" ON "contracts"("contract_number");
CREATE INDEX IF NOT EXISTS "contracts_client_id_idx" ON "contracts"("client_id");
CREATE INDEX IF NOT EXISTS "contracts_status_idx" ON "contracts"("status");
CREATE INDEX IF NOT EXISTS "contracts_quote_id_idx" ON "contracts"("quote_id");
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

-- INVOICES
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "mandate_id" INTEGER,
    "quote_id" INTEGER,
    "contract_id" INTEGER,
    "invoice_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "amount_ht" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tps_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tvq_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount_ttc" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'unpaid',
    "due_date" DATE,
    "paid_at" TIMESTAMP(3),
    "payment_method" VARCHAR(50),
    "invoice_phase" VARCHAR(20),
    "phase_number" INTEGER DEFAULT 1,
    "stripe_payment_intent_id" VARCHAR(255),
    "stripe_session_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX IF NOT EXISTS "invoices_client_id_idx" ON "invoices"("client_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "invoices_due_date_idx" ON "invoices"("due_date");
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) NOT NULL DEFAULT 'CAD';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reminders_sent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "last_reminder_at" TIMESTAMP(3);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS "payments" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER,
    "client_id" INTEGER,
    "stripe_payment_intent_id" VARCHAR(255),
    "stripe_charge_id" VARCHAR(255),
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'cad',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "payment_method" VARCHAR(100),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payments_invoice_id_idx" ON "payments"("invoice_id");
CREATE INDEX IF NOT EXISTS "payments_client_id_idx" ON "payments"("client_id");

-- REFUNDS
CREATE TABLE IF NOT EXISTS "refunds" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "invoice_id" INTEGER,
    "stripe_refund_id" VARCHAR(255),
    "refund_number" VARCHAR(50) NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "tps_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tvq_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_refund_number_key" ON "refunds"("refund_number");
CREATE INDEX IF NOT EXISTS "refunds_client_id_idx" ON "refunds"("client_id");

-- DISPUTES
CREATE TABLE IF NOT EXISTS "disputes" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "invoice_id" INTEGER,
    "mandate_id" INTEGER,
    "stripe_dispute_id" VARCHAR(255),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'open',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "resolution" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS "expenses" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT 'autre',
    "amount" DECIMAL(10,2) NOT NULL,
    "tps_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tvq_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vendor" VARCHAR(255),
    "receipt_url" TEXT,
    "expense_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "expenses_expense_date_idx" ON "expenses"("expense_date");

-- TAX DECLARATIONS
CREATE TABLE IF NOT EXISTS "tax_declarations" (
    "id" SERIAL NOT NULL,
    "period_type" VARCHAR(50) NOT NULL,
    "period_label" VARCHAR(100) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_revenue_ht" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_tps" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_tvq" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_taxes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_declarations_pkey" PRIMARY KEY ("id")
);

-- DOCUMENTS
CREATE TABLE IF NOT EXISTS "documents" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "mandate_id" INTEGER,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "file_type" VARCHAR(50) DEFAULT 'pdf',
    "file_name" VARCHAR(255),
    "file_url" TEXT,
    "file_size" INTEGER,
    "uploaded_by" VARCHAR(100),
    "category" VARCHAR(100),
    "status" VARCHAR(50) DEFAULT 'disponible',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "documents_client_id_idx" ON "documents"("client_id");

-- MESSAGES
CREATE TABLE IF NOT EXISTS "messages" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "sender" VARCHAR(20) NOT NULL,
    "content" TEXT,
    "attachment_data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "channel" VARCHAR(30) NOT NULL DEFAULT 'chat',
    "request_status" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "messages_client_id_idx" ON "messages"("client_id");
CREATE INDEX IF NOT EXISTS "messages_client_id_is_read_idx" ON "messages"("client_id", "is_read");

-- CONTACT MESSAGES
CREATE TABLE IF NOT EXISTS "contact_messages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255),
    "service" VARCHAR(100),
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50);
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "plc_brand" VARCHAR(100);
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(64);
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;

-- MANDATE LOGS
CREATE TABLE IF NOT EXISTS "mandate_logs" (
    "id" SERIAL NOT NULL,
    "mandate_id" INTEGER NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_by" VARCHAR(50) NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mandate_logs_pkey" PRIMARY KEY ("id")
);

-- WORKFLOW EVENTS
CREATE TABLE IF NOT EXISTS "workflow_events" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "mandate_id" INTEGER,
    "quote_id" INTEGER,
    "contract_id" INTEGER,
    "invoice_id" INTEGER,
    "event_type" VARCHAR(100) NOT NULL,
    "event_label" VARCHAR(255),
    "triggered_by" VARCHAR(50) NOT NULL DEFAULT 'admin',
    "ws_broadcast" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "workflow_events_client_id_idx" ON "workflow_events"("client_id");
CREATE INDEX IF NOT EXISTS "workflow_events_event_type_idx" ON "workflow_events"("event_type");

-- WS CONNECTIONS
CREATE TABLE IF NOT EXISTS "ws_connections" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "role" VARCHAR(20) NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnected_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    CONSTRAINT "ws_connections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ws_connections_is_active_idx" ON "ws_connections"("is_active");

-- PAGE VIEWS
CREATE TABLE IF NOT EXISTS "page_views" (
    "id" SERIAL NOT NULL,
    "session_id" VARCHAR(64),
    "client_id" INTEGER,
    "page" VARCHAR(255) NOT NULL,
    "referrer" VARCHAR(512),
    "user_agent" VARCHAR(512),
    "ip_hash" VARCHAR(64),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "page_views_created_at_idx" ON "page_views"("created_at");
CREATE INDEX IF NOT EXISTS "page_views_session_id_idx" ON "page_views"("session_id");
CREATE INDEX IF NOT EXISTS "page_views_client_id_idx" ON "page_views"("client_id");

-- AVAILABILITY SLOTS
CREATE TABLE IF NOT EXISTS "availability_slots" (
    "id" SERIAL NOT NULL,
    "slot_date" DATE NOT NULL,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "duration_min" INTEGER NOT NULL DEFAULT 30,
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "availability_slots_slot_date_status_idx" ON "availability_slots"("slot_date", "status");

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" SERIAL NOT NULL,
    "slot_id" INTEGER,
    "client_id" INTEGER,
    "client_name" VARCHAR(255) NOT NULL,
    "client_email" VARCHAR(255) NOT NULL,
    "client_company" VARCHAR(255),
    "appointment_date" DATE NOT NULL,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "duration_min" INTEGER NOT NULL DEFAULT 30,
    "subject" TEXT,
    "notes_client" TEXT,
    "notes_admin" TEXT,
    "meeting_type" VARCHAR(20) NOT NULL DEFAULT 'video',
    "meeting_link" TEXT,
    "meeting_id" VARCHAR(255),
    "meeting_password" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    "cancelled_by" VARCHAR(20),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent_at" TIMESTAMP(3),
    "request_message_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "appointments_client_id_idx" ON "appointments"("client_id");
CREATE INDEX IF NOT EXISTS "appointments_appointment_date_status_idx" ON "appointments"("appointment_date", "status");

-- ═══════════════════════════════════════════════════════════
-- NOUVELLES TABLES (inexistantes dans l'Express)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "project_requests" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "service_type" VARCHAR(100),
    "plc_brand" VARCHAR(100),
    "urgency" "ProjectRequestUrgency" NOT NULL DEFAULT 'normal',
    "budget_range" VARCHAR(100),
    "status" "ProjectRequestStatus" NOT NULL DEFAULT 'new',
    "converted_to_mandate_id" INTEGER,
    "converted_to_quote_id" INTEGER,
    "attachments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "project_requests_client_id_idx" ON "project_requests"("client_id");
CREATE INDEX IF NOT EXISTS "project_requests_status_idx" ON "project_requests"("status");

-- SETTINGS (pièce centrale de la migration)
CREATE TABLE IF NOT EXISTS "settings" (
    "id" SERIAL NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT,
    "type" "SettingType" NOT NULL DEFAULT 'string',
    "label" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "settings_category_key_key" ON "settings"("category", "key");
CREATE INDEX IF NOT EXISTS "settings_category_idx" ON "settings"("category");

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" INTEGER,
    "changes" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_admin_id_idx" ON "audit_logs"("admin_id");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

CREATE TABLE IF NOT EXISTS "integrations" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "credentials" JSONB,
    "config" JSONB,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_provider_key" ON "integrations"("provider");

CREATE TABLE IF NOT EXISTS "outgoing_webhooks" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_fire_at" TIMESTAMP(3),
    "last_status" INTEGER,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outgoing_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "incoming_webhook_logs" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incoming_webhook_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "incoming_webhook_logs_provider_received_at_idx" ON "incoming_webhook_logs"("provider", "received_at");

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" SERIAL NOT NULL,
    "recipient_type" VARCHAR(20) NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "icon" VARCHAR(50),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notifications_recipient_type_recipient_id_is_read_idx" ON "notifications"("recipient_type", "recipient_id", "is_read");

CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "subject" VARCHAR(255) NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "variables" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_key_locale_key" ON "email_templates"("key", "locale");

CREATE TABLE IF NOT EXISTS "pdf_templates" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "content" JSONB NOT NULL,
    "variables" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pdf_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pdf_templates_key_locale_key" ON "pdf_templates"("key", "locale");

CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_yearly" DECIMAL(10,2),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CAD',
    "features" JSONB,
    "max_users" INTEGER,
    "max_storage_mb" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stripe_price_id" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "stripe_subscription_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "subscriptions_client_id_idx" ON "subscriptions"("client_id");

CREATE TABLE IF NOT EXISTS "service_catalog" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(10,2) NOT NULL,
    "price_unit" VARCHAR(20) NOT NULL DEFAULT 'hour',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CAD',
    "category" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_catalog_key_key" ON "service_catalog"("key");

CREATE TABLE IF NOT EXISTS "discount_codes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "discount_type" VARCHAR(20) NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "max_uses" INTEGER,
    "current_uses" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_code_key" ON "discount_codes"("code");

CREATE TABLE IF NOT EXISTS "blog_posts" (
    "id" SERIAL NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "slug" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "excerpt" TEXT,
    "content_html" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "author_id" INTEGER,
    "tags" TEXT[],
    "category" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_locale_key" ON "blog_posts"("slug", "locale");
CREATE INDEX IF NOT EXISTS "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at");

CREATE TABLE IF NOT EXISTS "faq_items" (
    "id" SERIAL NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "faq_items_locale_is_published_idx" ON "faq_items"("locale", "is_published");

CREATE TABLE IF NOT EXISTS "testimonials" (
    "id" SERIAL NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "client_company" VARCHAR(255),
    "client_title" VARCHAR(255),
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "avatar_url" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "maintenance_windows" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "affects_portal" BOOLEAN NOT NULL DEFAULT true,
    "affects_admin" BOOLEAN NOT NULL DEFAULT false,
    "affects_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_windows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "maintenance_windows_starts_at_ends_at_idx" ON "maintenance_windows"("starts_at", "ends_at");

CREATE TABLE IF NOT EXISTS "incident_reports" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'minor',
    "status" VARCHAR(50) NOT NULL DEFAULT 'investigating',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════
-- FOREIGN KEYS (DO block pour idempotence)
-- Seulement pour les NOUVELLES tables créées ici.
-- Les FKs des tables existantes (mandates, quotes, contracts, invoices,
-- payments, refunds, disputes, documents, messages, etc.) existent déjà
-- via le schema.sql de l'Express et ne sont PAS recréées.
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "client_team_members" ADD CONSTRAINT "client_team_members_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "project_requests" ADD CONSTRAINT "project_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
