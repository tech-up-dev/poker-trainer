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
      if (refs.length === 0) { setEntries([]); return }

      const uniqueIds = [...new Set(refs.map((r) => r.contentId))]
      const lessons = await Promise.all(uniqueIds.map((id) => fetchPublishedLesson(id)))
      const lessonMap = new Map<string, Lesson>()
      uniqueIds.forEach((id, i) => { const l = lessons[i]; if (l) lessonMap.set(id, l) })

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
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  function handleRemove(lessonId: string | undefined, questionId: string | undefined): void {
    if (!lessonId || !questionId) return
    setEntries((prev) =>
      prev.filter((e) => !(e.lesson.lesson_id === lessonId && e.question.question_id === questionId)),
    )
    unsaveQuestion(lessonId, questionId).catch(() => {})
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Saved Questions</h1>
        <p className="text-sm text-zinc-500 mt-1">Questions you bookmarked for later review.</p>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Loading…</p>}

      {!loading && entries.length === 0 && (
        <div className="card text-center space-y-2">
          <p className="text-zinc-100 font-medium">No saved questions yet</p>
          <p className="text-sm text-zinc-500">
            Tap "Save for later" inside any lesson's feedback to bookmark a question here.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {entries.map(({ lesson, question }) => {
          const correctAnswer = question.answers.find((a) => a.is_correct)
          return (
            <div
              key={`${lesson.lesson_id}-${question.question_id}`}
              className="card space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest">
                  {lesson.title}
                </p>
                <button
                  type="button"
                  onClick={() => handleRemove(lesson.lesson_id, question.question_id)}
                  className="text-xs text-zinc-500 hover:text-error shrink-0 transition-colors"
                >
                  Remove
                </button>
              </div>

              <p className="text-sm font-medium text-zinc-100 leading-relaxed">
                {linkifyGlossaryTerms(question.prompt, question.glossary_terms)}
              </p>

              {correctAnswer && (
                <div className="flex gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                  <span
                    aria-hidden="true"
                    className="w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-success text-zinc-900"
                  >
                    ✓
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-100">{correctAnswer.text}</p>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {linkifyGlossaryTerms(correctAnswer.explanation, question.glossary_terms)}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate(`/play/lessons/${lesson.lesson_id}`)}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                Practice this lesson →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
