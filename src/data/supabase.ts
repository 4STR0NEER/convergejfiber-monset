// The one environment flag: demo mode (everything in this browser, seeded pitch data) unless Supabase is configured.
// supabase-js lives in ./supabaseClient and is only loaded outside demo mode.
const env = (import.meta.env ?? {}) as ImportMetaEnv // undefined when a Node script (seed) imports this
export const DEMO = env.VITE_DEMO_MODE === 'true' || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY

/** Converge staff single sign-on (Q40). Off until confirmed: VITE_SSO_PROVIDERS=google,azure */
export const SSO_PROVIDERS = String(env.VITE_SSO_PROVIDERS ?? '').split(',').map(s => s.trim())
  .filter((s): s is 'google' | 'azure' => s === 'google' || s === 'azure')

/** Arrived from an invitation or password-reset email link: ask for a password first. Read before supabase-js clears the hash. */
export const AUTH_LINK = DEMO ? null : (/[#&]type=(invite|recovery)\b/.exec(typeof location === 'undefined' ? '' : location.hash)?.[1] ?? null)
