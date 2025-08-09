-- Create FTS5 virtual table for messages content with external content
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  conversation_id UNINDEXED,
  content='messages',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

-- Keep FTS index in sync with base table
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content, conversation_id)
  VALUES (new.id, new.content, new.conversation_id);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content, conversation_id)
  VALUES('delete', old.id, old.content, old.conversation_id);
  INSERT INTO messages_fts(rowid, content, conversation_id)
  VALUES (new.id, new.content, new.conversation_id);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content, conversation_id)
  VALUES('delete', old.id, old.content, old.conversation_id);
END;

-- Build the initial index from existing content
INSERT INTO messages_fts(messages_fts) VALUES('rebuild');


