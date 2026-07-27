import { useState } from 'react'
import type { JSX } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ReferenceEditor } from '../components/ReferenceEditor'
import { StagingContent } from '../components/StagingContent'
import { PublishedContent } from '../components/PublishedContent'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { supabaseProd } from '../lib/supabase-prod'

type PublishedContext = {
  contentId: string | null
  contentType: string | null
  refreshSignal: number
}

export function ReferenceEditorPage(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const locState = location.state as { preloadContent?: unknown; contentId?: string; contentType?: string } | null
  const preload = locState?.preloadContent
  const initialText = preload !== undefined ? JSON.stringify(preload, null, 2) : undefined
  const editingContentId = locState?.contentId ?? null
  const editingContentType = locState?.contentType ?? null

  const [published, setPublished] = useState<PublishedContext>({
    contentId: null,
    contentType: null,
    refreshSignal: 0,
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(): Promise<void> {
    if (!editingContentId || !editingContentType) return
    setShowDeleteConfirm(false)
    setDeleting(true)
    setDeleteError(null)
    const { data, error } = await supabaseProd.functions.invoke('delete-content', {
      body: { content_id: editingContentId, content_type: editingContentType },
    })
    const result = data as { ok: boolean; message?: string } | null
    if (error || !result?.ok) {
      setDeleteError(result?.message ?? error?.message ?? 'Delete failed')
      setDeleting(false)
      return
    }
    navigate('/admin/staging')
  }

  return (
    <>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete from live app?"
        message="This immediately removes the reference from both staging and the live app. This cannot be undone."
        confirmLabel="Delete everywhere"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <div className="space-y-6">
        {editingContentId && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-2">Editing: <span className="font-mono text-ink">{editingContentId}</span></p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="px-3 py-1.5 text-sm rounded bg-red-800 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
        {deleteError && <p className="text-sm text-error">Delete failed: {deleteError}</p>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <ReferenceEditor onPublishedContextChange={setPublished} initialText={initialText} />
          </div>
          <div className="space-y-8">
            {published.contentId !== null && published.contentType !== null ? (
              <>
                <StagingContent
                  contentId={published.contentId}
                  contentType={published.contentType}
                  refreshSignal={published.refreshSignal}
                />
                <PublishedContent
                  contentId={published.contentId}
                  contentType={published.contentType}
                  refreshSignal={published.refreshSignal}
                />
              </>
            ) : (
              <p className="text-sm text-ink-3">
                Validate a reference to see its staging and production copies.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
