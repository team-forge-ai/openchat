import type { McpServerRow } from '@/types'
import type { McpServerConfig } from '@/types/mcp'
import type { McpServerFormValues } from '@/types/mcp-form'

export function rowToForm(row: McpServerRow): McpServerFormValues {
  if (row.transport === 'stdio') {
    return {
      transport: 'stdio',
      name: row.name,
      description: row.description ?? undefined,
      enabled: !!row.enabled,
      command: row.command ?? '',
      args: parseStringArray(row.args),
      cwd: row.cwd ?? undefined,
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
  return row.transport === 'websocket'
    ? { transport: 'websocket', ...base }
    : { transport: 'http', ...base }
}

export function formToConfig(values: McpServerFormValues): McpServerConfig {
  if (values.transport === 'stdio') {
    return {
      transport: 'stdio',
      name: values.name,
      description: values.description ?? undefined,
      enabled: values.enabled,
      command: values.command,
      args: values.args ?? [],
      cwd: values.cwd ?? undefined,
      env: kvArrayToRecord(values.env),
    }
  }
  return {
    transport: values.transport,
    name: values.name,
    description: values.description ?? undefined,
    enabled: values.enabled,
    url: values.url,
    headers: kvArrayToRecord(values.headers),
    auth: values.auth ?? undefined,
    heartbeatSec: values.heartbeatSec ?? undefined,
  }
}

export function formToDbInsert(values: McpServerFormValues) {
  const base = {
    name: values.name,
    description: values.description ?? null,
    enabled: values.enabled ? 1 : 0,
    transport: values.transport,
  }
  if (values.transport === 'stdio') {
    return {
      ...base,
      command: values.command,
      args: JSON.stringify(values.args ?? []),
      env: JSON.stringify(kvArrayToRecord(values.env)),
      cwd: values.cwd ?? null,
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
    const arr = JSON.parse(input)
    return Array.isArray(arr) ? arr.filter((v) => typeof v === 'string') : []
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
    const obj = JSON.parse(input) as Record<string, string>
    return Object.entries(obj).map(([key, value]) => ({ key, value }))
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
