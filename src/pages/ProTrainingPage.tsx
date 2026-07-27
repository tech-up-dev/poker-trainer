import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { supabaseProd } from '../lib/supabase-prod'

type Tone = 'amber' | 'teal' | 'violet' | 'blue'

type Course = {
  id: string
  eyebrow: string
  title: string
  description: string
  list_price: number
  member_price: number
  tone: Tone
  sales_url: string
  sort_order: number
}

const TONE: Record<Tone, { accent: string; bg: string; border: string; chip: string }> = {
  amber:  { accent: '#f5a623', bg: 'rgba(245,166,35,0.10)',  border: 'rgba(245,166,35,0.34)',  chip: 'rgba(245,166,35,0.16)'  },
  teal:   { accent: '#34d1bf', bg: 'rgba(52,209,191,0.10)',  border: 'rgba(52,209,191,0.32)',  chip: 'rgba(52,209,191,0.16)'  },
  violet: { accent: '#a78bfa', bg: 'rgba(167,139,250,0.11)', border: 'rgba(167,139,250,0.34)', chip: 'rgba(167,139,250,0.16)' },
  blue:   { accent: '#4aa3ff', bg: 'rgba(74,163,255,0.10)',  border: 'rgba(74,163,255,0.32)',  chip: 'rgba(74,163,255,0.16)'  },
}

function LockIcon({ size = 18 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0" />
    </svg>
  )
}

function ExternalIcon(): JSX.Element {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  )
}

function CourseCard({ course, isMember }: { course: Course; isMember: boolean }): JSX.Element {
  const t = TONE[course.tone]
  const discount = Math.round((1 - course.member_price / course.list_price) * 100)

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6 rounded-2xl"
      style={{ padding: '22px 24px', background: t.bg, border: `1px solid ${t.border}` }}
    >
      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="text-[11px] font-bold tracking-[0.8px] uppercase" style={{ color: t.accent }}>
          {course.eyebrow}
        </p>
        <h3 className="text-[19px] font-bold text-ink" style={{ margin: '6px 0 8px' }}>
          {course.title}
        </h3>
        <p className="text-[13.5px] leading-[1.55] text-ink-2" style={{ margin: '0 0 12px' }}>
          {course.description}
        </p>
        {isMember && (
          <span
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full"
            style={{ color: t.accent, background: t.chip, padding: '4px 10px' }}
          >
            <LockIcon size={13} />
            Member exclusive
          </span>
        )}
      </div>

      {/* Buy column */}
      {isMember ? (
        <div
          className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start sm:text-right shrink-0 sm:w-[210px]"
          style={{ gap: 4 }}
        >
          <div>
            <p className="text-[14px] text-ink-3 line-through">${course.list_price}</p>
            <p className="text-[26px] font-extrabold leading-none" style={{ color: t.accent }}>
              ${course.member_price}
              <span
                className="text-[11px] font-bold align-middle"
                style={{ background: t.accent, color: '#04121e', padding: '2px 7px', marginLeft: 8, borderRadius: 6 }}
              >
                {discount}% OFF
              </span>
            </p>
            <p className="text-[11px] text-ink-3" style={{ letterSpacing: '.3px', marginBottom: 8 }}>
              member price
            </p>
          </div>
          <a
            href={course.sales_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-[14px] whitespace-nowrap transition-opacity hover:opacity-90"
            style={{ background: t.accent, color: '#04121e', borderRadius: 10, padding: '11px 18px', textDecoration: 'none' }}
          >
            Order Now <ExternalIcon />
          </a>
        </div>
      ) : (
        <div
          className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start sm:text-right shrink-0 sm:w-[210px]"
          style={{ gap: 4 }}
        >
          <div>
            <p className="text-[17px] font-bold text-ink">${course.list_price}</p>
            <p className="text-[11px] text-ink-3" style={{ marginBottom: 8 }}>list price</p>
          </div>
          <button
            type="button"
            className="text-[13px] font-semibold text-ink-2 border border-line rounded-[10px] whitespace-nowrap hover:text-ink hover:border-ink-2 transition-colors"
            style={{ padding: '9px 14px' }}
          >
            Unlock member price
          </button>
        </div>
      )}
    </div>
  )
}

export function ProTrainingPage(): JSX.Element {
  const { hasAccess } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data } = await supabaseProd
        .from('pro_training_courses')
        .select('id, eyebrow, title, description, list_price, member_price, tone, sales_url, sort_order')
        .eq('enabled', true)
        .order('sort_order', { ascending: true })
      setCourses((data ?? []) as Course[])
      setLoading(false)
    })()
  }, [])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 48 }}>
      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <p className="text-[12px] font-bold tracking-[0.9px] uppercase text-gold">Pro Training</p>
        <h1 className="text-[30px] font-extrabold text-ink" style={{ margin: '6px 0 8px' }}>
          Take your game to the next level
        </h1>
        <p className="text-[14.5px] text-ink-2 leading-relaxed" style={{ maxWidth: 620, margin: 0 }}>
          Advanced courses hand-picked to build on what you're learning here - each one goes deeper than the core trainer.
        </p>
      </div>

      {/* Banner */}
      {hasAccess ? (
        <div
          className="flex items-center gap-3 text-[13.5px] text-ink-2"
          style={{ margin: '0 0 26px', padding: '14px 18px', borderRadius: 12, background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.42)' }}
        >
          <span className="shrink-0 text-gold"><LockIcon size={20} /></span>
          <span>
            Your active membership unlocks{' '}
            <strong className="text-ink">40% off every course below</strong>
            {' - the member price is already applied, no code needed.'}
          </span>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 text-sm text-ink-2 bg-surface border border-line"
          style={{ margin: '0 0 26px', padding: '14px 18px', borderRadius: 12 }}
        >
          <span className="shrink-0 text-ink-3"><LockIcon size={18} /></span>
          <span>
            <strong className="text-ink">Members save 40%</strong> on every course.{' '}
            <button
              type="button"
              onClick={() => navigate('/play/profile')}
              className="text-gold underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Subscribe to unlock member pricing →
            </button>
          </span>
        </div>
      )}

      {/* Course cards */}
      {loading ? (
        <p className="text-sm text-ink-3">Loading courses…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} isMember={hasAccess} />
          ))}
        </div>
      )}
    </div>
  )
}
