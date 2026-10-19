export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

// When no site key is configured the check is off and forms behave as before.
export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY)
