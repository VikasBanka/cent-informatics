import * as z from 'zod/mini'

const Params = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, Params.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid organization id' })
  }

  if (!findOrganizationById(params.data.id)) {
    throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  }

  return listClientsByOrganization(params.data.id)
})
