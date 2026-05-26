// Helpers for handling export payloads from the kube-phoenix backend.
// Operators copy/share these via clipboard or .json file, then paste them
// into the Import dialog of the target environment.

/**
 * Copies a JSON-serialisable payload to the clipboard as pretty-printed text.
 * Throws when the clipboard API is unavailable or the write is rejected.
 */
export async function copyJsonToClipboard(payload: unknown): Promise<void> {
  const text = JSON.stringify(payload, null, 2)
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard API is unavailable in this browser')
  }
  await navigator.clipboard.writeText(text)
}

/**
 * Triggers a browser download of a JSON payload as a .json file.
 * Filename is slugified to ASCII characters safe on Windows/macOS/Linux.
 */
export function downloadJsonFile(payload: unknown, baseName: string): void {
  const text = JSON.stringify(payload, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugifyForFilename(baseName)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function slugifyForFilename(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'export'
}
