import * as z from 'zod/mini'
import { ClientDraftSchema, ClientRecordSchema } from '#shared/schemas/client'

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid client id' })
  }

  // An `organizationId` in the body is dropped here, not rejected: the draft
  // schema has no such key, so an edit can never reassign the owner.
  const body = await readValidatedBody(event, ClientDraftSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid client',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  return readUpstream(
    ClientRecordSchema,
    await apiFetch(event, `/clients/${params.data.id}`, { method: 'PUT', body: body.data })
  )
})
