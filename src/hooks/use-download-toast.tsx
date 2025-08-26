import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { DownloadProgressToast } from '@/components/download-progress-toast'
import { useDownloadProgress } from '@/contexts/download-progress-context'
import type { DownloadProgressState } from '@/contexts/download-progress-context'

// Helper to create toast content
function createToastContent(
  repoId: string,
  state: DownloadProgressState,
  isDismissible = false,
  onDismiss?: () => void,
) {
  return (
    <DownloadProgressToast
      repoId={repoId}
      state={state}
      isDismissible={isDismissible}
      onDismiss={onDismiss}
    />
  )
}

/**
 * Hook to manage download progress toasts
 * Shows persistent toasts for active downloads and dismissible toasts for completed/failed downloads
 */
export function useDownloadToasts() {
  const downloadStates = useDownloadProgress()
  const activeToastIds = useRef<Record<string, string | number>>({})

  useEffect(() => {
    Object.entries(downloadStates).forEach(([repoId, state]) => {
      const existingToastId = activeToastIds.current[repoId]

      if (state.status === 'downloading') {
        // Create or update downloading toast (persistent)
        if (!existingToastId) {
          const toastId = toast(createToastContent(repoId, state), {
            duration: Infinity, // Persistent
            dismissible: false, // Cannot be dismissed
          })
          activeToastIds.current[repoId] = toastId
        } else {
          // Update existing toast
          toast(createToastContent(repoId, state), {
            id: existingToastId,
            duration: Infinity,
            dismissible: false,
          })
        }
      } else if (state.status === 'completed') {
        // Show success toast (auto-dismiss after 4 seconds)
        if (existingToastId) {
          toast.dismiss(existingToastId)
        }

        const successToastId = toast.success(
          createToastContent(repoId, state, true, () =>
            toast.dismiss(successToastId),
          ),
          {
            duration: 4000,
            dismissible: true,
          },
        )

        // Clean up reference
        delete activeToastIds.current[repoId]
      } else if (state.status === 'failed') {
        // Show error toast (manual dismiss)
        if (existingToastId) {
          toast.dismiss(existingToastId)
        }

        const errorToastId = toast.error(
          createToastContent(repoId, state, true, () =>
            toast.dismiss(errorToastId),
          ),
          {
            duration: Infinity, // Manual dismiss only
            dismissible: true,
          },
        )

        // Clean up reference
        delete activeToastIds.current[repoId]
      }
    })

    // Clean up toasts for downloads that are no longer in the state
    Object.keys(activeToastIds.current).forEach((repoId) => {
      if (!downloadStates[repoId] || downloadStates[repoId].status === 'idle') {
        const toastId = activeToastIds.current[repoId]
        if (toastId) {
          toast.dismiss(toastId)
          delete activeToastIds.current[repoId]
        }
      }
    })
  }, [downloadStates])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(activeToastIds.current).forEach((toastId) => {
        toast.dismiss(toastId)
      })
      activeToastIds.current = {}
    }
  }, [])
}

/**
 * Manually trigger a download toast for a specific model
 * Useful for testing or manual triggers
 */
export function showDownloadToast(
  repoId: string,
  state: DownloadProgressState,
) {
  if (state.status === 'downloading') {
    return toast(createToastContent(repoId, state), {
      duration: Infinity,
      dismissible: false,
    })
  } else if (state.status === 'completed') {
    return toast.success(createToastContent(repoId, state), {
      duration: 4000,
      dismissible: true,
    })
  } else if (state.status === 'failed') {
    return toast.error(createToastContent(repoId, state), {
      duration: Infinity,
      dismissible: true,
    })
  }
}
