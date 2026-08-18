import type { H3Event } from 'h3'
import * as z from 'zod/mini'

/**
 * The bridge to the cent-informatics FastAPI service, which owns the data.
 *
 * Every `/api` route in this app validates its own input with the schemas in
 * `#shared/schemas`, forwards the parsed body through here, and validates what
 * comes back. The browser never reaches the service directly — so it needs no
 * CORS policy, no public origin, and the app keeps one error shape at its edge
 * whatever the service does at its own.
 *
 * The service speaks camelCase on the wire (`serialize_by_alias` on its
 * `ApiModel`), which is what the shared schemas already expect, so nothing is
 * renamed in either direction.
 */

/** The verbs the service exposes. */
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface ApiRequest {
  method?: Method
  /**
   * Already parsed by the caller's schema — never a raw request body. A
   * `FormData` carries files the caller has parsed as files; ofetch forwards it
   * as multipart rather than JSON-encoding it.
   */
  body?: Record<string, unknown> | FormData
}

/** A `HTTPException` body: one message the caller can read. */
const MessageDetail = z.string()

/**
 * A FastAPI 422 body: one entry per rejected field, `loc` naming where the value
 * sat in the request — `["body", "firstName"]` for a field, `["body"]` alone for
 * a body that was the wrong shape entirely.
 */
const IssueDetail = z.array(
  z.object({
    loc: z.array(z.union([z.string(), z.number()])),
    msg: z.string()
  })
)

/**
 * A detail that is a list of complaints rather than one message or one per
 * field — what the files endpoints send, so a batch reports every file that was
 * wrong instead of stopping at the first.
 *
 * Both spellings normalise to one string apiece: the service names the file in
 * `fileName` when the complaint is about a file rather than about the batch, and
 * `name — message` is the same line the analysis page writes for a file its own
 * parse rejected.
 */
const FileMessage = z.pipe(
  z.object({ fileName: z.nullable(z.string()), message: z.string() }),
  z.transform((issue) => (issue.fileName ? `${issue.fileName} — ${issue.message}` : issue.message))
)

const MessageListDetail = z.array(z.union([z.string(), FileMessage]))

/** Only the envelope: which flavour of `detail` it holds is decided below. */
const UpstreamError = z.object({ detail: z.unknown() })

/**
 * Reshapes the service's issues into the per-field record `fieldErrorsFrom()`
 * reads on the client, so a rejection from the service lands on the same inputs
 * a local parse failure would have flagged.
 *
 * Returns `null` when no issue named a field — an issue about the body as a
 * whole has nowhere to render, and a caller that got `null` should fall back to
 * a message about the request rather than show the user an empty form error.
 */
function fieldErrorsFrom(issues: z.infer<typeof IssueDetail>): Record<string, string[]> | null {
  const fields: Record<string, string[]> = {}

  for (const issue of issues) {
    // Drop the leading segment: it names the part of the request (`body`,
    // `query`, `path`), not the field. What remains is the field itself.
    const field = issue.loc.slice(1).join('.')
    if (!field) continue

    fields[field] ??= []
    fields[field].push(issue.msg)
  }

  return Object.keys(fields).length ? fields : null
}

/**
 * Turns a failed upstream request into the error this app's own routes throw.
 *
 * A 422 from the service arrives as our 400: both mean "the values were wrong",
 * and the client renders them against the same fields. Everything else keeps its
 * status, since the service already decided what a 404 or a 409 means.
 */
function translated(error: unknown) {
  const failure = error as { status?: number; data?: unknown }

  // No status means no response: the service is down, unreachable, or dropped
  // the connection. That is this app's failure to report, not the caller's.
  if (!failure?.status) {
    return createError({
      statusCode: 502,
      statusMessage: 'The informatics API is unreachable'
    })
  }

  const envelope = UpstreamError.safeParse(failure.data)
  const detail: unknown = envelope.success ? envelope.data.detail : null

  // One prose message: the service already wrote the sentence to show.
  const message = MessageDetail.safeParse(detail)
  if (message.success) {
    return createError({ statusCode: failure.status, statusMessage: message.data })
  }

  // Per-field issues. Tried before the message list because an entry carrying
  // `loc`/`msg` is FastAPI's own shape and belongs on the fields it names.
  const issues = IssueDetail.safeParse(detail)
  if (issues.success) {
    const fields = fieldErrorsFrom(issues.data)
    if (fields) {
      return createError({
        statusCode: 400,
        statusMessage: 'Invalid request',
        data: fields
      })
    }
  }

  // A list of complaints, each already a line the caller can render. The status
  // is kept: a 409 over duplicate files is not the same answer as a 422 over
  // unusable ones, and the page distinguishes them.
  const messages = MessageListDetail.safeParse(detail)
  if (messages.success && messages.data.length) {
    return createError({
      statusCode: failure.status,
      statusMessage: 'The informatics API rejected the request',
      data: { messages: messages.data }
    })
  }

  return createError({
    statusCode: failure.status,
    statusMessage: 'The informatics API rejected the request'
  })
}

/**
 * Calls the service and returns its raw payload. Pass the result through
 * `readUpstream()` before returning it — this deliberately hands back `unknown`
 * so a route cannot forward an unvalidated response by accident.
 */
export async function apiFetch(
  event: H3Event,
  path: string,
  request: ApiRequest = {}
): Promise<unknown> {
  const { apiBaseUrl } = useRuntimeConfig(event)

  try {
    return await $fetch(path, { baseURL: apiBaseUrl, ...request })
  } catch (error) {
    throw translated(error)
  }
}

/**
 * Calls the service for a response that is bytes rather than a model — a file
 * download, which has no schema to validate against and must not be JSON-parsed
 * on the way through.
 *
 * Returns the whole response, not just the body, because the headers are the
 * point: the service decides the file's `Content-Type` and the name in its
 * `Content-Disposition`, and the route forwards both.
 */
export async function apiFetchBytes(event: H3Event, path: string) {
  const { apiBaseUrl } = useRuntimeConfig(event)

  try {
    // The type argument is not inferred from `responseType`, so it is named here
    // — without it the body lands as `{}` and cannot be read as bytes.
    return await $fetch.raw<ArrayBuffer>(path, {
      baseURL: apiBaseUrl,
      responseType: 'arrayBuffer'
    })
  } catch (error) {
    throw translated(error)
  }
}

/**
 * Validates a payload from the service against the schema the rest of the app is
 * typed against.
 *
 * A mismatch is the service's fault rather than the caller's, so it is a 502 and
 * not a 500 — and it surfaces here, naming the field, instead of downstream as a
 * component rendering `undefined`.
 */
export function readUpstream<T extends z.core.$ZodType>(schema: T, payload: unknown): z.infer<T> {
  // The top-level `z.safeParse()` rather than the method, so this accepts any
  // schema in the shared folder without naming a Mini-specific type here.
  const parsed = z.safeParse(schema, payload)
  if (!parsed.success) {
    // Server-side only: the detail describes our schema, which the client has no
    // use for and no way to act on.
    console.error('Malformed response from the informatics API:\n', z.prettifyError(parsed.error))
    throw createError({
      statusCode: 502,
      statusMessage: 'Malformed response from the informatics API'
    })
  }

  return parsed.data
}

/** Route params, shared by every route that addresses a single record. */
export const IdParams = z.object({ id: z.uuid() })
