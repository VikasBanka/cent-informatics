import * as z from 'zod/mini'

/**
 * The bookkeeping columns every stored record carries. Written by the API, never
 * submitted — so these belong on the record schemas only, never on a draft.
 *
 * The API writes both from a single timestamp per request, which is why a freshly
 * created record has `createdAt === updatedAt` exactly rather than approximately.
 */

/**
 * `offset: true` widens the default, which accepts a `Z` suffix and nothing
 * else. The API sends `Z` today, but the value comes from a Postgres `timestamptz`
 * — read back under a non-UTC session it would serialise as `+05:30`, which the
 * default would reject. Sub-second precision is accepted either way.
 */
const Timestamp = z.iso.datetime({ offset: true })

export const timestamps = {
  createdAt: Timestamp,
  updatedAt: Timestamp
}
