import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formToConfig } from '@/lib/mcp-mappers'
import type { McpServerConfig } from '@/types/mcp'
import { McpServerFormSchema, type McpServerFormValues } from '@/types/mcp-form'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Partial<McpServerConfig>
  onSave: (config: McpServerConfig) => Promise<void>
  onTest: (config: McpServerConfig) => Promise<{ ok: boolean; message: string }>
}

type Transport = 'stdio' | 'websocket' | 'http'

export function McpServerFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onTest,
}: Props) {
  const defaultValues: McpServerFormValues = useMemo(() => {
    if (initial?.transport === 'stdio') {
      return {
        transport: 'stdio',
        name: initial.name ?? '',
        description: initial.description ?? undefined,
        enabled: initial.enabled ?? false,
        command: initial.command ?? '',
        args: Array.isArray(initial.args) ? initial.args : [],
        cwd: initial.cwd ?? undefined,
        env: [],
      }
    }
    if (initial?.transport === 'websocket') {
      return {
        transport: 'websocket',
        name: initial.name ?? '',
        description: initial.description ?? undefined,
        enabled: initial.enabled ?? false,
        url: initial.url ?? '',
        headers: [],
        auth: undefined,
        heartbeatSec: undefined,
      }
    }
    return {
      transport: initial?.transport === 'http' ? 'http' : 'stdio',
      name: initial?.name ?? '',
      description: initial?.description ?? undefined,
      enabled: initial?.enabled ?? false,
      ...(initial?.transport === 'http'
        ? {
            url: initial.url ?? '',
            headers: [],
            auth: undefined,
            heartbeatSec: undefined,
          }
        : {
            command: '',
            args: [],
            cwd: undefined,
            env: [],
          }),
    } as McpServerFormValues
  }, [initial])

  const form = useForm<z.input<typeof McpServerFormSchema>>({
    resolver: zodResolver(McpServerFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  const transport = form.watch('transport')
  const [argsText, setArgsText] = useState<string>(
    Array.isArray(defaultValues.args) ? defaultValues.args.join(' ') : '',
  )

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const formWatch = form.watch()

  useEffect(() => {
    setTestResult('')
  }, [formWatch])

  const buildConfig = (): McpServerConfig => {
    const v = form.getValues()
    if (v.transport === 'stdio') {
      return {
        transport: 'stdio',
        name: v.name,
        description: v.description ?? undefined,
        enabled: v.enabled ?? false,
        command: v.command,
        args: argsText.trim() ? argsText.trim().split(/\s+/) : [],
        cwd: v.cwd ?? undefined,
      }
    }
    return {
      transport: v.transport,
      name: v.name,
      description: v.description ?? undefined,
      enabled: v.enabled ?? false,
      url: v.url,
    } as McpServerConfig
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await onTest(buildConfig())
      setTestResult(
        res.ok
          ? `OK${res.message ? `: ${res.message}` : ''}`
          : `Failed: ${res.message}`,
      )
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (!(await form.trigger())) {
        setSaving(false)
        return
      }
      await onSave(buildConfig())
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial?.name ? 'Edit MCP Server' : 'Add MCP Server'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="mb-1">Name</div>
              <Input {...form.register('name')} />
              {(form.formState.errors as any).name && (
                <div className="text-xs text-destructive mt-1">
                  {(form.formState.errors as any).name.message}
                </div>
              )}
            </label>
            <label className="text-sm">
              <div className="mb-1">Transport</div>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={transport}
                onChange={(e) =>
                  form.setValue('transport', e.target.value as Transport)
                }
              >
                <option value="stdio">stdio</option>
                <option value="websocket">websocket</option>
                <option value="http">http</option>
              </select>
            </label>
          </div>

          <label className="text-sm block">
            <div className="mb-1">Description</div>
            <Input {...form.register('description')} />
          </label>

          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" {...form.register('enabled')} />
            Enabled
          </label>

          {transport === 'stdio' ? (
            <div className="space-y-3">
              <label className="text-sm block">
                <div className="mb-1">Command</div>
                <Input
                  {...form.register('command')}
                  placeholder="/usr/bin/node my-mcp-server.js"
                />
                
              </label>
              <label className="text-sm block">
                <div className="mb-1">Args (space separated)</div>
                <Input
                  value={argsText}
                  onChange={(e) => {
                    const v = e.target.value
                    setArgsText(v)
                    pass
                  }}
                  placeholder="--flag value"
                />
              </label>
              <label className="text-sm block">
                <div className="mb-1">Working directory</div>
                <Input {...form.register('cwd')} placeholder="/path/to/dir" />
              </label>
            </div>
          ) : (
            <label className="text-sm block">
              <div className="mb-1">URL</div>
              <Input
                {...form.register('url')}
                placeholder="wss://... or https://..."
              />
              
            </label>
          )}

          {testResult && (
            <div className="text-sm text-muted-foreground">{testResult}</div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? 'Testing…' : 'Test'}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !(form.watch('name') || '').toString().trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
