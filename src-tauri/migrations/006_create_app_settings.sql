-- Create structured application settings table
-- We expect exactly one row identified by id=1

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  system_prompt TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed a single row if the table is empty
INSERT INTO app_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
