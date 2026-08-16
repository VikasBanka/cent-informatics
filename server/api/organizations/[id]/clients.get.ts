import * as z from 'zod/mini'
import { ClientRecordSchema } from '#shared/schemas/client'

const ClientList = z.array(ClientRecordSchema)

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid organization id' })
  }

  // The API looks the organization up before listing, so an unknown one is a 404
  // rather than an empty list — "no clients" and "no such organization" are
  // different answers and the caller has to be able to tell them apart.
  return readUpstream(
    ClientList,
    await apiFetch(event, `/organizations/${params.data.id}/clients`)
  )
})
