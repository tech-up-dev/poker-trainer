import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AdminLayout } from './layout/AdminLayout'
import { RequireAuth } from './components/RequireAuth'
import { ValidatorPage } from './pages/ValidatorPage'
import { LoginPage } from './pages/LoginPage'
import { BulkImport } from './components/BulkImport'
import { TipEditorPage } from './pages/TipEditorPage'
import { ReferenceEditorPage } from './pages/ReferenceEditorPage'

// /login is public; everything under the admin shell sits behind RequireAuth. The
// member-facing app (table, quiz, glossary) gets its own routes once the design
// direction lands.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
          { path: '*', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },
])
