import { RouterProvider } from 'react-router-dom'

import { AuthProvider } from './lib/auth'
import { PwaShell } from './components/PwaShell'
import { router } from './router'

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <PwaShell />
    </AuthProvider>
  )
}

export default App
