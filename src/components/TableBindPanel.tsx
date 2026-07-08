import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { HandScenarioState, Lesson, Question } from '../../shared/schemas/lesson'
import { supabaseProd } from '../lib/supabase-prod'
import { validateLesson } from '../lib/validate'
import { fetchStagingGlossaryTerms, fetchProdGlossaryTerms } from '../lib/glossary-terms'
import { AddQuestionModal } from './AddQuestionModal'

// Binds a table built in the Table Builder directly onto an existing staging
// lesson's question, so authors no longer copy the JSON by hand. Two selects
// (lesson, then its question) plus Save (to staging) and a Promote that stays
// locked until this exact table has been saved, mirroring the Bulk Import gating.
// Attaching a table marks the question as a hand_scenario, which the schema needs.
type StagedLesson = { content_id: string; content: Lesson }
type Status = 'idle' | 'busy' | { error: string } | { ok: string }

const gold = '#F4A024'
const muted = '#9DB2C9'
const ink = '#EAF1F8'
const panel = '#0E2A47'
const border = '1px solid #2a5079'

export function TableBindPanel({ tableState }: { tableState: HandScenarioState }): JSX.Element {
  const [lessons, setLessons] = useState<StagedLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lessonId, setLessonId] = useState('')
  const [questionIndex, setQuestionIndex] = useState(-1)
  const [saveStatus, setSaveStatus] = useState<Status>('idle')
  const [promoteStatus, setPromoteStatus] = useState<Status>('idle')
  // Signature of the (lesson, question, table) that was last saved. Promotion is
  // allowed only while the current selection + table still match it, so editing
  // the table or switching target re-locks Promote without any effect.
  const [savedSignature, setSavedSignature] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)

  // Pure fetch (no setState) plus a separate applier, so the mount effect only
  // ever setStates inside a .then callback (react-hooks/set-state-in-effect).
  async function fetchStagedLessons(): Promise<{ lessons?: StagedLesson[]; error?: string }> {
    const { data, error } = await supabaseProd.functions.invoke('list-from-staging', { body: {} })
    if (error) return { error: error.message }
    const result = data as {
      ok: boolean
      items?: { content_id: string; content_type: string; content: Lesson }[]
      message?: string
    }
    if (!result.ok) return { error: result.message ?? 'Failed to load staging lessons' }
    return {
      lessons: (result.items ?? [])
        .filter((i) => i.content_type === 'lesson')
        .map((i) => ({ content_id: i.content_id, content: i.content })),
    }
  }

  function applyLoad(r: { lessons?: StagedLesson[]; error?: string }): void {
    if (r.error) setLoadError(r.error)
    else {
      setLoadError(null)
      setLessons(r.lessons ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetchStagedLessons().then((r) => {
      if (active) applyLoad(r)
    })
    return () => {
      active = false
    }
  }, [])

  const selectedLesson = lessons.find((l) => l.content_id === lessonId)
  const questions = selectedLesson?.content.questions ?? []
  const currentSignature = JSON.stringify({ lessonId, questionIndex, tableState })
  const saved = savedSignature !== null && savedSignature === currentSignature

  // Writes the modified lesson back to staging, refreshes, and marks the saved
  // (lesson, question, table) so Promote unlocks for exactly this state.
  async function saveLesson(content: Lesson, keepQuestion: number): Promise<boolean> {
    const validation = validateLesson(content)
    if (!validation.ok) {
      setSaveStatus({ error: `Invalid: ${validation.errors[0]?.path} ${validation.errors[0]?.message}` })
      return false
    }
    const glossary_terms = await fetchStagingGlossaryTerms().catch(() => undefined)
    const { data, error } = await supabaseProd.functions.invoke('save-to-staging', {
      body: { content_id: content.lesson_id, content_type: 'lesson', content, glossary_terms },
    })
    if (error) {
      setSaveStatus({ error: error.message })
      return false
    }
    const result = data as { ok: boolean; content_id?: string; message?: string }
    if (!result.ok) {
      setSaveStatus({ error: result.message ?? 'Save failed' })
      return false
    }
    const effectiveId = result.content_id ?? content.lesson_id ?? lessonId
    applyLoad(await fetchStagedLessons())
    setLessonId(effectiveId)
    setQuestionIndex(keepQuestion)
    setSavedSignature(JSON.stringify({ lessonId: effectiveId, questionIndex: keepQuestion, tableState }))
    return true
  }

  async function handleSave(): Promise<void> {
    if (!selectedLesson || questionIndex < 0) return
    setSaveStatus('busy')
    setPromoteStatus('idle')
    const content = structuredClone(selectedLesson.content)
    content.questions[questionIndex] = {
      ...content.questions[questionIndex],
      type: 'hand_scenario',
      table_state: tableState,
    }
    if (await saveLesson(content, questionIndex)) {
      setSaveStatus({ ok: 'Table bound and saved to staging' })
    }
  }

  async function handlePromote(): Promise<void> {
    if (!saved || !selectedLesson) return
    setPromoteStatus('busy')
    const glossary_terms = await fetchProdGlossaryTerms().catch(() => undefined)
    const { data, error } = await supabaseProd.functions.invoke('promote-to-prod', {
      body: { content_id: selectedLesson.content_id, content_type: 'lesson', glossary_terms },
    })
    if (error) return setPromoteStatus({ error: error.message })
    const result = data as { ok: boolean; version_number?: number; message?: string }
    if (!result.ok) return setPromoteStatus({ error: result.message ?? 'Promote failed' })
    setPromoteStatus({ ok: `Promoted to production (v${result.version_number})` })
  }

  async function handleAddQuestion(question: Question): Promise<void> {
    if (!selectedLesson) return
    setSaveStatus('busy')
    setPromoteStatus('idle')
    const content = structuredClone(selectedLesson.content)
    content.questions.push(question)
    if (await saveLesson(content, content.questions.length - 1)) {
      setSaveStatus({ ok: 'Question added to staging' })
    }
    setModalOpen(false)
  }

  // Success messages only make sense while still "saved"; errors always show.
  function message(s: Status): { text: string; color: string } | null {
    if (s === 'busy') return { text: 'Working…', color: muted }
    if (s === 'idle') return null
    if ('error' in s) return { text: s.error, color: '#F87171' }
    return saved ? { text: s.ok, color: '#4ADE80' } : null
  }
  const saveMsg = message(saveStatus)
  const promoteMsg = message(promoteStatus)

  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: panel, border }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: gold }}>
          Bind table to a staging question
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setLoadError(null)
              fetchStagedLessons().then(applyLoad)
            }}
            className="text-[12px] px-2 py-1 rounded"
            style={{ background: '#07182C', border, color: muted }}
          >
            ↻ Refresh
          </button>
          <a
            href="/admin/wizard"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] px-2 py-1 rounded"
            style={{ background: '#07182C', border, color: muted }}
          >
            + New lesson (wizard)
          </a>
        </div>
      </div>

      {loadError && (
        <p className="text-[12px]" style={{ color: '#F87171' }}>
          {loadError}
        </p>
      )}

      <div className="flex gap-2 flex-wrap items-end">
        <label className="space-y-1">
          <span className="block text-[11px]" style={{ color: muted }}>
            Lesson
          </span>
          <select
            value={lessonId}
            onChange={(e) => {
              setLessonId(e.target.value)
              setQuestionIndex(-1)
              setSaveStatus('idle')
              setPromoteStatus('idle')
            }}
            disabled={loading}
            className="rounded px-2 py-1.5 text-[13px] min-w-[220px]"
            style={{ background: '#07182C', border, color: ink }}
          >
            <option value="">{loading ? 'Loading…' : 'Select a lesson'}</option>
            {lessons.map((l) => (
              <option key={l.content_id} value={l.content_id}>
                {l.content.title} ({l.content_id})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[11px]" style={{ color: muted }}>
            Question
          </span>
          <select
            value={questionIndex}
            onChange={(e) => {
              setQuestionIndex(Number(e.target.value))
              setSaveStatus('idle')
              setPromoteStatus('idle')
            }}
            disabled={!selectedLesson}
            className="rounded px-2 py-1.5 text-[13px] min-w-[260px]"
            style={{ background: '#07182C', border, color: ink }}
          >
            <option value={-1}>Select a question</option>
            {questions.map((q, i) => (
              <option key={q.question_id} value={i}>
                {i + 1}. {q.prompt.slice(0, 50)}
                {q.table_state ? ' [has table]' : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!selectedLesson}
          className="text-[12px] px-3 py-1.5 rounded disabled:opacity-40"
          style={{ background: '#07182C', border, color: muted }}
        >
          + Add question
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={questionIndex < 0 || saveStatus === 'busy'}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
          style={{ background: gold, color: '#07182C' }}
        >
          Save to staging
        </button>
        <button
          type="button"
          onClick={handlePromote}
          disabled={!saved || promoteStatus === 'busy'}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
          style={{ background: 'transparent', border: `1px solid ${gold}`, color: gold }}
          title={saved ? 'Publish to production' : 'Save to staging first'}
        >
          Promote to production
        </button>
      </div>

      {saveMsg && (
        <p className="text-[12px]" style={{ color: saveMsg.color }}>
          {saveMsg.text}
        </p>
      )}
      {promoteMsg && (
        <p className="text-[12px]" style={{ color: promoteMsg.color }}>
          {promoteMsg.text}
        </p>
      )}

      {modalOpen && (
        <AddQuestionModal
          tableState={tableState}
          busy={saveStatus === 'busy'}
          onClose={() => setModalOpen(false)}
          onCreate={(q) => void handleAddQuestion(q)}
        />
      )}
    </div>
  )
}
