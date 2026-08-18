import { FileRecordListSchema } from '#shared/schemas/analysis'

export default defineEventHandler(async (event) =>
  readUpstream(FileRecordListSchema, await apiFetch(event, '/files'))
)
