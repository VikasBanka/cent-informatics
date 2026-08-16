import { OrganizationSchema } from '#shared/schemas/organization'

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid organization id' })
  }

  // An unknown id is the API's 404, forwarded as-is.
  return readUpstream(
    OrganizationSchema,
    await apiFetch(event, `/organizations/${params.data.id}`)
  )
})
