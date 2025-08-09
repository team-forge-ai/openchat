-- Create FTS5 virtual table for conversation titles with external content
CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
  title,
  content='conversations',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

-- Keep FTS index in sync with base table
CREATE TRIGGER IF NOT EXISTS conversations_ai AFTER INSERT ON conversations BEGIN
  INSERT INTO conversations_fts(rowid, title) VALUES (new.id, new.title);
END;

CREATE TRIGGER IF NOT EXISTS conversations_au AFTER UPDATE ON conversations BEGIN
  INSERT INTO conversations_fts(conversations_fts, rowid, title)
  VALUES('delete', old.id, old.title);
  INSERT INTO conversations_fts(rowid, title)
  VALUES (new.id, new.title);
END;

CREATE TRIGGER IF NOT EXISTS conversations_ad AFTER DELETE ON conversations BEGIN
  INSERT INTO conversations_fts(conversations_fts, rowid, title)
  VALUES('delete', old.id, old.title);
END;

-- Build the initial index from existing content
INSERT INTO conversations_fts(conversations_fts) VALUES('rebuild');


