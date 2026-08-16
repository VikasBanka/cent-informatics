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
  /** Already parsed by the caller's schema — never a raw request body. */
  body?: Record<string, unknown>
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

/** Both flavours of error body the service can send. */
const UpstreamError = z.object({ detail: z.union([MessageDetail, IssueDetail]) })

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

  const parsed = UpstreamError.safeParse(failure.data)
  const detail = parsed.success ? parsed.data.detail : null

  if (typeof detail === 'string') {
    return createError({ statusCode: failure.status, statusMessage: detail })
  }

  if (detail) {
    const fields = fieldErrorsFrom(detail)
    if (fields) {
      return createError({
        statusCode: 400,
        statusMessage: 'Invalid request',
        data: fields
      })
    }
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
