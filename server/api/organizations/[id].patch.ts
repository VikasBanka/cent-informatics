import * as z from 'zod/mini'
import { OrganizationEditSchema } from '#shared/schemas/organization'

const Params = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, Params.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid organization id' })
  }

  // A `slug` in the body is dropped here, not rejected: the schema has no such
  // key, so the update can only ever touch the editable fields.
  const body = await readValidatedBody(event, OrganizationEditSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid organization',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  const organization = updateOrganization(params.data.id, body.data)
  if (!organization) {
    throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  }

  return organization
})
