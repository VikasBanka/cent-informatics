import * as z from 'zod/mini'
import { AnalysisRequestSchema, FileRecordSchema, type FileRecord } from '#shared/schemas/analysis'

/**
 * Queues one statistic for one stored file.
 *
 * 202, not 201: nothing has been computed and there is nothing to fetch yet —
 * the answer is only that the broker has taken the request. A body comes back
 * for the sake of reading it in devtools; the panel uses the status alone.
 */
export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, IdParams.safeParse)
  if (!params.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file id',
      data: { messages: ['That is not a file this app can analyse.'] }
    })
  }

  const body = await readValidatedBody(event, AnalysisRequestSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid analysis request',
      data: z.flattenError(body.error).fieldErrors
    })
  }

  // The message names a file a worker will go and read, so the file is confirmed
  // to exist before anything is published — a 404 the caller can act on now,
  // rather than a message that can only fail once something consumes it. The id
  // is taken from the response rather than the path so what is queued is what the
  // service actually holds.
  let file: FileRecord
  try {
    file = readUpstream(FileRecordSchema, await apiFetch(event, `/files/${params.data.id}`))
  } catch (error) {
    // The panel is opened from a list that may be minutes old, so the row behind
    // it can be gone by the time a button is pressed. That is a stale list rather
    // than something to retry, and saying so needs the shape the panel renders —
    // `apiFetch` puts the service's own wording in `statusMessage`, which the
    // panel does not read.
    if ((error as { statusCode?: number }).statusCode === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: 'That file is no longer stored',
        data: { messages: ['That file is no longer stored. Refresh the list and try again.'] }
      })
    }
    throw error
  }

  const queued = {
    fileId: file.id,
    analysisType: body.data.analysisType,
    requestedAt: new Date().toISOString()
  }

  await publishAnalysisRequest(event, queued)

  setResponseStatus(event, 202)
  return queued
})
