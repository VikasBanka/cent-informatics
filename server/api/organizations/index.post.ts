import * as z from 'zod/mini'
import { OrganizationDraftSchema, OrganizationSchema } from '#shared/schemas/organization'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, OrganizationDraftSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid organization',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  let created: unknown
  try {
    created = await apiFetch(event, '/organizations', { method: 'POST', body: body.data })
  } catch (error) {
    // The API catches the slug collision on the column's UNIQUE constraint and
    // reports it as a 409 with a prose message. Reshaped here so the form can
    // render it against the slug field, exactly as it renders a 400.
    if ((error as { statusCode?: number })?.statusCode === 409) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Slug already in use',
        data: { slug: ['An organization with this slug already exists'] }
      })
    }
    throw error
  }

  setResponseStatus(event, 201)
  return readUpstream(OrganizationSchema, created)
})
