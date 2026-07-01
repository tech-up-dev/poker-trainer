import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AdminLayout } from './layout/AdminLayout'
import { RequireAuth } from './components/RequireAuth'
import { RequireSession } from './components/RequireSession'
import { GlossaryDrawerProvider } from './components/GlossaryDrawer'
import { ValidatorPage } from './pages/ValidatorPage'
import { LoginPage } from './pages/LoginPage'
import { BulkImport } from './components/BulkImport'
import { TipEditorPage } from './pages/TipEditorPage'
import { ReferenceEditorPage } from './pages/ReferenceEditorPage'
import { GlossaryEditorPage } from './pages/GlossaryEditorPage'
import { StagingBrowser } from './components/StagingBrowser'
import { TablePreviewPage } from './pages/TablePreviewPage'
import { TableBuilderPage } from './pages/TableBuilderPage'
import { AuthoringWizardPage } from './pages/AuthoringWizardPage'
import { MemberDashboardPage } from './pages/MemberDashboardPage'
import { LessonSessionPage } from './pages/LessonSessionPage'
import { SavedQuestionsPage } from './pages/SavedQuestionsPage'
import { SavedTipsPage } from './pages/SavedTipsPage'
import { ReferencesLibraryPage } from './pages/ReferencesLibraryPage'

// /login is public. /admin/* is Content Ops, gated by RequireAuth (admin only).
// /play/* is the member-facing app (table, quiz, glossary) gated by
// RequireSession (any signed-in account, since member entitlements land in M3).
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/table-preview', element: <TablePreviewPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin" replace /> },
          { path: 'admin', element: <ValidatorPage /> },
          { path: 'admin/import', element: <BulkImport /> },
          { path: 'admin/tips', element: <TipEditorPage /> },
          { path: 'admin/references', element: <ReferenceEditorPage /> },
          { path: 'admin/glossary', element: <GlossaryEditorPage /> },
          { path: 'admin/staging', element: <StagingBrowser /> },
          { path: 'admin/table-builder', element: <TableBuilderPage /> },
          { path: 'admin/wizard', element: <AuthoringWizardPage /> },
          { path: '*', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },
  {
    element: <RequireSession />,
    children: [
      {
        path: '/play',
        element: <MemberDashboardPage />,
      },
      {
        path: '/play/lessons/:lessonId',
        element: (
          <GlossaryDrawerProvider>
            <LessonSessionPage />
          </GlossaryDrawerProvider>
        ),
      },
      {
        path: '/play/saved-questions',
        element: (
          <GlossaryDrawerProvider>
            <SavedQuestionsPage />
          </GlossaryDrawerProvider>
        ),
      },
      { path: '/play/saved-tips', element: <SavedTipsPage /> },
      { path: '/play/references', element: <ReferencesLibraryPage /> },
    ],
  },
])
