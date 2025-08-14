import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useMcpServers } from '@/hooks/use-mcp-servers'
import { mcpCheckServer } from '@/lib/mcp-bridge'
import { formToConfig, formToDbInsert, rowToForm } from '@/lib/mcp-mappers'
import type { McpServerRow } from '@/types'
import type { McpServerConfig } from '@/types/mcp'
import type { McpServerFormValues } from '@/types/mcp-form'

import { McpServerFormDialog } from './mcp-server-form'

type EditConfig = McpServerConfig & { id?: number }

export function McpServersSettings() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EditConfig | null>(null)
  const [search, setSearch] = useState('')
  const { servers, isLoading, create, update, remove, setEnabled } =
    useMcpServers(search)

  const handleAdd = () => {
    setEditing(null)
    setOpen(true)
  }

  const handleEdit = (row: McpServerRow) => {
    const formValues = rowToForm(row)
    setEditing({ ...formToConfig(formValues), id: row.id })
    setOpen(true)
  }

  const handleSave = async (config: McpServerConfig) => {
    if (editing && typeof editing.id === 'number') {
      await update.mutateAsync({
        id: editing.id,
        attrs: formToDbInsert(formValuesFromConfig(config)),
      })
    } else {
      await create.mutateAsync(formToDbInsert(formValuesFromConfig(config)))
    }
  }

  const handleTest = async (
    config: McpServerConfig,
  ): Promise<{ ok: boolean; message: string }> => {
    const result = await mcpCheckServer(config)
    if (result.ok) {
      return { ok: true, message: `${result.toolsCount ?? 0} tools` }
    }
    return { ok: false, message: result.error || 'Unknown error' }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search servers"
          className="max-w-xs"
        />
        <div className="flex-1" />
        <Button onClick={handleAdd}>Add Server</Button>
      </div>
      <Separator />

      <div className="space-y-2">
        {servers.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 p-3 rounded-md border"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{s.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.transport} {s.description ? `• ${s.description}` : ''}
              </div>
            </div>
            <label className="text-sm inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!s.enabled}
                onChange={(e) =>
                  setEnabled.mutate({ id: s.id, enabled: e.target.checked })
                }
              />
              Enabled
            </label>
            <Button variant="outline" onClick={() => handleEdit(s)}>
              Edit
            </Button>
            <Button variant="destructive" onClick={() => remove.mutate(s.id)}>
              Delete
            </Button>
          </div>
        ))}
        {servers.length === 0 && !isLoading && (
          <div className="text-sm text-muted-foreground">No servers found.</div>
        )}
      </div>

      <McpServerFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing ?? undefined}
        onSave={handleSave}
        onTest={handleTest}
      />
    </div>
  )
}

function formValuesFromConfig(config: McpServerConfig): McpServerFormValues {
  if (config.transport === 'stdio') {
    return {
      transport: 'stdio',
      name: config.name,
      description: config.description,
      enabled: config.enabled,
      command: config.command,
      args: config.args ?? [],
      cwd: config.cwd,
      env: Object.entries(config.env ?? {}).map(([key, value]) => ({
        key,
        value,
      })),
    }
  }
  return {
    transport: 'http',
    name: config.name,
    description: config.description,
    enabled: config.enabled,
    url: config.url,
    headers: Object.entries(config.headers ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
    auth: config.auth,
    heartbeatSec: config.heartbeatSec ?? undefined,
  }
}
