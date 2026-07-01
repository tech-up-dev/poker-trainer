import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../lib/auth-context'
import { supabaseProd } from '../lib/supabase-prod'

export function MemberHeader(): JSX.Element {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  const email = session?.user?.email ?? ''

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function handleLogout(): Promise<void> {
    setOpen(false)
    await supabaseProd.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-semibold text-ink">Beat Small Stakes</h1>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-ink-2 hover:text-ink transition-colors max-w-[180px] truncate"
          aria-label="Account menu"
        >
          {email}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-40 bg-elevated border border-line rounded-xl shadow-lg overflow-hidden z-10">
            <Link
              to="/play/profile"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-ink hover:bg-surface transition-colors"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-sm text-ink hover:bg-surface transition-colors border-t border-line"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
