import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AdminLayout } from './layout/AdminLayout'
import { ValidatorPage } from './pages/ValidatorPage'
import { BulkImport } from './components/BulkImport'

// Admin-only routes for now. The member-facing app (table, quiz, glossary) gets
// its own routes once the design direction lands; this is the Content Ops shell.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin" replace /> },
      { path: 'admin', element: <ValidatorPage /> },
      { path: 'admin/import', element: <BulkImport /> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
])
