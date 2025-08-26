import { Bot, Download, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_MODEL } from '@/hooks/use-model'
import { useModelDownload } from '@/hooks/use-model-download'
import { useModelSettings } from '@/hooks/use-model-settings'

/**
 * Format a model ID for display by showing only the model name part
 * e.g., "lmstudio-community/Qwen3-30B-A3B-Instruct-2507-MLX-4bit" -> "Qwen3-30B-A3B-Instruct-2507-MLX-4bit"
 */
function formatModelDisplay(modelId: string): string {
  const parts = modelId.split('/')
  return parts.length > 1 ? parts[parts.length - 1] : modelId
}

/**
 * Format the default model for display with a special indicator
 */
function formatDefaultModelDisplay(): string {
  return `${formatModelDisplay(DEFAULT_MODEL)} (Default)`
}

export function ModelSelection() {
  const {
    currentModel,
    availableModels,
    isLoadingCurrent,
    isLoadingModels,
    isServerReady,
    error,
    updateModel,
    isUpdating,
  } = useModelSettings()

  const {
    downloadModel,
    isDownloading,
    isDownloadComplete,
    isDownloadFailed,
    downloadProgress,
  } = useModelDownload(DEFAULT_MODEL)

  const handleModelChange = async (value: string) => {
    try {
      // Handle the special "default" case
      const modelToSet = value === 'default' ? null : value
      await updateModel(modelToSet)
    } catch (error) {
      console.error('Failed to update model:', error)
    }
  }

  const handleRefresh = () => {
    // Trigger a refetch by restarting the query
    window.location.reload()
  }

  const handleDownloadDefault = async () => {
    try {
      await downloadModel(DEFAULT_MODEL)
    } catch (error) {
      console.error('Failed to download default model:', error)
    }
  }

  // Check if the default model is available in the server
  const isDefaultModelAvailable = availableModels.some(
    (model) => model.id === DEFAULT_MODEL,
  )

  if (isLoadingCurrent) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="model-select" className="text-sm font-medium">
          Model
        </label>
        <div className="flex gap-2">
          <Select
            value={currentModel || 'default'}
            onValueChange={handleModelChange}
            disabled={isUpdating}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a model">
                {currentModel ? (
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {formatModelDisplay(currentModel)}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {formatDefaultModelDisplay()}
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  {formatDefaultModelDisplay()}
                </div>
              </SelectItem>

              {isServerReady && availableModels.length > 0 && (
                <>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {formatModelDisplay(model.id)}
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoadingModels || !isServerReady}
            title="Refresh available models"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoadingModels ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Status and error messages */}
      <div className="space-y-2">
        {!isServerReady && (
          <p className="text-sm text-muted-foreground">
            MLX server is not ready. Start the server to see available models.
          </p>
        )}

        {isServerReady && isLoadingModels && (
          <p className="text-sm text-muted-foreground">Loading models...</p>
        )}

        {isServerReady &&
          !isLoadingModels &&
          availableModels.length === 0 &&
          !error && (
            <p className="text-sm text-muted-foreground">
              No models found. Make sure you have models loaded in the MLX
              server.
            </p>
          )}

        {error && (
          <p className="text-sm text-destructive">
            Failed to fetch models: {error.message}
          </p>
        )}

        {isUpdating && (
          <p className="text-sm text-muted-foreground">Updating model...</p>
        )}
      </div>

      {/* Default Model Download Section */}
      {isServerReady && !isDefaultModelAvailable && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <h4 className="font-medium">Download Default Model</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            The default model ({formatModelDisplay(DEFAULT_MODEL)}) is not
            available on your MLX server. Download it to use as the default.
          </p>

          {!isDownloading && !isDownloadComplete && !isDownloadFailed && (
            <Button
              onClick={handleDownloadDefault}
              disabled={isDownloading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Default Model
            </Button>
          )}

          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Downloading...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {isDownloadComplete && (
            <div className="text-sm text-green-600 font-medium">
              ✓ Download completed successfully! Refresh to see the model.
            </div>
          )}

          {isDownloadFailed && (
            <div className="space-y-2">
              <div className="text-sm text-destructive font-medium">
                ✗ Download failed. Please try again.
              </div>
              <Button
                onClick={handleDownloadDefault}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Retry Download
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Select the model you want to use for new conversations. The default
          model will be used if no specific model is selected.
        </p>
        {currentModel && (
          <p className="text-xs text-muted-foreground">
            Currently using:{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              {currentModel}
            </code>
          </p>
        )}
      </div>
    </div>
  )
}
