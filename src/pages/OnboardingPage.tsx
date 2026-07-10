import { useState } from 'react'
import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Target, TrendingUp } from 'lucide-react'

const ONBOARDING_KEY = 'bss_onboarding_done'

// Placeholder focus areas, client swaps these for real topic names.
const FOCUS_AREAS = [
  'Pre-flop fundamentals',
  'Post-flop play',
  'Bet sizing',
  'Hand reading',
  'Bankroll management',
  'Tournament play',
]

type Step = 0 | 1 | 2 | 3

export function OnboardingPage(): JSX.Element {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null)

  function finish(): void {
    localStorage.setItem(ONBOARDING_KEY, '1')
    void navigate('/play/lessons/warm-up', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-8 pb-2">
        {([0, 1, 2, 3] as Step[]).map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-6 bg-gold' : i < step ? 'w-4 bg-gold/40' : 'w-4 bg-elevated'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-8">

          {/* ── Step 0: Welcome ──────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gold flex items-center justify-center shadow-raised">
                  <span className="text-4xl font-bold text-on-gold">B</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-ink">Welcome to Beat Small Stakes</h1>
                  <p className="text-ink-2 mt-2 leading-relaxed">
                    {/* [CLIENT COPY] Tagline / welcome message goes here */}
                    The fastest way to plug leaks, build confidence, and move up the stakes.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setStep(1)} className="btn-primary btn-lg w-full">
                Get started <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 1: How it works ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-ink">How it works</h2>
                <p className="text-sm text-ink-2">
                  {/* [CLIENT COPY] Subtitle */}
                  Three simple steps to sharper poker.
                </p>
              </div>

              <div className="space-y-4">
                <div className="card flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink text-sm">Study a concept</p>
                    <p className="text-ink-3 text-sm mt-0.5 leading-relaxed">
                      {/* [CLIENT COPY] */}
                      Each lesson focuses on one decision point with a clear explanation.
                    </p>
                  </div>
                </div>

                <div className="card flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink text-sm">Drill with questions</p>
                    <p className="text-ink-3 text-sm mt-0.5 leading-relaxed">
                      {/* [CLIENT COPY] */}
                      Answer scenario-based questions and get instant feedback on every choice.
                    </p>
                  </div>
                </div>

                <div className="card flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink text-sm">Track your progress</p>
                    <p className="text-ink-3 text-sm mt-0.5 leading-relaxed">
                      {/* [CLIENT COPY] */}
                      Build a streak, review missed questions, and watch your win rate climb.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(0)} className="btn-secondary flex-1">
                  Back
                </button>
                <button type="button" onClick={() => setStep(2)} className="btn-primary flex-1">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Pick a focus area ────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-ink">What do you want to work on?</h2>
                <p className="text-sm text-ink-2">
                  {/* [CLIENT COPY] */}
                  Pick a starting focus. You can explore all topics later.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {FOCUS_AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedFocus(area === selectedFocus ? null : area)}
                    className={selectedFocus === area ? 'chip-active' : 'chip-inactive'}
                  >
                    {area}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-primary flex-1"
                  disabled={selectedFocus === null}
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Ready ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="text-center space-y-4">
                <div className="text-5xl">🎯</div>
                <div>
                  <h2 className="text-xl font-bold text-ink">You're all set!</h2>
                  <p className="text-ink-2 mt-2 text-sm leading-relaxed">
                    {/* [CLIENT COPY] */}
                    Let's start with a short warm-up lesson to get you oriented. It takes about 3
                    minutes.
                  </p>
                </div>
              </div>

              <div className="card bg-gold/5 border border-gold/20 text-center space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold">Warm-up lesson</p>
                <p className="font-semibold text-ink text-sm">
                  {/* [CLIENT COPY] Warm-up lesson title */}
                  Poker Basics: How to Think About Decisions
                </p>
                <p className="text-xs text-ink-3">~3 min · 5 questions</p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1">
                  Back
                </button>
                <button type="button" onClick={finish} className="btn-primary flex-1">
                  Start lesson <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(ONBOARDING_KEY, '1')
                  void navigate('/play', { replace: true })
                }}
                className="w-full text-center text-sm text-ink-3 hover:text-ink-2 transition-colors py-1"
              >
                Skip and explore on my own
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
