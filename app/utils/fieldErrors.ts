import * as z from 'zod/mini'

/** The `data` payload the API routes attach to a `createError`. */
const FieldErrors = z.record(z.string(), z.array(z.string()))

/**
 * Pulls the per-field messages out of a failed `$fetch`, so a 400 from a route
 * lands on the same inputs the client-side parse would have flagged. Nitro nests
 * our payload one level down, under `error.data.data`.
 *
 * Returns `null` when the failure carried no field errors — a network drop, a
 * 500, or any response we have no business rendering against a field.
 */
export function fieldErrorsFrom(error: unknown) {
  const parsed = FieldErrors.safeParse((error as { data?: { data?: unknown } })?.data?.data)
  return parsed.success ? parsed.data : null
}
