import * as z from 'zod/mini'
import {
  ANALYSIS_UPLOAD_MAX_BODY_BYTES,
  AnalysisFileListSchema,
  FileRecordListSchema
} from '#shared/schemas/analysis'

/**
 * The declared body size. Checked before anything is read, so a caller that
 * ignores the batch rules cannot make the server buffer an arbitrary body just
 * to be told the files were unusable.
 *
 * A guard, not a guarantee: `Content-Length` is absent on a chunked request, and
 * a hard ceiling on the request itself belongs at the reverse proxy. This stops
 * the honest oversized upload, which is the one that actually happens.
 */
const BodySize = z.pipe(
  z.coerce.number(),
  z.int().check(
    z.lte(ANALYSIS_UPLOAD_MAX_BODY_BYTES, {
      error: 'That upload is larger than this endpoint accepts'
    })
  )
)

export default defineEventHandler(async (event) => {
  const declared = getRequestHeader(event, 'content-length')
  if (declared !== undefined) {
    const size = BodySize.safeParse(declared)
    if (!size.success) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Upload too large',
        data: { messages: [size.error.issues[0]?.message ?? 'That upload is too large'] }
      })
    }
  }

  const parts = await readMultipartFormData(event)

  // Only the `files` field, and only the parts that are files — a part with no
  // filename is a plain form field, whatever it was named.
  const uploaded: File[] = []
  for (const part of parts ?? []) {
    if (part.name !== 'files' || part.filename === undefined) continue
    uploaded.push(new File([part.data], part.filename, { type: part.type }))
  }

  // The same schema the drop zone parses with, so this route and the page cannot
  // disagree about what may be uploaded. The API validates a third time, from
  // the bytes it actually received.
  const batch = AnalysisFileListSchema.safeParse(uploaded)
  if (!batch.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file selection',
      // One line per rejected file, named — the shape the page renders, and the
      // one the API's own rejections arrive in. `path[0]` is the index in the
      // batch, which is what names the file that failed.
      data: {
        messages: batch.error.issues.map((issue) => {
          const index = issue.path[0]
          const file = typeof index === 'number' ? uploaded[index] : undefined
          return file ? `${file.name} — ${issue.message}` : issue.message
        })
      }
    })
  }

  const form = new FormData()
  for (const file of batch.data) form.append('files', file)

  const created = await apiFetch(event, '/files', { method: 'POST', body: form })

  setResponseStatus(event, 201)
  return readUpstream(FileRecordListSchema, created)
})
