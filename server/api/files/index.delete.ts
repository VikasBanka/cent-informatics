import * as z from 'zod/mini'
import { FileDeleteSchema } from '#shared/schemas/analysis'

/**
 * Delete several files at once. All-or-nothing: the API deletes them in one
 * transaction and 404s naming any id that did not exist, leaving the rest in
 * place — so a stale id in the selection removes nothing rather than some of it.
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, FileDeleteSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file ids',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  // The API's own route takes repeated query params. The ids are parsed uuids
  // by now, so the encoding is belt and braces rather than the thing keeping
  // this safe.
  const query = body.data.ids.map((id) => `id=${encodeURIComponent(id)}`).join('&')
  await apiFetch(event, `/files?${query}`, { method: 'DELETE' })

  setResponseStatus(event, 204)
  return null
})
