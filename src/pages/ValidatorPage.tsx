import { useState } from 'react'
import type { JSX } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import { LessonValidator } from '../components/LessonValidator'
import { GlossaryEditor } from '../components/GlossaryEditor'
import { TipEditor } from '../components/TipEditor'
import { ReferenceEditor } from '../components/ReferenceEditor'
import { StagingContent } from '../components/StagingContent'
import { PublishedContent } from '../components/PublishedContent'

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
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get('tab')
  const activeTab: TabId = isTabId(rawTab) ? rawTab : 'lesson'

  const preload = (location.state as { preloadContent?: unknown } | null)?.preloadContent
  const initialText = preload !== undefined ? JSON.stringify(preload, null, 2) : undefined

  const [published, setPublished] = useState<PublishedContext>({
    contentId: null,
    contentType: null,
    refreshSignal: 0,
  })

  function switchTab(id: TabId): void {
    setPublished({ contentId: null, contentType: null, refreshSignal: 0 })
    setSearchParams({ tab: id }, { replace: true })
  }

  return (
    <div className="space-y-6">
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
  )
}
