import * as z from 'zod/mini'

// Zod Mini does not auto-load the English locale — without this every default
// message is the bare string "Invalid input".
export default defineNuxtPlugin(() => {
  z.config(z.locales.en())
})