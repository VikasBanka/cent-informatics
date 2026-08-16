export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid organization id' })
  }

  // Deleting an organization deletes every client it owns — the cascade belongs
  // to the foreign key in the API's schema, so there is nothing to clean up here.
  await apiFetch(event, `/organizations/${params.data.id}`, { method: 'DELETE' })

  setResponseStatus(event, 204)
  return null
})
