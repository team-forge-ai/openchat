import type { McpServerRow } from '@/types'
import type { McpServerConfig } from '@/types/mcp'
import type { McpServerFormValues } from '@/types/mcp-form'

/**
 * Maps an `mcp_servers` DB row to form values for the settings UI.
 *
 * @param row The database row.
 * @returns Form values suitable for `McpServerForm`.
 */
export function rowToForm(row: McpServerRow): McpServerFormValues {
  if (row.transport === 'stdio') {
    const command = row.command ?? ''
    const args = parseStringArray(row.args)
    const commandLine =
      args.length > 0 ? `${command} ${args.join(' ')}` : command

    return {
      transport: 'stdio',
      name: row.name,
      description: row.description ?? undefined,
      enabled: !!row.enabled,
      commandLine,
      env: parseStringRecord(row.env),
    }
  }
  const headers = parseStringRecord(row.headers)
  const base = {
    name: row.name,
    description: row.description ?? undefined,
    enabled: !!row.enabled,
    url: row.url ?? '',
    headers,
    auth: row.auth ?? undefined,
    heartbeatSec: row.heartbeat_sec ?? undefined,
  }
  return { transport: 'http', ...base }
}

/**
 * Maps a runtime `McpServerConfig` to form values for editing.
 *
 * @param config The in-memory server configuration.
 * @returns Form values suitable for `McpServerForm`.
 */
export function configToForm(config: McpServerConfig): McpServerFormValues {
  if (config.transport === 'stdio') {
    const args = config.args ?? []
    const commandLine =
      args.length > 0 ? `${config.command} ${args.join(' ')}` : config.command

    return {
      transport: 'stdio',
      name: config.name,
      description: config.description ?? undefined,
      enabled: config.enabled,
      commandLine,
      env: Object.entries(config.env ?? {}).map(([key, value]) => ({
        key,
        value: String(value ?? ''),
      })),
    }
  }
  return {
    transport: 'http',
    name: config.name,
    description: config.description ?? undefined,
    enabled: config.enabled,
    url: config.url,
    headers: Object.entries(config.headers ?? {}).map(([key, value]) => ({
      key,
      value: String(value ?? ''),
    })),
    auth: config.auth ?? undefined,
    heartbeatSec: config.heartbeatSec ?? undefined,
  }
}

/**
 * Converts validated form values into a runtime `McpServerConfig`.
 *
 * @param values The form values from the settings UI.
 * @returns A normalized `McpServerConfig` object.
 */
export function formToConfig(values: McpServerFormValues): McpServerConfig {
  if (values.transport === 'stdio') {
    const { command, args } = parseCommandLine(values.commandLine)

    return {
      transport: 'stdio',
      name: values.name,
      description: values.description ?? undefined,
      enabled: values.enabled,
      command,
      args,
      cwd: null,
      env: kvArrayToRecord(values.env),
    }
  }
  return {
    transport: 'http',
    name: values.name,
    description: values.description ?? undefined,
    enabled: values.enabled,
    url: values.url,
    headers: kvArrayToRecord(values.headers),
    auth: values.auth ?? undefined,
    heartbeatSec: values.heartbeatSec ?? undefined,
  }
}

/**
 * Converts form values into an insertable payload for `mcp_servers`.
 * Serializes arrays/records to JSON for storage in text columns.
 *
 * @param values The form values.
 * @returns Attributes suitable for inserting into `mcp_servers`.
 */
export function formToDbInsert(values: McpServerFormValues) {
  const base = {
    name: values.name,
    description: values.description ?? null,
    enabled: values.enabled ? 1 : 0,
    transport: values.transport,
  }
  if (values.transport === 'stdio') {
    const { command, args } = parseCommandLine(values.commandLine)

    return {
      ...base,
      command,
      args: JSON.stringify(args),
      env: JSON.stringify(kvArrayToRecord(values.env)),
      cwd: null,
    }
  }
  return {
    ...base,
    url: values.url,
    headers: JSON.stringify(kvArrayToRecord(values.headers)),
    auth: values.auth ?? null,
    heartbeat_sec: values.heartbeatSec ?? null,
  }
}

function parseStringArray(input: string | null): string[] {
  if (!input) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(input)
    if (Array.isArray(parsed)) {
      const onlyStrings: string[] = []
      for (const value of parsed) {
        if (typeof value === 'string') {
          onlyStrings.push(value)
        }
      }
      return onlyStrings
    }
    return []
  } catch {
    return []
  }
}

function parseStringRecord(
  input: string | null,
): { key: string; value: string }[] {
  if (!input) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(input)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>)
      const result: { key: string; value: string }[] = []
      for (const [key, value] of entries) {
        if (typeof value === 'string') {
          result.push({ key, value })
        }
      }
      return result
    }
    return []
  } catch {
    return []
  }
}

function kvArrayToRecord(
  kv: { key: string; value: string }[] | undefined,
): Record<string, string> {
  const r: Record<string, string> = {}
  for (const item of kv ?? []) {
    if (item.key) {
      r[item.key] = item.value ?? ''
    }
  }
  return r
}

/**
 * Parses a command line string into command and args.
 * Handles basic shell-style parsing with quoted arguments.
 *
 * @param commandLine The command line string to parse.
 * @returns Object with command and args array.
 */
function parseCommandLine(commandLine: string): {
  command: string
  args: string[]
} {
  const trimmed = commandLine.trim()
  if (!trimmed) {
    return { command: '', args: [] }
  }

  // Simple parsing: split on spaces but respect quoted strings
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (const char of trimmed) {
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true
      quoteChar = char
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false
      quoteChar = ''
    } else if (!inQuotes && char === ' ') {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    parts.push(current)
  }

  const [command = '', ...args] = parts
  return { command, args }
}
