import { ClientRecordSchema } from '#shared/schemas/client'

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid client id' })
  }

  // A client is already uniquely identified by its own id, so this route does not
  // carry the owning organization the way the collection route does.
  return readUpstream(ClientRecordSchema, await apiFetch(event, `/clients/${params.data.id}`))
})
