import type { JSX } from 'react'

import { AuthoringWizardPage } from '../pages/AuthoringWizardPage'

// Opens the existing Authoring Wizard inside a scrollable pop-up over the Table
// Builder, so authors can create a new lesson without navigating away and losing
// the built table. Closing refreshes the caller's lesson list.
export function WizardModal({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(3,10,20,0.85)' }}
    >
      <div className="min-h-full flex items-start justify-center p-4">
        <div
          className="w-full max-w-3xl rounded-2xl p-6 my-6"
          style={{ background: '#07182C', border: '1px solid #2a5079' }}
        >
          <AuthoringWizardPage embedded onExit={onClose} />
        </div>
      </div>
    </div>
  )
}
