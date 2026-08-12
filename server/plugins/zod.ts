import * as z from 'zod/mini'

// Mirrors app/plugins/zod.ts so server-only entry points get real messages too.
export default defineNitroPlugin(() => {
  z.config(z.locales.en())
})