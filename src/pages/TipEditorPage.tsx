import { useState } from 'react'
import type { JSX } from 'react'
import { useLocation } from 'react-router-dom'

import { TipEditor } from '../components/TipEditor'
import { PublishedContent } from '../components/PublishedContent'

type PublishedContext = { contentId: string | null; contentType: string | null; refreshSignal: number }

export function TipEditorPage(): JSX.Element {
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
        <TipEditor onPublishedContextChange={setPublished} initialText={initialText} />
      </div>
      <div>
        {published.contentId !== null && published.contentType !== null ? (
          <PublishedContent
            contentId={published.contentId}
            contentType={published.contentType}
            refreshSignal={published.refreshSignal}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Validate a tip to see its current production content.
          </p>
        )}
      </div>
    </div>
  )
}
