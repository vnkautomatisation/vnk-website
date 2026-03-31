-- ════════════════════════════════════════════════════════════════
-- VNK Automatisation — Système de calendrier custom
-- À exécuter dans Railway Data Query
-- ════════════════════════════════════════════════════════════════

-- Créneaux de disponibilité définis par l'admin
CREATE TABLE IF NOT EXISTS availability_slots (
    id              SERIAL PRIMARY KEY,
    slot_date       DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    duration_min    INTEGER NOT NULL DEFAULT 30,
    status          VARCHAR(20) NOT NULL DEFAULT 'available',
    -- available | booked | blocked | cancelled
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- RDV confirmés
CREATE TABLE IF NOT EXISTS appointments (
    id              SERIAL PRIMARY KEY,
    slot_id         INTEGER REFERENCES availability_slots(id) ON DELETE SET NULL,
    client_id       INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    -- Infos du client (dupliquées pour historique même si client supprimé)
    client_name     VARCHAR(255) NOT NULL,
    client_email    VARCHAR(255) NOT NULL,
    client_company  VARCHAR(255),
    -- Détails du RDV
    appointment_date DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    duration_min    INTEGER NOT NULL DEFAULT 30,
    subject         TEXT,           -- Objet du RDV (ex: "Demande Support PLC")
    notes_client    TEXT,           -- Notes du client
    notes_admin     TEXT,           -- Notes internes VNK
    -- Réunion virtuelle
    meeting_type    VARCHAR(20) DEFAULT 'video',  -- video | phone | onsite
    meeting_link    TEXT,           -- Lien Teams/Zoom/Meet
    meeting_id      VARCHAR(255),   -- ID de réunion
    meeting_password VARCHAR(255),
    -- Statut
    status          VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    -- confirmed | cancelled | completed | no_show
    cancelled_by    VARCHAR(20),    -- client | admin
    cancelled_at    TIMESTAMP,
    cancellation_reason TEXT,
    -- Rappels
    reminder_sent   BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP,
    -- Lien avec demande de projet
    request_message_id INTEGER,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slots_date       ON availability_slots(slot_date, status);
CREATE INDEX IF NOT EXISTS idx_appts_client     ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appts_date       ON appointments(appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appts_slot       ON appointments(slot_id);