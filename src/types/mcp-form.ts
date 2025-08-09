import { z } from 'zod'

const stringKV = z.object({ key: z.string().min(1), value: z.string() })

const common = {
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  enabled: z.boolean().default(false),
}

export const McpServerFormSchema = z.discriminatedUnion('transport', [
  z.object({
    transport: z.literal('stdio'),
    ...common,
    command: z.string().min(1, 'Command is required'),
    args: z.array(z.string()).default([]),
    cwd: z.string().optional().nullable(),
    env: z.array(stringKV).default([]),
  }),
  z.object({
    transport: z.literal('websocket'),
    ...common,
    url: z.string().url('Must be a valid URL'),
    headers: z.array(stringKV).default([]),
    auth: z.string().optional().nullable(),
    heartbeatSec: z.number().int().nonnegative().optional().nullable(),
  }),
  z.object({
    transport: z.literal('http'),
    ...common,
    url: z.string().url('Must be a valid URL'),
    headers: z.array(stringKV).default([]),
    auth: z.string().optional().nullable(),
    heartbeatSec: z.number().int().nonnegative().optional().nullable(),
  }),
])

export type McpServerFormValues = z.infer<typeof McpServerFormSchema>
