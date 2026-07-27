import { useState } from 'react'
import type { JSX } from 'react'
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom'

import { LessonValidator } from '../components/LessonValidator'
import { GlossaryEditor } from '../components/GlossaryEditor'
import { TipEditor } from '../components/TipEditor'
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

const TABS = [
  { id: 'lesson',    label: 'Lesson'    },
  { id: 'glossary',  label: 'Glossary'  },
  { id: 'tip',       label: 'Tip'       },
  { id: 'reference', label: 'Reference' },
] as const

type TabId = typeof TABS[number]['id']

const EMPTY_HINT: Record<TabId, string> = {
  lesson:    'Validate a lesson to see its staging and production copies.',
  glossary:  'Validate a glossary entry to see its staging and production copies.',
  tip:       'Validate a tip to see its staging and production copies.',
  reference: 'Validate a reference to see its staging and production copies.',
}

function isTabId(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v)
}

export function ValidatorPage(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get('tab')
  const activeTab: TabId = isTabId(rawTab) ? rawTab : 'lesson'

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

  function switchTab(id: TabId): void {
    setPublished({ contentId: null, contentType: null, refreshSignal: 0 })
    setSearchParams({ tab: id }, { replace: true })
  }

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

  const deleteWarning =
    editingContentType === 'glossary'
      ? 'This immediately removes the glossary entry from both staging and the live app. Lessons that reference this term will be updated automatically. This cannot be undone.'
      : 'This immediately removes the item from both staging and the live app. This cannot be undone.'

  return (
    <>
    <ConfirmDialog
      open={showDeleteConfirm}
      title="Delete from live app?"
      message={deleteWarning}
      confirmLabel="Delete everywhere"
      cancelLabel="Cancel"
      destructive
      onConfirm={() => void handleDelete()}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    <div className="space-y-6">
      {/* Delete bar - shown when arriving from staging via Edit */}
      {editingContentId && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface border border-line">
          <p className="text-sm text-ink-2">
            Editing: <span className="font-mono text-ink">{editingContentId}</span>
          </p>
          {deleteError && <p className="text-sm text-error mr-4">Delete failed: {deleteError}</p>}
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
      {/* Tab bar */}
      <div className="flex border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-gold text-gold'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editor + preview grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          {activeTab === 'lesson' && (
            <LessonValidator
              key="lesson"
              onPublishedContextChange={setPublished}
              initialText={initialText}
            />
          )}
          {activeTab === 'glossary' && (
            <GlossaryEditor
              key="glossary"
              onPublishedContextChange={setPublished}
              initialText={initialText}
            />
          )}
          {activeTab === 'tip' && (
            <TipEditor
              key="tip"
              onPublishedContextChange={setPublished}
              initialText={initialText}
            />
          )}
          {activeTab === 'reference' && (
            <ReferenceEditor
              key="reference"
              onPublishedContextChange={setPublished}
              initialText={initialText}
            />
          )}
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
            <p className="text-sm text-ink-3">{EMPTY_HINT[activeTab]}</p>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
