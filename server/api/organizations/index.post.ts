import * as z from 'zod/mini'
import { OrganizationDraftSchema } from '#shared/schemas/organization'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, OrganizationDraftSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid organization',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  // Shaped like the 400 above so the form can render it against the slug field.
  if (slugIsTaken(body.data.slug)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Slug already in use',
      data: { slug: ['An organization with this slug already exists'] }
    })
  }

  setResponseStatus(event, 201)
  return createOrganization(body.data)
})
