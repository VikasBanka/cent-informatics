export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file id' })
  }

  await apiFetch(event, `/files/${params.data.id}`, { method: 'DELETE' })

  setResponseStatus(event, 204)
  return null
})
