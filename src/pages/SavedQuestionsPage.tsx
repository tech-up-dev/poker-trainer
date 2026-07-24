import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'

import type { Lesson, Question } from '../../shared/schemas/lesson'
import { fetchPublishedLesson } from '../lib/lessons'
import { fetchSavedQuestionRefs, unsaveQuestion } from '../lib/saved-questions'

type SavedQuestion = {
  lessonId: string
  lessonTitle: string
  questionId: string
  question: Question
}

export function SavedQuestionsPage(): JSX.Element {
  const [items, setItems] = useState<SavedQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load(): Promise<void> {
      const refs = await fetchSavedQuestionRefs()
      if (refs.length === 0) { setItems([]); return }

      const uniqueIds = [...new Set(refs.map((r) => r.contentId))]
      const lessonResults = await Promise.all(uniqueIds.map((id) => fetchPublishedLesson(id)))
      const lessonMap = new Map<string, Lesson>()
      uniqueIds.forEach((id, i) => { const l = lessonResults[i]; if (l) lessonMap.set(id, l) })

      const result: SavedQuestion[] = []
      for (const ref of refs) {
        const lesson = lessonMap.get(ref.contentId)
        if (!lesson) continue
        const question = lesson.questions.find((q) => q.question_id === ref.questionId)
        if (!question) continue
        result.push({
          lessonId: ref.contentId,
          lessonTitle: lesson.title,
          questionId: ref.questionId,
          question,
        })
      }

      setItems(result)
    }
    load().catch(() => { setItems([]) }).finally(() => setLoading(false))
  }, [])

  function handleRemove(lessonId: string, questionId: string): void {
    setItems((prev) => prev.filter(
      (i) => !(i.lessonId === lessonId && i.questionId === questionId),
    ))
    unsaveQuestion(lessonId, questionId).catch(() => {})
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Saved Questions</h1>
        <p className="text-sm text-ink-3 mt-1">Questions you bookmarked for review.</p>
      </div>

      {loading && <p className="text-ink-3 text-sm">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="card text-center space-y-2">
          <p className="text-ink font-medium">No saved questions yet</p>
          <p className="text-sm text-ink-3">
            Bookmark questions during a lesson to review them here.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={`${item.lessonId}:${item.questionId}`} className="card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate(`/play/lessons/${item.lessonId}`)}
                className="text-xs text-gold hover:text-amber transition-colors font-medium"
              >
                {item.lessonTitle}
              </button>
              <button
                type="button"
                onClick={() => handleRemove(item.lessonId, item.questionId)}
                className="text-xs text-ink-3 hover:text-error shrink-0 transition-colors"
              >
                Remove
              </button>
            </div>
            <p className="text-sm text-ink leading-relaxed">{item.question.prompt}</p>
            <div className="space-y-1">
              {item.question.answers.map((answer, i) => (
                <div
                  key={i}
                  className={`text-xs px-3 py-2 rounded-lg ${
                    answer.is_correct
                      ? 'bg-success/10 text-success font-medium'
                      : 'bg-surface-overlay text-ink-3'
                  }`}
                >
                  {answer.text}
                  {answer.is_correct && <span className="ml-2 opacity-70">✓</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
