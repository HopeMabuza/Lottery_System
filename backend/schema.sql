-- Run this once to set up the database tables
-- psql $DATABASE_URL -f schema.sql

-- One row per lottery round
CREATE TABLE IF NOT EXISTS rounds (
    id              BIGINT PRIMARY KEY,
    active          BOOLEAN,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    pot             NUMERIC,
    winning_numbers INT[],
    draw_requested  BOOLEAN DEFAULT FALSE,
    drawn           BOOLEAN DEFAULT FALSE,
    owner_fee       NUMERIC,
    rollover_added  NUMERIC,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- One row per ticket purchased
CREATE TABLE IF NOT EXISTS tickets (
    id              BIGSERIAL PRIMARY KEY,
    round_id        BIGINT REFERENCES rounds(id),
    ticket_index    BIGINT,
    player_address  TEXT,
    numbers         INT[],
    matched_count   INT DEFAULT 0,
    reward          NUMERIC DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- One row per reward withdrawal
CREATE TABLE IF NOT EXISTS withdrawals (
    id              BIGSERIAL PRIMARY KEY,
    player_address  TEXT,
    amount          NUMERIC,
    tx_hash         TEXT UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- One row per event received — useful for debugging and replaying
CREATE TABLE IF NOT EXISTS events_log (
    id              BIGSERIAL PRIMARY KEY,
    event_name      TEXT,
    block_number    BIGINT,
    tx_hash         TEXT,
    data            JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
