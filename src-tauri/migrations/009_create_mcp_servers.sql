-- Create table for MCP server configurations
CREATE TABLE IF NOT EXISTS mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  transport TEXT NOT NULL CHECK (transport IN ('stdio','websocket','http')),

  -- stdio fields
  command TEXT,
  args TEXT,           -- JSON array string
  env TEXT,            -- JSON object string
  cwd TEXT,

  -- network transports
  url TEXT,
  headers TEXT,        -- JSON object string
  auth TEXT,
  heartbeat_sec INTEGER,

  -- timeouts (ms)
  connect_timeout_ms INTEGER,
  list_tools_timeout_ms INTEGER,

  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers (enabled);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers (name);


