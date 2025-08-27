import { zodResolver } from '@hookform/resolvers/zod'
import { Download } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useModelDownload } from '@/hooks/use-model-download'

const formSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required').trim(),
})

type FormValues = z.infer<typeof formSchema>

export function ModelDownload() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      modelId: '',
    },
  })

  const watchedModelId = form.watch('modelId')

  // Use the download hook for the current model being downloaded
  const {
    downloadState,
    downloadModel: triggerDownload,
    isDownloading,
    isDownloadComplete,
    isDownloadFailed,
    downloadProgress,
  } = useModelDownload(watchedModelId)

  const onSubmit = async (values: FormValues) => {
    try {
      await triggerDownload(values.modelId)
    } catch (downloadError) {
      const errorMessage =
        downloadError instanceof Error
          ? downloadError.message
          : 'Failed to download model'
      form.setError('root', { message: errorMessage })
    }
  }

  const showProgress = isDownloading && watchedModelId.trim()

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="model-id-input" className="text-sm font-medium">
            Model Repository ID
          </label>
          <div className="flex gap-2">
            <Input
              id="model-id-input"
              {...form.register('modelId')}
              placeholder="e.g., mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC"
              disabled={isDownloading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isDownloading || !form.formState.isValid}
              className="min-w-fit"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Downloading...' : 'Download'}
            </Button>
          </div>
        </div>

        {/* Error display */}
        {(form.formState.errors.modelId?.message ||
          form.formState.errors.root?.message) && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
            {form.formState.errors.modelId?.message ||
              form.formState.errors.root?.message}
          </div>
        )}

        {/* Download progress */}
        {showProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Downloading {watchedModelId}...
              </span>
              <span className="font-mono">{downloadProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            {downloadState.lastFile && (
              <div className="text-xs text-muted-foreground">
                Current file: {downloadState.lastFile}
              </div>
            )}
          </div>
        )}

        {/* Success message */}
        {isDownloadComplete && watchedModelId.trim() && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
            ✓ Successfully downloaded {watchedModelId}! You can now select it
            from the Model section.
          </div>
        )}

        {/* Failed message */}
        {isDownloadFailed && watchedModelId.trim() && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
            ✗ Failed to download {watchedModelId}. Please check the model ID and
            try again.
          </div>
        )}
      </form>
    </div>
  )
}
