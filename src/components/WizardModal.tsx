import type { JSX } from 'react'

import { AuthoringWizardPage } from '../pages/AuthoringWizardPage'

// Opens the existing Authoring Wizard inside a pop-up over the Table Builder, so
// authors can create a new lesson without navigating away and losing the built
// table. The card is pinned to the top of the viewport with its own capped
// height + internal scroll (so it is always in view without scrolling the page),
// and min-w-0 + overflow-x-hidden keep wide inner content from bleeding off-screen
// on mobile. Closing refreshes the caller's lesson list.
export function WizardModal({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4"
      style={{ background: 'rgba(3,10,20,0.85)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl min-w-0 max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-2xl p-4 sm:p-6"
        style={{ background: '#07182C', border: '1px solid #2a5079' }}
        onClick={(e) => e.stopPropagation()}
      >
        <AuthoringWizardPage embedded onExit={onClose} />
      </div>
    </div>
  )
}
