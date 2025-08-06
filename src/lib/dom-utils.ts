/**
 * Downloads a file from a URL
 * @param url - The URL of the file to download
 * @param filename - Optional filename for the downloaded file
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
