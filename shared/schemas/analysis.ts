import * as z from 'zod/mini'
import { timestamps } from './record'

/**
 * Single source of truth for the files the analysis page accepts. The drop zone
 * and the upload route that receives them both read from here, so the two can
 * never disagree about what is allowed.
 */

/**
 * The formats, as the API stores them: a lowercased extension without its dot.
 * The list the API's `FILE_FORMATS` carries, and the one its
 * `file_metadata_file_format_known` CHECK constraint repeats.
 */
export const ANALYSIS_FILE_FORMATS = ['csv', 'tsv', 'txt', 'xls', 'xlsx', 'json'] as const

/**
 * Doubles as the input's `accept` list, so the file picker offers exactly what
 * the schema will let through. Derived, so adding a format is one edit above.
 */
export const ANALYSIS_FILE_EXTENSIONS = ANALYSIS_FILE_FORMATS.map((format) => `.${format}`)

const MAX_KILOBYTES = 25

export const ANALYSIS_FILE_MAX_BYTES = MAX_KILOBYTES * 1024

/** The size limit as UI copy, so a message and the check cannot drift apart. */
export const ANALYSIS_FILE_MAX_LABEL = `${MAX_KILOBYTES} KB`

/** How many files may be uploaded in one batch. */
export const ANALYSIS_FILE_MAX_COUNT = 10

export const ANALYSIS_FILE_ACCEPT = ANALYSIS_FILE_EXTENSIONS.join(',')

/**
 * The extension is what we check, not the MIME type: browsers report
 * inconsistent — and for CSV exports often empty — types for the spreadsheet
 * formats this page is built around, so `z.mime()` would reject valid files.
 */
export const AnalysisFileSchema = z.file().check(
  z.refine((file) => file.size > 0, { error: 'That file is empty' }),
  z.maxSize(ANALYSIS_FILE_MAX_BYTES, {
    error: `File must be ${ANALYSIS_FILE_MAX_LABEL} or smaller`
  }),
  z.refine(
    (file) => ANALYSIS_FILE_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension)),
    { error: `Unsupported file type. Use ${ANALYSIS_FILE_EXTENSIONS.join(', ')}` }
  )
)

/**
 * A batch. The count rule belongs to the collection rather than to any single
 * file, so it lives here — the page parses the list it has assembled instead of
 * counting by hand, and the upload route will parse the same shape.
 */
export const AnalysisFileListSchema = z.array(AnalysisFileSchema).check(
  z.minLength(1, { error: 'Choose at least one file' }),
  z.maxLength(ANALYSIS_FILE_MAX_COUNT, {
    error: `Up to ${ANALYSIS_FILE_MAX_COUNT} files can be uploaded at once`
  })
)

/**
 * A ceiling for the whole multipart request, checked against `Content-Length`
 * before the upload route buffers a body. The batch limit above bounds the
 * files themselves; this bounds what an unbounded caller can make the server
 * hold in memory to find that out. The slack covers the multipart framing —
 * boundaries, per-part headers — around the files.
 */
export const ANALYSIS_UPLOAD_MAX_BODY_BYTES =
  ANALYSIS_FILE_MAX_BYTES * ANALYSIS_FILE_MAX_COUNT + 64 * 1024

/**
 * Where a stored file is in ingest. Uploading records the bytes and nothing
 * more, so a file starts at `uploaded` with its shape still unknown; whatever
 * parses it later moves it on.
 */
export const ANALYSIS_FILE_STATUSES = ['uploaded', 'parsing', 'ready', 'failed'] as const

/**
 * A stored file, as the API returns it. Metadata only — the bytes are fetched
 * separately, from `/api/files/{id}/content`.
 *
 * Everything from `rowCount` down is null until the file has been parsed, which
 * is why each is nullable rather than optional: the API always sends the key.
 */
export const FileRecordSchema = z.object({
  id: z.uuid(),
  fileName: z.string().check(z.minLength(1)),
  fileFormat: z.enum(ANALYSIS_FILE_FORMATS),
  fileSizeBytes: z.int().check(z.positive()),
  checksumSha256: z.string().check(z.regex(/^[0-9a-f]{64}$/)),
  status: z.enum(ANALYSIS_FILE_STATUSES),
  errorMessage: z.nullable(z.string()),
  rowCount: z.nullable(z.int().check(z.nonnegative())),
  columnCount: z.nullable(z.int().check(z.positive())),
  hasHeader: z.nullable(z.boolean()),
  delimiter: z.nullable(z.string()),
  encoding: z.nullable(z.string()),
  sheetName: z.nullable(z.string()),
  ...timestamps
})

export const FileRecordListSchema = z.array(FileRecordSchema)

/**
 * What a batch delete submits. A JSON body rather than repeated query params,
 * so the ids are parsed as the array they are — the API's own route takes
 * `?id=&id=`, and the route here builds that from this.
 */
export const FileDeleteSchema = z.object({
  ids: z.array(z.uuid()).check(z.minLength(1, { error: 'Choose at least one file to delete' }))
})

/**
 * The statistics the analysis panel can ask for — one button apiece in
 * `AnalysisDrawer`, and the `analysisType` the queued message carries. Adding a
 * statistic is this one edit: the panel renders the list, and the route and the
 * message both validate against it.
 *
 * The members double as their own button labels, capitalised in CSS, so there is
 * no second list of display names to keep in step.
 */
export const ANALYSIS_TYPES = ['summary', 'mean', 'median', 'mode', 'variance'] as const

export const AnalysisTypeSchema = z.enum(ANALYSIS_TYPES)

/**
 * What the panel posts to ask for one statistic. The file is named in the path,
 * so only the type travels in the body.
 */
export const AnalysisRequestSchema = z.object({
  analysisType: AnalysisTypeSchema
})

/**
 * The message published to the analysis queue.
 *
 * Its own schema rather than the request's: a queue is a boundary like any
 * other, and what a consumer reads is this shape — not whichever HTTP body
 * happened to trigger it. `requestedAt` is stamped by the publisher, so a
 * message that sat in the queue still says when it was asked for.
 */
export const AnalysisEventSchema = z.object({
  fileId: z.uuid(),
  analysisType: AnalysisTypeSchema,
  requestedAt: z.iso.datetime()
})

export type AnalysisFile = z.infer<typeof AnalysisFileSchema>
export type AnalysisFileList = z.infer<typeof AnalysisFileListSchema>
export type FileRecord = z.infer<typeof FileRecordSchema>
export type AnalysisType = z.infer<typeof AnalysisTypeSchema>
export type AnalysisEvent = z.infer<typeof AnalysisEventSchema>
