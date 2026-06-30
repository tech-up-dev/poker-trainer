import type { JSX } from 'react'

import { GlossaryTerm } from '../components/GlossaryTerm'
import { ThemeToggle } from '../components/ThemeToggle'

// Temporary harness for verifying member-facing components as they land
// (M1: glossary drawer, MCQ + feedback, poker table). Gets replaced by the
// real member shell/routes once those pieces are built.
export function MemberHomePage(): JSX.Element {
  return (
    <div className="min-h-screen bg-canvas text-ink px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Beat Small Stakes</h1>
          <ThemeToggle />
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
          <p className="text-base leading-relaxed">
            Villain is a classic{' '}
            <GlossaryTerm term="Old Man Coffee">Old Man Coffee</GlossaryTerm>{' '}
            who only bets strong hands. Your decision should account for{' '}
            <GlossaryTerm term="Pot Odds">pot odds</GlossaryTerm> before you
            call.
          </p>
          <p className="text-base leading-relaxed">
            A <GlossaryTerm term="Y2K Tag">Y2K Tag</GlossaryTerm> or a{' '}
            <GlossaryTerm term="GTO Boy">GTO Boy</GlossaryTerm> would play
            this very differently.
          </p>
        </div>
      </div>
    </div>
  )
}
