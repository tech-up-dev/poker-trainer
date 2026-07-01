// Trigger a client-side download of `data` as pretty-printed JSON. The output is
// exactly the JSON the Bulk Import flow accepts, so import(export(x)) round-trips
// losslessly (issue #30). Callers pass content that is already loaded in the view
// (published, staged, or a version snapshot), so export makes no extra requests
// and needs no additional auth.
export function downloadJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.json') ? filename : `${filename}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

// Stable, filesystem-safe filename for an exported content item.
export function exportFilename(contentType: string, contentId: string, version?: number): string {
  const base = `${contentType}-${contentId}`.replace(/[^a-zA-Z0-9._-]+/g, '-')
  return version === undefined ? `${base}.json` : `${base}-v${version}.json`
}
