import { z } from 'zod'

export const ModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  owned_by: z.string(),
})

export const ModelsResponseSchema = z.object({
  object: z.string(),
  data: z.array(ModelSchema),
})

export type Model = z.infer<typeof ModelSchema>
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>
