-- Add a status column to messages with default 'complete'
ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'complete';


