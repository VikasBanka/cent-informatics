import * as z from 'zod/mini'
import { OrganizationEditSchema, OrganizationSchema } from '#shared/schemas/organization'

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid organization id' })
  }

  // A `slug` in the body is dropped here, not rejected: the schema has no such
  // key, so the update can only ever carry the editable fields upstream.
  const body = await readValidatedBody(event, OrganizationEditSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid organization',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  return readUpstream(
    OrganizationSchema,
    await apiFetch(event, `/organizations/${params.data.id}`, {
      method: 'PUT',
      body: body.data
    })
  )
})
