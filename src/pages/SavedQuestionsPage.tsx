import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'

import type { Lesson, Question } from '../../shared/schemas/lesson'
import { linkifyGlossaryTerms } from '../lib/glossary-text'
import { fetchPublishedLesson } from '../lib/lessons'
import { fetchSavedQuestionRefs, unsaveQuestion } from '../lib/saved-questions'

type SavedEntry = {
  lesson: Lesson
  question: Question
}

export function SavedQuestionsPage(): JSX.Element {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<SavedEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load(): Promise<void> {
      const refs = await fetchSavedQuestionRefs()
      if (refs.length === 0) {
        setEntries([])
        return
      }

      // Deduplicate lesson fetches
      const uniqueContentIds = [...new Set(refs.map((r) => r.contentId))]
      const lessons = await Promise.all(uniqueContentIds.map((id) => fetchPublishedLesson(id)))
      const lessonMap = new Map<string, Lesson>()
      uniqueContentIds.forEach((id, i) => {
        const lesson = lessons[i]
        if (lesson) lessonMap.set(id, lesson)
      })

      const resolved: SavedEntry[] = []
      for (const ref of refs) {
        const lesson = lessonMap.get(ref.contentId)
        if (!lesson) continue
        const question = lesson.questions.find((q) => q.question_id === ref.questionId)
        if (question) resolved.push({ lesson, question })
      }
      setEntries(resolved)
    }

    load()
      .catch(() => {
        // Treat load failures (e.g. auth not wired to prod Supabase yet) as empty state.
        setEntries([])
      })
      .finally(() => setLoading(false))
  }, [])

  function handleRemove(lessonId: string | undefined, questionId: string | undefined): void {
    if (!lessonId || !questionId) return
    setEntries((prev) =>
      prev.filter((e) => !(e.lesson.lesson_id === lessonId && e.question.question_id === questionId)),
    )
    unsaveQuestion(lessonId, questionId).catch(() => {
      // Best-effort; if it fails the item will reappear on next load.
    })
  }

  return (
    <div className="min-h-screen bg-canvas text-ink px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/play')}
            className="text-sm text-link hover:underline"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold">Saved Questions</h1>
        </div>

        {loading && <p className="text-ink-2 text-sm">Loading…</p>}

        {!loading && entries.length === 0 && (
          <div className="bg-surface border border-line rounded-xl p-6 text-center space-y-2">
            <p className="text-ink font-medium">No saved questions yet</p>
            <p className="text-sm text-ink-2">
              Tap "Save for later" inside any lesson's feedback drawer to bookmark a question here.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {entries.map(({ lesson, question }) => {
            const correctAnswer = question.answers.find((a) => a.is_correct)
            return (
              <div
                key={`${lesson.lesson_id}-${question.question_id}`}
                className="bg-surface border border-line rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold text-gold uppercase tracking-widest">
                    {lesson.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRemove(lesson.lesson_id, question.question_id)}
                    className="text-xs text-ink-3 hover:text-error shrink-0 transition-colors"
                  >
                    Remove
                  </button>
                </div>

                <p className="text-sm font-medium text-ink leading-relaxed">
                  {linkifyGlossaryTerms(question.prompt, question.glossary_terms)}
                </p>

                {correctAnswer && (
                  <div className="flex gap-3 p-3 rounded-lg bg-success/8 border border-success/20">
                    <span
                      aria-hidden="true"
                      className="w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-success text-on-gold"
                    >
                      ✓
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-ink">{correctAnswer.text}</p>
                      <p className="text-sm text-ink-2 leading-relaxed">
                        {linkifyGlossaryTerms(correctAnswer.explanation, question.glossary_terms)}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => navigate(`/play/lessons/${lesson.lesson_id}`)}
                  className="text-xs text-link hover:underline"
                >
                  Practice this lesson →
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
