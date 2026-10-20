import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Cloudflare Turnstile site keys are about 24 characters; secret keys are 35. A
// VITE_ variable is copied into the public JavaScript, so a secret pasted here
// would be published to every visitor. Stop the build instead (the value is never
// printed, so it does not end up in build logs either).
const SECRET_KEY_MIN_LENGTH = 30

export default defineConfig(({ mode }) => {
  const siteKey = loadEnv(mode, process.cwd(), 'VITE_').VITE_TURNSTILE_SITE_KEY ?? ''
  if (siteKey.length >= SECRET_KEY_MIN_LENGTH) {
    throw new Error(
      `VITE_TURNSTILE_SITE_KEY is ${siteKey.length} characters long, which looks like a Turnstile SECRET key. ` +
        'Use the public Site key from the Cloudflare widget (about 24 characters). ' +
        'Variables starting with VITE_ are published in the website code. Build stopped.',
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    server: {
      port: process.env.PORT ? Number(process.env.PORT) : 5174,
      strictPort: true,
    },
  }
})
