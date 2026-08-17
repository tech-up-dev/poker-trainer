import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import { BookOpen, HelpCircle, BookText, Plus, ChevronRight, Tag, Users, Settings } from 'lucide-react'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchAllGlossaryEntries } from '../lib/glossary'
import { ConfirmDialog } from '../components/ConfirmDialog'

const WIZARD_DRAFT_KEY = 'bss_wizard_draft'

export function AdminDashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [glossaryCount, setGlossaryCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  function handleNewLesson(): void {
    let hasDraft = false
    try {
      const raw = sessionStorage.getItem(WIZARD_DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw) as {
          title?: string
          principleTag?: string
          concept?: string
          completedQuestions?: unknown[]
        }
        hasDraft = Boolean(
          d.title?.trim() ||
          d.principleTag?.trim() ||
          d.concept?.trim() ||
          (d.completedQuestions?.length ?? 0) > 0,
        )
      }
    } catch { /* ignore */ }
    if (hasDraft) {
      setShowDiscardConfirm(true)
    } else {
      navigate('/admin/wizard', { state: { newLesson: true } })
    }
  }

  useEffect(() => {
    Promise.all([
      fetchAllPublishedLessons(),
      fetchAllGlossaryEntries(),
    ])
      .then(([allLessons, glossaryTerms]) => {
        setLessons(allLessons)
        setGlossaryCount(glossaryTerms.length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalQuestions = lessons.reduce((sum, l) => sum + l.questions.length, 0)

  const stats = [
    { label: 'Total Lessons',   value: lessons.length,  icon: BookOpen,   color: 'text-gold'    },
    { label: 'Questions',       value: totalQuestions,  icon: HelpCircle, color: 'text-link'    },
    { label: 'Glossary Terms',  value: glossaryCount,   icon: BookText,   color: 'text-success' },
  ]

  return (
    <>
    <ConfirmDialog
      open={showDiscardConfirm}
      title="Discard unsaved lesson?"
      message="You have a lesson draft in progress. Starting a new lesson will permanently discard it."
      confirmLabel="Discard and start new"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => {
        setShowDiscardConfirm(false)
        navigate('/admin/wizard', { state: { newLesson: true } })
      }}
      onCancel={() => {
        setShowDiscardConfirm(false)
        navigate('/admin/wizard')
      }}
    />
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-gold mb-1">
            Admin · Content Ops
          </p>
          <h1 className="text-3xl font-bold text-ink">Content Studio</h1>
          <p className="text-ink-2 mt-1">Create and manage your learning content</p>
        </div>
        <button
          type="button"
          onClick={handleNewLesson}
          className="btn-primary shrink-0"
        >
          <Plus className="w-5 h-5" />
          New Lesson
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex flex-col gap-2">
            <stat.icon className={`w-6 h-6 ${stat.color}`} />
            <p className="text-3xl font-bold text-ink">
              {loading ? '-' : stat.value}
            </p>
            <p className="text-sm text-ink-3">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Admin tools */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Concept Vocabulary', description: 'Manage topic tags for lessons and questions', icon: Tag, path: '/admin/concepts' },
          { label: 'Entitlements', description: 'Grant or revoke quiz access by user email', icon: Users, path: '/admin/entitlements' },
          { label: 'App Settings', description: 'Result tiers, leak thresholds and more', icon: Settings, path: '/admin/settings' },
        ].map((tool) => (
          <button
            key={tool.path}
            type="button"
            onClick={() => navigate(tool.path)}
            className="card text-left hover:bg-surface-overlay transition-colors"
          >
            <tool.icon className="w-5 h-5 text-gold mb-2" />
            <p className="text-sm font-semibold text-ink">{tool.label}</p>
            <p className="text-xs text-ink-3 mt-0.5">{tool.description}</p>
          </button>
        ))}
      </div>

      {/* Recent activity */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Recent Activity</h2>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-sm text-gold hover:text-amber transition-colors"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <p className="text-sm text-ink-3">Loading…</p>
        )}

        {!loading && lessons.length === 0 && (
          <div className="text-center py-10">
            <BookOpen className="w-10 h-10 text-ink-3 mx-auto mb-3" />
            <p className="text-ink font-medium">No lessons published yet</p>
            <p className="text-sm text-ink-3 mt-1">Create your first lesson using the wizard.</p>
          </div>
        )}

        {!loading && lessons.length > 0 && (
          <div className="space-y-2">
            {lessons.slice(0, 8).map((lesson) => (
              <div
                key={lesson.lesson_id ?? lesson.title}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {lesson.seq != null ? <span className="text-ink-3 mr-1">#{lesson.seq}</span> : null}
                      {lesson.title}
                    </p>
                    <p className="text-xs text-ink-3">
                      {lesson.difficulty ?? 'General'} · {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="badge-success text-xs shrink-0 ml-3">Published</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
