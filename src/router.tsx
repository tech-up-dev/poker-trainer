import { createBrowserRouter, Navigate } from 'react-router-dom'

import { MemberLayout } from './layout/MemberLayout'
import { RequireAuth } from './components/RequireAuth'
import { RequireSession } from './components/RequireSession'
import { GlossaryDrawerProvider } from './components/GlossaryDrawer'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { TablePreviewPage } from './pages/TablePreviewPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { MemberDashboardPage } from './pages/MemberDashboardPage'
import { LessonsPage } from './pages/LessonsPage'
import { LessonSessionPage } from './pages/LessonSessionPage'
import { GlossaryPage } from './pages/GlossaryPage'
import { ProfilePage } from './pages/ProfilePage'
import { StatsPage } from './pages/StatsPage'
import { SavedQuestionsPage } from './pages/SavedQuestionsPage'
import { SavedTipsPage } from './pages/SavedTipsPage'
import { ReferencesLibraryPage } from './pages/ReferencesLibraryPage'
import { CheckoutSuccessPage } from './pages/CheckoutSuccessPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProTrainingPage } from './pages/ProTrainingPage'
import { DrillSessionPage } from './pages/DrillSessionPage'
import { SubscribePage } from './pages/SubscribePage'

// /login is public. /admin/* is Content Ops, gated by RequireAuth (admin only).
// /play/* is the member-facing app (table, quiz, glossary) gated by
// RequireSession (any signed-in account, since member entitlements land in M3).
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/subscribe', element: <SubscribePage /> },
  { path: '/play/checkout/success', element: <CheckoutSuccessPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/table-preview', element: <TablePreviewPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/admin/verify', lazy: async () => ({ Component: (await import('./pages/AdminMfaChallengePage')).AdminMfaChallengePage }) },
      {
        path: '/',
        lazy: async () => ({ Component: (await import('./layout/AdminLayout')).AdminLayout }),
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'admin/dashboard', lazy: async () => ({ Component: (await import('./pages/AdminDashboardPage')).AdminDashboardPage }) },
          { path: 'admin', lazy: async () => ({ Component: (await import('./pages/ValidatorPage')).ValidatorPage }) },
          { path: 'admin/import', lazy: async () => ({ Component: (await import('./components/BulkImport')).BulkImport }) },
          { path: 'admin/tips', element: <Navigate to="/admin?tab=tip" replace /> },
          { path: 'admin/references', element: <Navigate to="/admin?tab=reference" replace /> },
          { path: 'admin/glossary', element: <Navigate to="/admin?tab=glossary" replace /> },
          { path: 'admin/staging', lazy: async () => ({ Component: (await import('./components/StagingBrowser')).StagingBrowser }) },
          { path: 'admin/table-builder', lazy: async () => ({ Component: (await import('./pages/TableBuilderPage')).TableBuilderPage }) },
          { path: 'admin/wizard', lazy: async () => { const { AuthoringWizardPage } = await import('./pages/AuthoringWizardPage'); return { element: <GlossaryDrawerProvider><AuthoringWizardPage fullscreen /></GlossaryDrawerProvider> } } },
          { path: 'admin/pro-training', lazy: async () => ({ Component: (await import('./pages/ProTrainingAdminPage')).ProTrainingAdminPage }) },
          { path: 'admin/settings',     lazy: async () => ({ Component: (await import('./pages/AppSettingsAdminPage')).AppSettingsAdminPage }) },
          { path: 'admin/concepts',     lazy: async () => ({ Component: (await import('./pages/ConceptsAdminPage')).ConceptsAdminPage }) },
          { path: 'admin/entitlements', lazy: async () => ({ Component: (await import('./pages/EntitlementsAdminPage')).EntitlementsAdminPage }) },
          { path: 'admin/security', lazy: async () => ({ Component: (await import('./pages/AdminSecurityPage')).AdminSecurityPage }) },
          { path: 'admin/members',     lazy: async () => ({ Component: (await import('./pages/AdminMembersPage')).AdminMembersPage }) },
          { path: '*', element: <Navigate to="/admin/dashboard" replace /> },
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
          { path: '/play/skills-path',      element: <Navigate to="/play/lessons" replace /> },
          { path: '/play/glossary',         element: <GlossaryPage /> },
          { path: '/play/library',          element: <GlossaryDrawerProvider><ReferencesLibraryPage /></GlossaryDrawerProvider> },
          { path: '/play/stats',            element: <StatsPage /> },
          { path: '/play/profile',          element: <ProfilePage /> },
          { path: '/play/saved-questions',  element: <GlossaryDrawerProvider><SavedQuestionsPage /></GlossaryDrawerProvider> },
          { path: '/play/saved-tips',       element: <SavedTipsPage /> },
          { path: '/play/references',       element: <GlossaryDrawerProvider><ReferencesLibraryPage /></GlossaryDrawerProvider> },
          { path: '/play/courses',           element: <ProTrainingPage /> },
          { path: '/play/pro-training',      element: <Navigate to="/play/courses" replace /> },
          { path: '/play/drill',            element: <GlossaryDrawerProvider><DrillSessionPage /></GlossaryDrawerProvider> },
        ],
      },
      // Onboarding is full-screen - outside MemberLayout
      { path: '/onboarding', element: <OnboardingPage /> },
      // Lesson session: header-only layout so theme toggle is accessible
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
