import { useState } from 'react'
import type { JSX } from 'react'
import { useLocation } from 'react-router-dom'

import { ReferenceEditor } from '../components/ReferenceEditor'
import { StagingContent } from '../components/StagingContent'
import { PublishedContent } from '../components/PublishedContent'

type PublishedContext = { contentId: string | null; contentType: string | null; refreshSignal: number }

export function ReferenceEditorPage(): JSX.Element {
  const location = useLocation()
  const preload = (location.state as { preloadContent?: unknown } | null)?.preloadContent
  const initialText =
    preload !== undefined ? JSON.stringify(preload, null, 2) : undefined

  const [published, setPublished] = useState<PublishedContext>({
    contentId: null,
    contentType: null,
    refreshSignal: 0,
  })

  return (
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
          <p className="text-sm text-slate-500">
            Validate a reference to see its staging and production copies.
          </p>
        )}
      </div>
    </div>
  )
}
