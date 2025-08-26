/**
 * Triggers a browser download for the provided URL.
 * Creates a temporary anchor element and clicks it programmatically.
 *
 * @param url The URL of the file to download.
 * @param filename Optional filename hint; falls back to the last URL segment.
 */
export function downloadFile(url: string, filename?: string): void {
  const lastPath = url.split('/').pop()

  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.download = filename || lastPath || 'download.png'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
