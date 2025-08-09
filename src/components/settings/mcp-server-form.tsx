import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

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

type Transport = 'stdio' | 'http'

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
        env: Object.entries(initial.env ?? {}).map(([key, value]) => ({
          key,
          value: String(value ?? ''),
        })),
      }
    }
    // websocket transport removed
    // Default to stdio when not editing or not websocket
    return {
      transport: 'stdio',
      name: initial?.name ?? '',
      description: initial?.description ?? undefined,
      enabled: initial?.enabled ?? false,
      command: '',
      args: [],
      cwd: undefined,
      env: [],
    }
  }, [initial])

  const form = useForm<z.input<typeof McpServerFormSchema>>({
    resolver: zodResolver(McpServerFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  const transport = form.watch('transport')
  const [argsText, setArgsText] = useState<string>(
    defaultValues.transport === 'stdio' && Array.isArray(defaultValues.args)
      ? defaultValues.args.join(' ')
      : '',
  )

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [envRows, setEnvRows] = useState<{ key: string; value: string }[]>(
    defaultValues.transport === 'stdio' && 'env' in defaultValues
      ? defaultValues.env
      : [],
  )
  const [headerRows, setHeaderRows] = useState<
    { key: string; value: string }[]
  >(
    defaultValues.transport !== 'stdio' && 'headers' in defaultValues
      ? (
          defaultValues as Extract<
            McpServerFormValues,
            { transport: 'websocket' | 'http' }
          >
        ).headers
      : [],
  )

  const formWatch = form.watch()

  useEffect(() => {
    setTestResult('')
  }, [formWatch])

  const buildConfig = (): McpServerConfig => {
    const v = form.getValues()
    if (v.transport === 'stdio') {
      const nextArgs = argsText.trim() ? argsText.trim().split(/\s+/) : []
      const cfg = formToConfig({
        ...(v as Extract<McpServerFormValues, { transport: 'stdio' }>),
        args: nextArgs,
        env: envRows,
      })
      return cfg
    }
    const cfg = formToConfig({
      ...(v as Extract<
        McpServerFormValues,
        { transport: 'websocket' | 'http' }
      >),
      headers: headerRows,
    })
    return cfg
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
              {form.formState.errors.name?.message && (
                <div className="text-xs text-destructive mt-1">
                  {form.formState.errors.name?.message}
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
                {(function () {
                  const draft = {
                    ...form.getValues(),
                    transport: 'stdio' as const,
                    args: argsText.trim() ? argsText.trim().split(/\s+/) : [],
                    env: envRows,
                  }
                  const parsed = McpServerFormSchema.safeParse(draft)
                  if (parsed.success) {
                    return null
                  }
                  const err = parsed.error.issues.find(
                    (i) => i.path.length === 1 && i.path[0] === 'command',
                  )
                  return err ? (
                    <div className="text-xs text-destructive mt-1">
                      {err.message}
                    </div>
                  ) : null
                })()}
              </label>
              <label className="text-sm block">
                <div className="mb-1">Args (space separated)</div>
                <Input
                  value={argsText}
                  onChange={(e) => {
                    const v = e.target.value
                    setArgsText(v)
                    const arr = v.trim() ? v.trim().split(/\s+/) : []
                    form.setValue('args', arr, {
                      shouldDirty: true,
                      shouldValidate: false,
                    })
                  }}
                  placeholder="--flag value"
                />
              </label>
              <label className="text-sm block">
                <div className="mb-1">Working directory</div>
                <Input {...form.register('cwd')} placeholder="/path/to/dir" />
              </label>

              {/* ENV key/values */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Environment variables</div>
                <div className="space-y-2">
                  {envRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-7 gap-2 items-center"
                    >
                      <Input
                        className="col-span-3"
                        value={row.key}
                        onChange={(e) => {
                          const next = [...envRows]
                          next[idx] = { ...next[idx], key: e.target.value }
                          setEnvRows(next)
                        }}
                        placeholder="KEY"
                      />
                      <Input
                        className="col-span-3"
                        value={row.value}
                        onChange={(e) => {
                          const next = [...envRows]
                          next[idx] = { ...next[idx], value: e.target.value }
                          setEnvRows(next)
                        }}
                        placeholder="value"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const next = [...envRows]
                          next.splice(idx, 1)
                          setEnvRows(next)
                        }}
                      >
                        Remove
                      </Button>
                      {/* Inline zod errors for this row */}
                      {(function () {
                        const draft = {
                          ...form.getValues(),
                          transport: 'stdio' as const,
                          args: argsText.trim()
                            ? argsText.trim().split(/\s+/)
                            : [],
                          env: envRows,
                        }
                        const parsed = McpServerFormSchema.safeParse(draft)
                        const issues = parsed.success ? [] : parsed.error.issues
                        const keyErr = issues.find(
                          (i) =>
                            i.path.length === 3 &&
                            i.path[0] === 'env' &&
                            i.path[1] === idx &&
                            i.path[2] === 'key',
                        )
                        const valErr = issues.find(
                          (i) =>
                            i.path.length === 3 &&
                            i.path[0] === 'env' &&
                            i.path[1] === idx &&
                            i.path[2] === 'value',
                        )
                        return (
                          <div className="col-span-7 grid grid-cols-6 gap-2 -mt-1">
                            <div className="col-span-3 text-xs text-destructive">
                              {keyErr?.message}
                            </div>
                            <div className="col-span-3 text-xs text-destructive">
                              {valErr?.message}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setEnvRows([...envRows, { key: '', value: '' }])
                    }
                  >
                    Add variable
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm block">
                <div className="mb-1">URL</div>
                <Input
                  {...form.register('url')}
                  placeholder="wss://... or https://..."
                />
                {(function () {
                  const draft = {
                    ...form.getValues(),
                    headers: headerRows,
                  }
                  const parsed = McpServerFormSchema.safeParse(draft)
                  if (parsed.success) {
                    return null
                  }
                  const err = parsed.error.issues.find(
                    (i) => i.path.length === 1 && i.path[0] === 'url',
                  )
                  return err ? (
                    <div className="text-xs text-destructive mt-1">
                      {err.message}
                    </div>
                  ) : null
                })()}
              </label>

              {/* Headers key/values */}
              <div className="space-y-2">
                <div className="text-sm font-medium">HTTP headers</div>
                <div className="space-y-2">
                  {headerRows.map(
                    (row: { key: string; value: string }, idx: number) => (
                      <div
                        key={idx}
                        className="grid grid-cols-7 gap-2 items-center"
                      >
                        <Input
                          className="col-span-3"
                          value={row.key}
                          onChange={(e) => {
                            const next = [...headerRows]
                            next[idx] = { ...next[idx], key: e.target.value }
                            setHeaderRows(next)
                          }}
                          placeholder="Header-Name"
                        />
                        <Input
                          className="col-span-3"
                          value={row.value}
                          onChange={(e) => {
                            const next = [...headerRows]
                            next[idx] = { ...next[idx], value: e.target.value }
                            setHeaderRows(next)
                          }}
                          placeholder="value"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const next = [...headerRows]
                            next.splice(idx, 1)
                            setHeaderRows(next)
                          }}
                        >
                          Remove
                        </Button>
                        {(function () {
                          const draft = {
                            ...form.getValues(),
                            headers: headerRows,
                          }
                          const parsed = McpServerFormSchema.safeParse(draft)
                          const issues = parsed.success
                            ? []
                            : parsed.error.issues
                          const keyErr = issues.find(
                            (i) =>
                              i.path.length === 3 &&
                              i.path[0] === 'headers' &&
                              i.path[1] === idx &&
                              i.path[2] === 'key',
                          )
                          const valErr = issues.find(
                            (i) =>
                              i.path.length === 3 &&
                              i.path[0] === 'headers' &&
                              i.path[1] === idx &&
                              i.path[2] === 'value',
                          )
                          return (
                            <div className="col-span-7 grid grid-cols-6 gap-2 -mt-1">
                              <div className="col-span-3 text-xs text-destructive">
                                {keyErr?.message}
                              </div>
                              <div className="col-span-3 text-xs text-destructive">
                                {valErr?.message}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setHeaderRows([...headerRows, { key: '', value: '' }])
                    }
                  >
                    Add header
                  </Button>
                </div>
              </div>
            </div>
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
            onClick={async () => {
              // If previously tested and failed while enabled, prompt to save disabled
              const enabledNow = !!form.getValues().enabled
              if (testResult.startsWith('Failed') && enabledNow) {
                const confirmDisable = window.confirm(
                  'Test failed. Save disabled?',
                )
                if (!confirmDisable) {
                  return
                }
                form.setValue('enabled', false, { shouldDirty: true })
              }
              await handleSave()
            }}
            disabled={saving || !(form.watch('name') || '').toString().trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
