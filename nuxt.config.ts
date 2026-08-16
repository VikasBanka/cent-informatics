import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    /**
     * The cent-informatics FastAPI service, which owns the data. Server-only —
     * it is deliberately outside `public`, so the base URL never reaches the
     * browser and every request goes out through a `/api` route in `server/`.
     * Override with `NUXT_API_BASE_URL`; the default matches the `API_PORT` in
     * the API's docker-compose.
     */
    apiBaseUrl: 'http://localhost:8000'
  },
  app: {
    head: {
      title: 'cent',
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
})