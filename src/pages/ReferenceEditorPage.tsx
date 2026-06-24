import { useState } from 'react'
import type { JSX } from 'react'

import { ReferenceEditor } from '../components/ReferenceEditor'
import { PublishedContent } from '../components/PublishedContent'

type PublishedContext = { contentId: string | null; contentType: string | null; refreshSignal: number }

export function ReferenceEditorPage(): JSX.Element {
  const [published, setPublished] = useState<PublishedContext>({
    contentId: null,
    contentType: null,
    refreshSignal: 0,
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <ReferenceEditor onPublishedContextChange={setPublished} />
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
            Validate a reference to see its current production content.
          </p>
        )}
      </div>
    </div>
  )
}
