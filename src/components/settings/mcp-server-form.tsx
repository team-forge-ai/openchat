import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import type { FieldErrors } from 'react-hook-form'
import { useFieldArray, useForm } from 'react-hook-form'
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
import { Switch } from '@/components/ui/switch'
import { configToForm, formToConfig } from '@/lib/mcp-mappers'
import type { McpCheckResult, McpServerConfig } from '@/types/mcp'
import { McpServerFormSchema, type McpServerFormValues } from '@/types/mcp-form'

import { McpTestResult } from './mcp-test-result'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Partial<McpServerConfig>
  onSave: (config: McpServerConfig) => Promise<void>
  onTest: (config: McpServerConfig) => Promise<McpCheckResult>
}

type Transport = 'stdio' | 'http'
type StdioValues = Extract<McpServerFormValues, { transport: 'stdio' }>
type HttpValues = Extract<McpServerFormValues, { transport: 'http' }>

export function McpServerFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onTest,
}: Props) {
  const defaultValues: McpServerFormValues = useMemo(() => {
    if (initial && 'transport' in initial) {
      return configToForm(initial as McpServerConfig)
    }
    // Default to stdio when not editing
    return {
      transport: 'stdio',
      name: initial?.name ?? '',
      description: initial?.description ?? undefined,
      enabled: initial?.enabled ?? true,
      commandLine: '',
      env: [],
    }
  }, [initial])

  const form = useForm<z.input<typeof McpServerFormSchema>>({
    resolver: zodResolver(McpServerFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  const envFieldArray = useFieldArray({
    control: form.control,
    name: 'env',
  })

  const headerFieldArray = useFieldArray({
    control: form.control,
    name: 'headers',
  })

  useEffect(() => {
    if (open) {
      form.reset(defaultValues)
      setTestResult(null)
    }
  }, [open, defaultValues, form])

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<McpCheckResult | null>(null)
  const [saving, setSaving] = useState(false)

  const transport = form.watch('transport')

  const errors = form.formState.errors
  const stdioErrors = errors as FieldErrors<StdioValues>
  const httpErrors = errors as FieldErrors<HttpValues>

  const buildConfig = (): McpServerConfig => {
    const values = form.getValues()
    if (values.transport === 'stdio') {
      const config: Extract<McpServerFormValues, { transport: 'stdio' }> = {
        transport: 'stdio',
        name: values.name,
        description: values.description,
        enabled: !!values.enabled,
        commandLine: values.commandLine || '',
        env: values.env || [],
      }
      return formToConfig(config)
    } else {
      const config: Extract<McpServerFormValues, { transport: 'http' }> = {
        transport: 'http',
        name: values.name,
        description: values.description,
        enabled: !!values.enabled,
        url: values.url || '',
        headers: values.headers || [],
        auth: values.auth,
        heartbeatSec: values.heartbeatSec,
      }
      return formToConfig(config)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await onTest(buildConfig())
      setTestResult(result)
    } catch (error) {
      console.error('Error testing MCP server', error)
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
              {errors.name?.message && (
                <div className="text-xs text-destructive mt-1">
                  {errors.name?.message}
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

          {transport === 'stdio' ? (
            <div className="space-y-3">
              <label className="text-sm block">
                <div className="mb-1">Command Line</div>
                <Input
                  {...form.register('commandLine')}
                  placeholder="/usr/bin/node my-mcp-server.js --flag value"
                />
                {transport === 'stdio' && stdioErrors.commandLine?.message && (
                  <div className="text-xs text-destructive mt-1">
                    {stdioErrors.commandLine?.message}
                  </div>
                )}
              </label>

              {/* ENV key/values */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Environment variables</div>
                <div className="space-y-2">
                  {envFieldArray.fields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-7 gap-2 items-center"
                    >
                      <Input
                        className="col-span-3"
                        {...form.register(`env.${idx}.key`)}
                        placeholder="KEY"
                      />
                      <Input
                        className="col-span-3"
                        {...form.register(`env.${idx}.value`)}
                        placeholder="value"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => envFieldArray.remove(idx)}
                      >
                        Remove
                      </Button>
                      <div className="col-span-7 grid grid-cols-6 gap-2 -mt-1">
                        <div className="col-span-3 text-xs text-destructive">
                          {transport === 'stdio' &&
                            stdioErrors.env?.[idx]?.key?.message}
                        </div>
                        <div className="col-span-3 text-xs text-destructive">
                          {transport === 'stdio' &&
                            stdioErrors.env?.[idx]?.value?.message}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => envFieldArray.append({ key: '', value: '' })}
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
                <Input {...form.register('url')} placeholder="https://..." />
                {transport === 'http' && httpErrors.url?.message && (
                  <div className="text-xs text-destructive mt-1">
                    {httpErrors.url?.message}
                  </div>
                )}
              </label>

              <label className="text-sm block">
                <div className="mb-1">Auth</div>
                <Input {...form.register('auth')} placeholder="Bearer token" />
                {transport === 'http' && httpErrors.auth?.message && (
                  <div className="text-xs text-destructive mt-1">
                    {httpErrors.auth?.message}
                  </div>
                )}
              </label>

              <label className="text-sm block">
                <div className="mb-1">Heartbeat Interval (seconds)</div>
                <Input
                  type="number"
                  {...form.register('heartbeatSec', { valueAsNumber: true })}
                  placeholder="30"
                />
                {transport === 'http' && httpErrors.heartbeatSec?.message && (
                  <div className="text-xs text-destructive mt-1">
                    {httpErrors.heartbeatSec?.message}
                  </div>
                )}
              </label>

              {/* Headers key/values */}
              <div className="space-y-2">
                <div className="text-sm font-medium">HTTP headers</div>
                <div className="space-y-2">
                  {headerFieldArray.fields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-7 gap-2 items-center"
                    >
                      <Input
                        className="col-span-3"
                        {...form.register(`headers.${idx}.key`)}
                        placeholder="Header-Name"
                      />
                      <Input
                        className="col-span-3"
                        {...form.register(`headers.${idx}.value`)}
                        placeholder="value"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => headerFieldArray.remove(idx)}
                      >
                        Remove
                      </Button>
                      <div className="col-span-7 grid grid-cols-6 gap-2 -mt-1">
                        <div className="col-span-3 text-xs text-destructive">
                          {transport === 'http' &&
                            httpErrors.headers?.[idx]?.key?.message}
                        </div>
                        <div className="col-span-3 text-xs text-destructive">
                          {transport === 'http' &&
                            httpErrors.headers?.[idx]?.value?.message}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      headerFieldArray.append({ key: '', value: '' })
                    }
                  >
                    Add header
                  </Button>
                </div>
              </div>
            </div>
          )}

          {testResult && <McpTestResult result={testResult} />}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch('enabled')}
              onCheckedChange={(checked) =>
                form.setValue('enabled', checked, { shouldDirty: true })
              }
            />
            <label className="text-sm">Enabled</label>
          </div>
          <div className="flex-1" />
          <div className="flex gap-2">
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
