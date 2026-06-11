import { useState } from 'react'

import { LessonValidator } from './components/LessonValidator'
import { PublishedContent } from './components/PublishedContent'

type PublishedContext = { lessonId: string | null; refreshSignal: number }

function App() {
  const [published, setPublished] = useState<PublishedContext>({
    lessonId: null,
    refreshSignal: 0,
  })

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
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
    </div>
  )
}

export default App
