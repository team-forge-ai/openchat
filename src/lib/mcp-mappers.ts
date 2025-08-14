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
  return { transport: 'http', ...base }
}

export function configToForm(config: McpServerConfig): McpServerFormValues {
  if (config.transport === 'stdio') {
    return {
      transport: 'stdio',
      name: config.name,
      description: config.description ?? undefined,
      enabled: config.enabled,
      command: config.command,
      args: config.args ?? [],
      cwd: config.cwd ?? undefined,
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
