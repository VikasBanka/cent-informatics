import * as z from 'zod/mini'
import { ClientDraftSchema } from '#shared/schemas/client'

const Params = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, Params.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid organization id' })
  }

  if (!findOrganizationById(params.data.id)) {
    throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  }

  const body = await readValidatedBody(event, ClientDraftSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid client',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  // The owner comes from the URL, never the body.
  setResponseStatus(event, 201)
  return createClient(params.data.id, body.data)
})
