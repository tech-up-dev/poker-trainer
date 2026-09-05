import { useCallback, useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'

import type { GlossaryEntry } from '../../shared/schemas/glossary'
import { getGlossaryEntryById, getGlossaryEntryByTerm } from '../lib/glossary'
import {
  GlossaryDrawerContext,
  useGlossaryDrawer,
} from '../lib/glossary-drawer-context'

type DrawerStatus = 'closed' | 'loading' | 'ready' | 'error'

type DrawerState = {
  status: DrawerStatus
  stack: GlossaryEntry[]
  errorMessage: string | null
}

// Renamed per Steve M3 QA #42 (2026-08-26): the two-tier importance model.
// 'general' replaces 'core'; 'controlled_chaos' replaces 'useful' (and the
// former 'situational' rows were merged into it by the accompanying migration).
const IMPORTANCE_LABEL: Record<NonNullable<GlossaryEntry['importance']>, string> =
  {
    general: 'General',
    controlled_chaos: 'Controlled Chaos',
  }

const IMPORTANCE_CLASS: Record<NonNullable<GlossaryEntry['importance']>, string> =
  {
    general: 'bg-gold text-on-gold',
    controlled_chaos: 'bg-elevated text-ink',
  }

// Hosts the glossary drawer's nesting/back-stack state and renders the drawer
// itself. Mount once near the app root; any descendant calls useGlossaryDrawer()
// (typically via <GlossaryTerm>) to open it.
export function GlossaryDrawerProvider({
  children,
}: {
  children: ReactNode
}): JSX.Element {
  const [state, setState] = useState<DrawerState>({
    status: 'closed',
    stack: [],
    errorMessage: null,
  })

  const openTerm = useCallback((term: string) => {
    setState({ status: 'loading', stack: [], errorMessage: null })
    void getGlossaryEntryByTerm(term).then(
      (entry) => {
        if (entry === null) {
          setState({
            status: 'error',
            stack: [],
            errorMessage: `No glossary entry found for "${term}".`,
          })
          return
        }
        setState({ status: 'ready', stack: [entry], errorMessage: null })
      },
      (err: unknown) => {
        setState({
          status: 'error',
          stack: [],
          errorMessage: err instanceof Error ? err.message : 'Failed to load.',
        })
      },
    )
  }, [])

  const pushRelatedTerm = useCallback((termId: string) => {
    setState((current) => ({ ...current, status: 'loading' }))
    void getGlossaryEntryById(termId).then(
      (entry) => {
        if (entry === null) {
          setState((current) => ({
            ...current,
            status: 'error',
            errorMessage: 'That related term could not be found.',
          }))
          return
        }
        setState((current) => ({
          status: 'ready',
          stack: [...current.stack, entry],
          errorMessage: null,
        }))
      },
      (err: unknown) => {
        setState((current) => ({
          ...current,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Failed to load.',
        }))
      },
    )
  }, [])

  const back = useCallback(() => {
    setState((current) => {
      if (current.stack.length <= 1) return current
      return { ...current, stack: current.stack.slice(0, -1) }
    })
  }, [])

  const close = useCallback(() => {
    setState({ status: 'closed', stack: [], errorMessage: null })
  }, [])

  return (
    <GlossaryDrawerContext.Provider
      value={{ openTerm, pushRelatedTerm, back, close }}
    >
      {children}
      <GlossaryDrawer state={state} onBack={back} onClose={close} />
    </GlossaryDrawerContext.Provider>
  )
}

function GlossaryDrawer({
  state,
  onBack,
  onClose,
}: {
  state: DrawerState
  onBack: () => void
  onClose: () => void
}): JSX.Element | null {
  const isOpen = state.status !== 'closed'

  // #53: lock body scroll while the drawer is open. On iOS Safari a scrollable
  // background causes the OS to route taps to the scroll system for several
  // seconds, which swallows the drawer's button taps (same root cause as the
  // #51 FeedbackDrawer fix). position:fixed is required for iOS to honour it.
  // Guard: if an outer drawer (the feedback drawer, when a glossary term is
  // tapped inside an explanation) has already locked the body, do nothing, so
  // closing this drawer does not release the outer lock or reset its scroll.
  useEffect(() => {
    if (!isOpen) return
    if (document.body.style.position === 'fixed') return
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  if (!isOpen) return null

  const depth = state.stack.length
  const current = depth > 0 ? state.stack[depth - 1] : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close glossary"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={current ? `Glossary: ${current.term}` : 'Glossary'}
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-8 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          {depth > 1 ? (
            <button
              type="button"
              onClick={onBack}
              className="min-h-11 min-w-11 px-3 rounded-full text-sm font-medium text-ink bg-elevated hover:bg-line"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 rounded-full text-lg font-medium text-ink bg-elevated hover:bg-line"
          >
            ✕
          </button>
        </div>

        {state.status === 'loading' ? (
          <p className="text-ink-2 text-base py-6 text-center">Loading…</p>
        ) : null}

        {state.status === 'error' ? (
          <p className="text-error text-base py-6 text-center">
            {state.errorMessage}
          </p>
        ) : null}

        {state.status === 'ready' && current ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold text-ink">{current.term}</h2>
              {current.importance ? (
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${IMPORTANCE_CLASS[current.importance]}`}
                >
                  {IMPORTANCE_LABEL[current.importance]}
                </span>
              ) : null}
            </div>

            <p className="text-base text-ink leading-relaxed">
              {current.definition}
            </p>

            {current.example ? (
              <div>
                <h3 className="text-sm font-semibold text-ink-2 mb-1">
                  Example
                </h3>
                <p className="text-base text-ink leading-relaxed">
                  {current.example}
                </p>
              </div>
            ) : null}

            {current.usage ? (
              <div>
                <h3 className="text-sm font-semibold text-ink-2 mb-1">
                  Usage
                </h3>
                <p className="text-base text-ink leading-relaxed">
                  {current.usage}
                </p>
              </div>
            ) : null}

            {current.related_terms && current.related_terms.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-ink-2 mb-2">
                  Related terms
                </h3>
                <div className="flex flex-wrap gap-2">
                  {current.related_terms.map((termId) => (
                    <RelatedTermLink key={termId} termId={termId} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function RelatedTermLink({ termId }: { termId: string }): JSX.Element {
  const { pushRelatedTerm } = useGlossaryDrawer()
  const [label, setLabel] = useState(termId)

  useEffect(() => {
    let cancelled = false
    void getGlossaryEntryById(termId).then((entry) => {
      if (!cancelled && entry) setLabel(entry.term)
    })
    return () => {
      cancelled = true
    }
  }, [termId])

  return (
    <button
      type="button"
      onClick={() => pushRelatedTerm(termId)}
      className="min-h-11 px-3.5 rounded-full text-sm font-medium text-link border border-line bg-canvas hover:bg-elevated"
    >
      {label}
    </button>
  )
}
