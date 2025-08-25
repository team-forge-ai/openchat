import { invoke } from '@tauri-apps/api/core'

/**
 * Downloads a Hugging Face model to the local cache if not already present.
 * Emits `mlc-download-progress` events during the download process which can
 * be listened to using `subscribeDownloadProgress` from `@/lib/download-progress`.
 *
 * @param repoId The Hugging Face model repository ID (e.g., "mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC")
 * @returns Promise that resolves when the download is complete or if the model is already cached
 * @throws If the download fails or the command encounters an error
 *
 * @example
 * ```typescript
 * import { downloadModel } from '@/lib/model-download'
 * import { subscribeDownloadProgress } from '@/lib/download-progress'
 *
 * // Subscribe to progress events
 * const unsubscribe = await subscribeDownloadProgress((event) => {
 *   console.log('Download progress:', event)
 * })
 *
 * try {
 *   await downloadModel('mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC')
 *   console.log('Model downloaded successfully!')
 * } catch (error) {
 *   console.error('Download failed:', error)
 * } finally {
 *   unsubscribe()
 * }
 * ```
 */
export async function downloadModel(repoId: string): Promise<void> {
  await invoke('download_model', { repoId })
}
