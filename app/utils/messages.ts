import * as z from 'zod/mini'

/** The `data` payload a route attaches when the failure is a list of complaints. */
const Messages = z.object({ messages: z.array(z.string()) })

/**
 * Pulls the per-file messages out of a failed `$fetch`, so a batch rejected by
 * the API reports every file that was wrong — the same way a batch rejected by
 * the page's own parse does. Nitro nests our payload one level down, under
 * `error.data.data`.
 *
 * The companion to `fieldErrorsFrom()`: that one is for a form whose messages
 * belong on named inputs, this one for a request whose messages belong in a
 * list. Returns `null` when the failure carried neither.
 */
export function messagesFrom(error: unknown) {
  const parsed = Messages.safeParse((error as { data?: { data?: unknown } })?.data?.data)
  return parsed.success ? parsed.data.messages : null
}
