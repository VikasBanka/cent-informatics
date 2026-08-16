import * as z from 'zod/mini'
import { OrganizationSummarySchema } from '#shared/schemas/organization'

const OrganizationList = z.array(OrganizationSummarySchema)

export default defineEventHandler(async (event) =>
  readUpstream(OrganizationList, await apiFetch(event, '/organizations'))
)
