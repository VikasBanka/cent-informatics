/**
 * The stored file itself, streamed back through this app so the browser never
 * needs the service's address.
 *
 * Nothing is validated on the way out: the body is the bytes that were
 * uploaded, which have no schema. What the service says about them — the type
 * and the filename — is forwarded as it stands.
 */
export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id' })
  }

  const upstream = await apiFetchBytes(event, `/files/${params.data.id}/content`)

  const body = upstream._data
  if (!body) {
    throw createError({
      statusCode: 502,
      statusMessage: 'The informatics API returned no file content'
    })
  }

  // Only these two headers: the rest of the upstream response describes that
  // connection, not this one.
  setResponseHeader(
    event,
    'content-type',
    upstream.headers.get('content-type') ?? 'application/octet-stream'
  )

  const disposition = upstream.headers.get('content-disposition')
  if (disposition) setResponseHeader(event, 'content-disposition', disposition)

  return new Uint8Array(body)
})
