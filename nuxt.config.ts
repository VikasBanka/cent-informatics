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
    apiBaseUrl: 'http://localhost:8000',
    /**
     * The RabbitMQ broker the analysis panel queues work on. Server-only, like
     * `apiBaseUrl` — and more so, because an AMQP URL carries its credentials in
     * the userinfo, which is why the default here has none.
     *
     * That default is a shape rather than a working broker: the API's
     * docker-compose replaces RabbitMQ's `guest` account with `RABBITMQ_USER`, so
     * a connection without credentials is refused. Set `NUXT_RABBITMQ_URL` to the
     * same `amqp://user:pass@host:5672/` the API service is given — see
     * `.env.example`.
     */
    rabbitmqUrl: 'amqp://localhost:15672'
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