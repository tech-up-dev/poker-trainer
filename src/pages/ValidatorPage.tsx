import { useState } from 'react'
import type { JSX } from 'react'

import { LessonValidator } from '../components/LessonValidator'
import { PublishedContent } from '../components/PublishedContent'

type PublishedContext = { lessonId: string | null; refreshSignal: number }

// The single-lesson validator on the left, the current production content for
// whatever lesson is loaded on the right. This is the view App used to render
// directly, now a route under the admin shell.
export function ValidatorPage(): JSX.Element {
  const [published, setPublished] = useState<PublishedContext>({
    lessonId: null,
    refreshSignal: 0,
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <LessonValidator onPublishedContextChange={setPublished} />
      </div>
      <div>
        {published.lessonId !== null ? (
          <PublishedContent
            lessonId={published.lessonId}
            refreshSignal={published.refreshSignal}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Validate a lesson to see its current production content.
          </p>
        )}
      </div>
    </div>
  )
}
