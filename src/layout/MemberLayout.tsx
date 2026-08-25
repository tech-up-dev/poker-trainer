import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import type { JSX } from 'react'

import { useAuth } from '../lib/auth-context'
import { Sidebar } from '../components/layout/Sidebar'
import { TopBar } from '../components/layout/TopBar'
import { MobileNav } from '../components/layout/MobileNav'

export function MemberLayout(): JSX.Element {
  const { hasAccess } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Authed users without an active entitlement land on /play/profile to subscribe
  // or reactivate. Show bare chrome so they don't see a sidebar full of locked nav
  // items — the nav implies they're inside the app when they haven't subscribed yet.
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col overflow-x-hidden w-full">
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col lg:flex-row overflow-x-hidden w-full">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </main>

        <MobileNav />
      </div>
    </div>
  )
}
