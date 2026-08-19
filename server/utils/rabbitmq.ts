import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { connect, type ConfirmChannel, type RecoveringChannelModel } from 'amqplib'
import type { H3Event } from 'h3'
import * as z from 'zod/mini'
import { AnalysisEventSchema, type AnalysisEvent } from '#shared/schemas/analysis'

/**
 * The bridge to RabbitMQ, which owns the work queue.
 *
 * The counterpart to `api.ts`: that one forwards a request the caller waits on,
 * this one hands work to something that will run later. Only `server/` reaches
 * either — the browser posts to an `/api` route, and the broker URL never leaves
 * the server.
 *
 * One connection and one channel are shared by every request in the process.
 * Opening either is a multi-round-trip handshake, so doing it per publish would
 * cost more than the publish, and a broker holds a connection open for exactly
 * this reason.
 */

/**
 * The broker URL, validated as a URL rather than as a string so a value that is
 * missing, still the placeholder from another variable, or an `http://` address
 * pasted by mistake is caught before amqplib is handed it.
 *
 * Nothing derived from this value is ever put in a response or a log: the
 * userinfo half of an AMQP URL is a password.
 */
const BrokerUrl = z.url({ protocol: /^amqps?$/ })

/**
 * Where analysis requests are published. Durable, so what is queued outlives a
 * broker restart, and published through the default exchange — a routing key
 * equal to the queue name is the whole binding, so there is no exchange to keep
 * in step with a consumer that does not exist yet.
 */
const QUEUE = 'analysis.requests'

/**
 * How long a request will wait on the broker before giving up on it.
 *
 * amqplib's recovery retries an unreachable broker for as long as the process
 * lives, which is what we want of the *connection* — but it also means the
 * promise for a first connection never rejects, so without a deadline of our own
 * a publish would hang until the client gave up. Each step gets this deadline;
 * the retrying carries on in the background either way, so the request after it
 * succeeds as soon as the broker is back.
 */
const TIMEOUT_MS = 5_000

/**
 * What to log about a broker failure. The message only, never the error object:
 * amqplib does not put the URL on its errors, and this keeps it that way even if
 * a future version starts to.
 *
 * amqplib raises some of its recovery failures as an `Error` with an empty
 * message, which would otherwise log as a bare label with nothing after it.
 */
function reason(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'no reason given by the broker'
}

/** Pending until the first successful connection, then settled for the process. */
let connection: Promise<RecoveringChannelModel> | null = null

/** Kept for shutdown, which cannot await a connection that may never open. */
let broker: RecoveringChannelModel | null = null

/** Dropped whenever the channel or the connection under it goes away. */
let channel: Promise<ConfirmChannel> | null = null

function openConnection(url: string): Promise<RecoveringChannelModel> {
  if (connection) return connection

  // `recovery` puts the reconnect loop — backoff, jitter, unbounded retries — in
  // amqplib rather than here, so a broker that goes away comes back on its own.
  // The model it returns is a stable wrapper that survives every reconnect,
  // which is why it can be cached for the life of the process.
  const opening: Promise<RecoveringChannelModel> = connect(url, { recovery: true })
    .then((model) => {
      broker = model

      // A recovered connection is a *new* connection, and amqplib recovers only
      // the connection: every channel opened on the old one died with it, so the
      // cached channel has to go with it.
      model.on('disconnect', () => {
        channel = null
      })

      // Recovery emits its failures rather than throwing them, and an
      // EventEmitter with no `error` listener throws — so both are logged here,
      // where the reason is still visible, rather than crashing the server.
      model.on('error', (error: Error) => {
        console.error('RabbitMQ connection error:', reason(error))
      })
      model.on('connect-failed', (error: Error) => {
        console.error('Could not connect to RabbitMQ:', reason(error))
      })

      return model
    })
    .catch((error: unknown) => {
      // Only reachable if recovery gives up or the model is closed — with the
      // default unbounded retries it keeps trying instead. Clearing the cache
      // means a later request starts a fresh attempt rather than awaiting a
      // promise that will never settle.
      if (connection === opening) connection = null
      throw error
    })

  connection = opening
  return opening
}

function confirmChannel(model: RecoveringChannelModel): Promise<ConfirmChannel> {
  if (channel) return channel

  // A *confirm* channel, so a 202 from the route means the broker took
  // responsibility for the message rather than that we managed to write to a
  // socket. Without confirms a publish is fire-and-forget at the protocol level
  // too, and a message lost in the broker would look like a success here.
  const opening: Promise<ConfirmChannel> = model
    .createConfirmChannel()
    .then(async (created) => {
      // Guarded against the identity of this promise: a channel closing after a
      // newer one has been cached must not clear the newer one.
      const forget = () => {
        if (channel === opening) channel = null
      }
      created.on('close', forget)
      created.on('error', (error: Error) => {
        console.error('RabbitMQ channel error:', reason(error))
        forget()
      })

      // Asserted on every channel, which means after every reconnect too. The
      // consumer may not have been written yet, and the default exchange drops a
      // message routed to a queue that does not exist — silently, and even with
      // confirms, because the broker did accept it.
      await created.assertQueue(QUEUE, { durable: true })
      return created
    })
    .catch((error: unknown) => {
      if (channel === opening) channel = null
      throw error
    })

  channel = opening
  return opening
}

/**
 * Bounds one step of a publish. `work` is left running when the deadline wins —
 * a connection attempt that is still retrying is worth keeping, and the timer is
 * cleared either way so it cannot hold the event loop open.
 */
function withTimeout<T>(work: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), TIMEOUT_MS)
  })

  return Promise.race([work, deadline]).finally(() => clearTimeout(timer))
}

function send(ready: ConfirmChannel, payload: AnalysisEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    // The boolean return is backpressure — the write buffer is full — not a
    // failure: the message is buffered and the callback still fires when the
    // broker confirms it, which is the only signal worth waiting on.
    ready.sendToQueue(
      QUEUE,
      Buffer.from(JSON.stringify(payload)),
      {
        // Survives a broker restart, which a durable queue alone does not give
        // you: the queue would come back empty.
        persistent: true,
        contentType: 'application/json',
        // So a consumer can recognise a message it has already handled — a
        // confirmed publish can still be delivered twice.
        messageId: randomUUID()
      },
      (error: unknown) => (error ? reject(error) : resolve())
    )
  })
}

/**
 * Publishes one analysis request and resolves once the broker has confirmed it.
 *
 * Throws the error the calling route should surface: a 500 when this app is
 * misconfigured, a 503 when the broker is the problem. Neither carries a reason
 * from the broker — that names our infrastructure, not anything the caller sent
 * or could fix — so the detail is logged instead.
 */
export async function publishAnalysisRequest(
  event: H3Event,
  message: AnalysisEvent
): Promise<void> {
  const { rabbitmqUrl } = useRuntimeConfig(event)

  const url = BrokerUrl.safeParse(rabbitmqUrl)
  if (!url.success) {
    // Deliberately says nothing about the value it rejected.
    console.error('NUXT_RABBITMQ_URL is not a usable amqp:// or amqps:// URL')
    throw createError({
      statusCode: 500,
      statusMessage: 'The analysis queue is not configured',
      data: { messages: ['Analysis is unavailable because the queue is not configured.'] }
    })
  }

  // The queue is a boundary, so what goes onto it is parsed on the way out —
  // a consumer can then rely on the shape rather than on this route's types.
  const payload = AnalysisEventSchema.safeParse(message)
  if (!payload.success) {
    console.error(
      'Refusing to publish a malformed analysis event:\n',
      z.prettifyError(payload.error)
    )
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not queue that analysis',
      data: { messages: ['Could not queue that analysis.'] }
    })
  }

  try {
    const model = await withTimeout(openConnection(url.data), 'Timed out connecting to RabbitMQ')
    const ready = await withTimeout(confirmChannel(model), 'Timed out opening a RabbitMQ channel')
    await withTimeout(send(ready, payload.data), 'RabbitMQ did not confirm the message')
  } catch (error) {
    console.error('Could not queue an analysis request:', reason(error))
    throw createError({
      statusCode: 503,
      statusMessage: 'The analysis queue is unreachable',
      data: { messages: ['Could not reach the analysis queue. Please try again.'] }
    })
  }
}

/**
 * Closes the connection on shutdown, which also stops recovery from reconnecting
 * on the way out. Called from `server/plugins/rabbitmq.ts`.
 *
 * The resolved model is used rather than the cached promise: with the broker down
 * that promise may never settle, and awaiting it would hang shutdown.
 */
export async function closeRabbitmq(): Promise<void> {
  const model = broker
  broker = null
  connection = null
  channel = null

  if (!model) return

  try {
    await model.close()
  } catch (error) {
    // Shutting down; a connection that cannot be closed cleanly is being torn
    // down by the process exiting anyway.
    console.error('Could not close the RabbitMQ connection:', reason(error))
  }
}
