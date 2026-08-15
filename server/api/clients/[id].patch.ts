import * as z from 'zod/mini'
import { ClientDraftSchema } from '#shared/schemas/client'

const Params = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, Params.safeParse)
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

  const client = updateClient(params.data.id, body.data)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  return client
})
