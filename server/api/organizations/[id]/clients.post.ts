import * as z from 'zod/mini'
import { ClientDraftSchema, ClientRecordSchema } from '#shared/schemas/client'

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid organization id' })
  }

  const body = await readValidatedBody(event, ClientDraftSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid client',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  // The owner comes from the URL, never the body — all the way down: the API's
  // own draft model has no `organizationId` either.
  const created = await apiFetch(event, `/organizations/${params.data.id}/clients`, {
    method: 'POST',
    body: body.data
  })

  setResponseStatus(event, 201)
  return readUpstream(ClientRecordSchema, created)
})
