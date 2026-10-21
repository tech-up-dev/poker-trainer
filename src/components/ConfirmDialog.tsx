import { useEffect, useId, useRef } from 'react'
import type { JSX } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  // Optional facts shown in a highlighted box under the message (for example the
  // exact account about to be deleted).
  details?: { label: string; value: string }[]
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  details,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const confirmClasses = destructive
    ? 'bg-amber-600 hover:bg-amber-500 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-line bg-canvas text-left shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-line">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
        </div>
        <div className="px-5 py-4">
          <p id={messageId} className="text-sm text-ink-2 leading-relaxed">
            {message}
          </p>
          {details && details.length > 0 && (
            <dl className="mt-3 rounded border border-line bg-surface px-3 py-2 text-sm space-y-1">
              {details.map((d) => (
                <div key={d.label} className="flex gap-2">
                  <dt className="text-ink-3 shrink-0">{d.label}:</dt>
                  <dd className="text-ink font-medium break-all">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="px-5 py-3 border-t border-line flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded bg-surface-raised hover:bg-surface-overlay text-ink"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 text-sm rounded font-medium ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
