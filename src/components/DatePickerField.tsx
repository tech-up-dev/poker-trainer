import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { Calendar } from 'lucide-react'

function parseIso(v: string): Date | undefined {
  const [y, m, d] = v.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}

function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function DatePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = parseIso(value)

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="input w-full flex items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={selected ? 'text-ink' : 'text-ink-3'}>
          {selected ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pick a date'}
        </span>
        <Calendar className="w-4 h-4 text-ink-3 shrink-0" />
      </button>
      {open && (
        <div className="themed-day-picker absolute left-0 top-full mt-2 z-50 rounded-xl border border-line bg-surface shadow-xl p-3">
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) onChange(toIso(d))
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
