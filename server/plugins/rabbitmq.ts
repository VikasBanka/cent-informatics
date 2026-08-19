/**
 * Closes the shared RabbitMQ connection when Nitro shuts down.
 *
 * The connection is opened lazily by the first publish rather than here: it is
 * needed by one route, and a broker that is down must not stop the rest of the
 * app from booting. What it does need is a way out — amqplib's recovery would
 * otherwise keep reconnecting through a dev-server restart, leaking a connection
 * per reload.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    await closeRabbitmq()
  })
})
