import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AdminLayout } from './layout/AdminLayout'
import { MemberLayout } from './layout/MemberLayout'
import { RequireAuth } from './components/RequireAuth'
import { RequireSession } from './components/RequireSession'
import { GlossaryDrawerProvider } from './components/GlossaryDrawer'
import { ValidatorPage } from './pages/ValidatorPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { BulkImport } from './components/BulkImport'
import { StagingBrowser } from './components/StagingBrowser'
import { TablePreviewPage } from './pages/TablePreviewPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { TableBuilderPage } from './pages/TableBuilderPage'
import { AuthoringWizardPage } from './pages/AuthoringWizardPage'
import { MemberDashboardPage } from './pages/MemberDashboardPage'
import { LessonsPage } from './pages/LessonsPage'
import { LessonSessionPage } from './pages/LessonSessionPage'
import { ProfilePage } from './pages/ProfilePage'
import { GlossaryPage } from './pages/GlossaryPage'
import { StatsPage } from './pages/StatsPage'
import { SavedQuestionsPage } from './pages/SavedQuestionsPage'
import { SavedTipsPage } from './pages/SavedTipsPage'
import { ReferencesLibraryPage } from './pages/ReferencesLibraryPage'
import { CheckoutSuccessPage } from './pages/CheckoutSuccessPage'
import { OnboardingPage } from './pages/OnboardingPage'

// /login is public. /admin/* is Content Ops, gated by RequireAuth (admin only).
// /play/* is the member-facing app (table, quiz, glossary) gated by
// RequireSession (any signed-in account, since member entitlements land in M3).
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
          { path: 'admin/tips', element: <Navigate to="/admin?tab=tip" replace /> },
          { path: 'admin/references', element: <Navigate to="/admin?tab=reference" replace /> },
          { path: 'admin/glossary', element: <Navigate to="/admin?tab=glossary" replace /> },
          { path: 'admin/staging', element: <StagingBrowser /> },
          { path: 'admin/table-builder', element: <TableBuilderPage /> },
          { path: 'admin/wizard', element: <GlossaryDrawerProvider><AuthoringWizardPage /></GlossaryDrawerProvider> },
          { path: '*', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },
  {
    element: <RequireSession />,
    children: [
      {
        element: <MemberLayout />,
        children: [
          { path: '/play',                  element: <MemberDashboardPage /> },
          { path: '/play/lessons',          element: <LessonsPage /> },
          { path: '/play/glossary',         element: <GlossaryPage /> },
          { path: '/play/library',          element: <ReferencesLibraryPage /> },
          { path: '/play/stats',            element: <StatsPage /> },
          { path: '/play/profile',          element: <ProfilePage /> },
          { path: '/play/saved-questions',  element: <GlossaryDrawerProvider><SavedQuestionsPage /></GlossaryDrawerProvider> },
          { path: '/play/saved-tips',       element: <SavedTipsPage /> },
          { path: '/play/references',       element: <ReferencesLibraryPage /> },
          { path: '/play/checkout/success', element: <CheckoutSuccessPage /> },
        ],
      },
      // Onboarding is full-screen — outside MemberLayout
      { path: '/onboarding', element: <OnboardingPage /> },
      // Lesson session is full-screen — outside MemberLayout so the nav doesn't show
      {
        path: '/play/lessons/:lessonId',
        element: (
          <GlossaryDrawerProvider>
            <LessonSessionPage />
          </GlossaryDrawerProvider>
        ),
      },
    ],
  },
])
