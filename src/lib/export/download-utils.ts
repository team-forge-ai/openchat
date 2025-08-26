/**
 * Downloads text content as a file using a data URL.
 * This approach works entirely in the browser without requiring Tauri file system APIs.
 *
 * @param content The text content to download
 * @param filename The desired filename for the download
 * @param mimeType The MIME type for the file (defaults to text/plain)
 */
export function downloadTextAsFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8',
): void {
  // Create a data URL with the content
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  try {
    // Create a temporary link element and trigger download
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    // Clean up the object URL to prevent memory leaks
    URL.revokeObjectURL(url)
  }
}

/**
 * Downloads markdown content as a .md file.
 *
 * @param content The markdown content to download
 * @param filename The desired filename (should end with .md)
 */
export function downloadMarkdownFile(content: string, filename: string): void {
  downloadTextAsFile(content, filename, 'text/markdown;charset=utf-8')
}
