import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import { Bookmark, Lightbulb, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import type { Reference } from '../../shared/schemas/reference'
import type { Lesson, Question } from '../../shared/schemas/lesson'
import type { Tip } from '../../shared/schemas/tip'
import { fetchAllPublishedReferences } from '../lib/references'
import { fetchPublishedLesson } from '../lib/lessons'
import { fetchSavedQuestionRefs, unsaveQuestion } from '../lib/saved-questions'
import { fetchAllPublishedTips } from '../lib/tips'
import { fetchSavedTipIds, unsaveTip } from '../lib/saved-tips'
import { linkifyGlossaryTerms } from '../lib/glossary-text'

const TABS = [
  { id: 'saved',      label: 'Saved Questions', icon: Bookmark  },
  { id: 'tips',       label: 'Saved Tips',       icon: Lightbulb },
  { id: 'references', label: 'References',        icon: FileText  },
]

const CATEGORY_LABEL: Record<string, string> = {
  cheat_sheet:       'Cheat Sheets',
  character_mapping: 'Character Mapping',
  methodology:       'Methodology',
}
const CATEGORY_ORDER = ['cheat_sheet', 'character_mapping', 'methodology']

function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(raw)
}

type SavedEntry = { lesson: Lesson; question: Question }

function ReferenceCard({ entry }: { entry: Reference }): JSX.Element {
  const [open, setOpen] = useState(true)
  const html = open ? renderMarkdown(entry.body_markdown) : ''

  return (
    <div className="card p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-3 hover:bg-surface-overlay transition-colors"
      >
        <span className="text-sm font-semibold text-ink">{entry.title}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-ink-3 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-ink-3 shrink-0" />
        }
      </button>
      {open && (
        <div className="border-t border-line px-5 py-4">
          <div className="prose-reference" dangerouslySetInnerHTML={{ __html: html }} />
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {entry.tags.map((tag) => (
                <span key={tag} className="badge-muted text-xs">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ReferencesLibraryPage(): JSX.Element {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('saved')

  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([])
  const [savedLoading, setSavedLoading] = useState(true)

  const [tips, setTips] = useState<Tip[]>([])
  const [tipsLoading, setTipsLoading] = useState(true)

  const [references, setReferences] = useState<Reference[]>([])
  const [refsLoading, setRefsLoading] = useState(true)

  useEffect(() => {
    async function loadSaved(): Promise<void> {
      const refs = await fetchSavedQuestionRefs()
      if (refs.length === 0) { setSavedEntries([]); return }
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
      setSavedEntries(resolved)
    }
    loadSaved().catch(() => setSavedEntries([])).finally(() => setSavedLoading(false))
  }, [])

  useEffect(() => {
    async function loadTips(): Promise<void> {
      const ids = await fetchSavedTipIds()
      if (ids.length === 0) { setTips([]); return }
      const all = await fetchAllPublishedTips()
      const tipMap = new Map(all.map((t) => [t.tip_id, t]))
      setTips(ids.flatMap((id) => (tipMap.has(id) ? [tipMap.get(id)!] : [])))
    }
    loadTips().catch(() => setTips([])).finally(() => setTipsLoading(false))
  }, [])

  useEffect(() => {
    fetchAllPublishedReferences()
      .then(setReferences)
      .catch(() => setReferences([]))
      .finally(() => setRefsLoading(false))
  }, [])

  function handleRemoveQuestion(lessonId: string | undefined, questionId: string | undefined): void {
    if (!lessonId || !questionId) return
    setSavedEntries((prev) =>
      prev.filter((e) => !(e.lesson.lesson_id === lessonId && e.question.question_id === questionId)),
    )
    unsaveQuestion(lessonId, questionId).catch(() => {})
  }

  function handleRemoveTip(tipId: string | undefined): void {
    if (!tipId) return
    setTips((prev) => prev.filter((t) => t.tip_id !== tipId))
    unsaveTip(tipId).catch(() => {})
  }

  const grouped = new Map<string, Reference[]>()
  for (const ref of references) {
    const key = ref.category ?? 'other'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(ref)
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.filter((k) => grouped.has(k)),
    ...(grouped.has('other') ? ['other'] : []),
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-2">Library</h1>
        <p className="text-lg text-ink-2">Your saved content and references</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'text-gold border-gold'
                : 'text-ink-3 border-transparent hover:text-ink'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] sm:text-sm leading-tight text-center">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Saved Questions */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedLoading && <p className="text-ink-3 text-sm">Loading…</p>}

          {!savedLoading && savedEntries.length === 0 && (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 text-ink-3 mx-auto mb-4" />
              <p className="text-ink font-medium">No saved questions yet</p>
              <p className="text-sm text-ink-3 mt-1">
                Tap "Save for later" inside any lesson's feedback to bookmark a question here.
              </p>
            </div>
          )}

          {savedEntries.map(({ lesson, question }) => {
            const correctAnswer = question.answers.find((a) => a.is_correct)
            return (
              <div key={`${lesson.lesson_id}-${question.question_id}`} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold text-gold uppercase tracking-widest">
                    {lesson.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(lesson.lesson_id, question.question_id)}
                    className="text-xs text-ink-3 hover:text-error shrink-0 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-sm font-medium text-ink leading-relaxed">
                  {linkifyGlossaryTerms(question.prompt, question.glossary_terms)}
                </p>
                {correctAnswer && (
                  <div className="flex gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                    <span className="w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-success text-on-gold">
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
                  className="text-xs text-gold hover:text-amber transition-colors"
                >
                  Practice this lesson →
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Saved Tips */}
      {activeTab === 'tips' && (
        <div className="space-y-3">
          {tipsLoading && <p className="text-ink-3 text-sm">Loading…</p>}

          {!tipsLoading && tips.length === 0 && (
            <div className="text-center py-12">
              <Lightbulb className="w-12 h-12 text-ink-3 mx-auto mb-4" />
              <p className="text-ink font-medium">No saved tips yet</p>
              <p className="text-sm text-ink-3 mt-1">
                Tap "Save" on Today's Tip to keep it here for later reference.
              </p>
            </div>
          )}

          {tips.map((tip) => (
            <div key={tip.tip_id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-ink leading-snug">
                  {tip.concept ?? tip.principle_tag ?? 'Tip'}
                </h3>
                <button
                  type="button"
                  onClick={() => handleRemoveTip(tip.tip_id)}
                  className="text-xs text-ink-3 hover:text-error shrink-0 transition-colors"
                >
                  Remove
                </button>
              </div>
              <p className="text-sm text-ink-2 leading-relaxed">{tip.body}</p>
              {tip.principle_tag && (
                <span className="badge-muted">#{tip.principle_tag}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* References */}
      {activeTab === 'references' && (
        <div className="space-y-6">
          {refsLoading && <p className="text-ink-3 text-sm">Loading…</p>}

          {!refsLoading && references.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-ink-3 mx-auto mb-4" />
              <p className="text-ink font-medium">No references published yet</p>
              <p className="text-sm text-ink-3 mt-1">
                The client can add cheat sheets and methodology guides via the CMS.
              </p>
            </div>
          )}

          {orderedKeys.map((key) => (
            <div key={key} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gold">
                {CATEGORY_LABEL[key] ?? 'General'}
              </h2>
              {grouped.get(key)!.map((ref) => (
                <ReferenceCard key={ref.reference_id ?? ref.title} entry={ref} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
