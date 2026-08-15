import { LUCIDE_CONTEXT, useLucideProps } from '@lucide/vue'

// @lucide/vue declares `LucideIconsContext` but doesn't export it, so derive the
// same shape from the accessor it does export.
type LucideIconsContext = ReturnType<typeof useLucideProps>

// Project-wide icon defaults. Lucide ships size 24 / stroke 2, which is heavier
// than this UI wants. absoluteStrokeWidth keeps the stroke a true 1px at any
// size — without it the stroke scales with the icon and thins out as it shrinks.
//
// Provided on the Vue app rather than in app.vue so error.vue, which renders
// outside the app.vue tree, inherits the same defaults.
const lucideDefaults: LucideIconsContext = {
  size: 16,
  strokeWidth: 1,
  absoluteStrokeWidth: true
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.provide(LUCIDE_CONTEXT, lucideDefaults)
})
