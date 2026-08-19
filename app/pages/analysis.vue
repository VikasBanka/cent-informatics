<script setup lang="ts">
import { ChartScatter, CloudUpload, Download, FileText, Trash2, X } from '@lucide/vue'
import {
  ANALYSIS_FILE_ACCEPT,
  ANALYSIS_FILE_EXTENSIONS,
  ANALYSIS_FILE_MAX_COUNT,
  ANALYSIS_FILE_MAX_LABEL,
  AnalysisFileListSchema,
  AnalysisFileSchema,
  FileRecordListSchema,
  type FileRecord
} from '#shared/schemas/analysis'

const input = useTemplateRef<HTMLInputElement>('input')
const toast = useTemplateRef<{ show: (message: string) => void }>('toast')

const files = ref<File[]>([])
/** One message per rejected file, so a bad file names itself. */
const errors = ref<string[]>([])

const totalSize = computed(() => files.value.reduce((sum, file) => sum + file.size, 0))

/** Enabled by the same schema the upload route will parse the batch with. */
const ready = computed(() => AnalysisFileListSchema.safeParse(files.value).success)

const accepts = ANALYSIS_FILE_EXTENSIONS.map((extension) => extension.slice(1).toUpperCase()).join(
  ', '
)

/**
 * A counter, not a boolean: `dragleave` fires every time the pointer crosses
 * into a child of the drop zone, so a flag would flicker off mid-drag.
 */
const dragDepth = ref(0)
const dragging = computed(() => dragDepth.value > 0)

/**
 * Two files can share a name — one per folder — so identity is the whole
 * fingerprint the browser gives us. Used to key rows and to ignore a file that
 * is already in the list.
 */
function identify(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/**
 * Selections accumulate: a second drop adds to the list rather than replacing
 * it, which is the only way to gather files that live in different folders.
 */
function add(candidates: FileList | null | undefined) {
  if (!candidates?.length) return

  const accepted = [...files.value]
  const seen = new Set(accepted.map(identify))
  const rejected: string[] = []

  for (const candidate of candidates) {
    const parsed = AnalysisFileSchema.safeParse(candidate)
    if (!parsed.success) {
      // Each file gets its own line, so one bad file does not hide the rest.
      rejected.push(`${candidate.name} — ${parsed.error.issues[0]?.message ?? 'cannot be used'}`)
      continue
    }

    // Re-picking a file already in the list is a no-op, not a failure.
    if (seen.has(identify(parsed.data))) continue

    seen.add(identify(parsed.data))
    accepted.push(parsed.data)
  }

  // How many files may travel together is a rule about the batch, so the batch
  // is parsed as one — the count is never counted by hand. An empty list is the
  // page's starting state rather than a rejected selection, so it is left to
  // `ready` to report.
  const batch = accepted.length ? AnalysisFileListSchema.safeParse(accepted) : undefined
  if (batch && !batch.success) {
    rejected.push(batch.error.issues[0]?.message ?? 'That selection cannot be used')
  }

  files.value = accepted.slice(0, ANALYSIS_FILE_MAX_COUNT)
  errors.value = rejected
}

function onChange(event: Event) {
  const picker = event.target as HTMLInputElement
  add(picker.files)
  // The picker reports no `change` when the same files are chosen again, so it
  // has to forget what it is holding or a re-pick after a remove goes
  // unnoticed. The files are already held in `files`.
  picker.value = ''
}

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  add(event.dataTransfer?.files)
}

function remove(target: File) {
  const id = identify(target)
  files.value = files.value.filter((file) => identify(file) !== id)
  errors.value = []
}

function clear() {
  files.value = []
  errors.value = []
  if (input.value) input.value.value = ''
}

const uploading = ref(false)

async function upload() {
  // Parsed once more on the way out. The list is only assembled through `add()`,
  // which parses too, but this is the batch that actually travels — and the same
  // schema runs again on the route and a third time in the API, from the bytes
  // it received rather than the ones the browser described.
  const batch = AnalysisFileListSchema.safeParse(files.value)
  if (!batch.success) {
    errors.value = [batch.error.issues[0]?.message ?? 'That selection cannot be used']
    return
  }

  const body = new FormData()
  for (const file of batch.data) body.append('files', file)

  uploading.value = true
  errors.value = []

  try {
    await $fetch('/api/files', { method: 'POST', body })

    // The count is taken from what was sent rather than from the response: the
    // upload is all-or-nothing, so a success means every one of them landed, and
    // the authoritative list arrives from `refreshStored()` a line later.
    const count = batch.data.length
    clear()
    await refreshStored()
    toast.value?.show(`Uploaded ${count} ${count === 1 ? 'file' : 'files'}.`)
  } catch (error) {
    // The route reports one line per rejected file — a file the API found empty
    // or unreadable, or one whose bytes are already stored. Anything else is a
    // failure of ours to explain, not the caller's to fix.
    errors.value = messagesFrom(error) ?? ['Could not upload these files. Please try again.']
  } finally {
    uploading.value = false
  }
}

// --- Stored files ----------------------------------------------------------

/**
 * Our own route is still a boundary — parse before the rows reach the list.
 * A throw here lands in `useFetch`'s `error`, which the template renders.
 */
const {
  data: stored,
  status: storedStatus,
  refresh: refreshStored
} = await useFetch('/api/files', {
  default: (): FileRecord[] => [],
  transform: (payload) => {
    const parsed = FileRecordListSchema.safeParse(payload)
    if (!parsed.success) {
      throw createError({ statusCode: 502, statusMessage: 'Malformed file list' })
    }
    return parsed.data
  }
})

/** Replaced rather than mutated, so the computed below cannot miss a change. */
const selected = ref(new Set<string>())
const deleting = ref(false)
const storedError = ref('')

const allSelected = computed(
  () => stored.value.length > 0 && selected.value.size === stored.value.length
)

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(stored.value.map((record) => record.id))
}

/**
 * A batch delete is all-or-nothing, so an id deleted from another tab would take
 * the whole selection down with it. Dropping ids the list no longer has keeps
 * the button honest about what it will remove.
 */
watch(stored, (rows) => {
  const live = new Set(rows.map((record) => record.id))
  if ([...selected.value].every((id) => live.has(id))) return
  selected.value = new Set([...selected.value].filter((id) => live.has(id)))
})

async function removeStored(ids: string[], message: string) {
  deleting.value = true
  storedError.value = ''

  try {
    // One id goes to the route that addresses one file; several go to the batch
    // route, which deletes them in a single transaction.
    if (ids.length === 1) await $fetch(`/api/files/${ids[0]}`, { method: 'DELETE' })
    else await $fetch('/api/files', { method: 'DELETE', body: { ids } })

    selected.value = new Set()
    await refreshStored()
    toast.value?.show(message)
  } catch (error) {
    storedError.value = messagesFrom(error)?.[0] ?? 'Could not delete. Please try again.'
  } finally {
    deleting.value = false
  }
}

function removeOne(record: FileRecord) {
  return removeStored([record.id], `Deleted ${record.fileName}.`)
}

function removeSelected() {
  const count = selected.value.size
  return removeStored([...selected.value], `Deleted ${count} ${count === 1 ? 'file' : 'files'}.`)
}

/** The analysis panel is opened by the row, so it holds no list state of its own. */
const drawer = useTemplateRef<{ open: (record: FileRecord) => void }>('drawer')

function analyze(record: FileRecord) {
  drawer.value?.open(record)
}

/** e.g. `1.4 MB`. Bytes below a kilobyte are not worth a decimal. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(1)} ${units[unit]}`
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold sm:text-2xl">Analysis</h1>
      <p class="text-sm text-base-content/60 sm:text-base">Upload data files to analyse.</p>
    </div>

    <!-- The aura wraps the card only once there is something to highlight, and
         needs to stay its single direct child. -->
    <div :class="files.length ? 'aura aura-dual aura-xs' : ''">
      <div class="card card-border w-full bg-base-100">
        <div class="card-body gap-4 p-4 sm:p-6">
          <!-- A phone has no pointer to drag with, so the zone is sized for
               tapping rather than for a drop target: less padding, a smaller
               glyph, and "browse" first in the label. -->
          <label
            class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-4 py-8 text-center transition-colors sm:gap-3 sm:px-6 sm:py-12"
            :class="
              dragging ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-base-content/30'
            "
            @dragenter.prevent="dragDepth += 1"
            @dragover.prevent
            @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
            @drop.prevent="onDrop"
          >
            <!-- Sized by class, not the `size` prop: the attribute is what a
                 utility has to beat, and a class can be responsive. -->
            <CloudUpload class="size-10 shrink-0 text-base-content/40 sm:size-16" />
            <span class="font-medium">
              <span class="link link-primary">Browse</span>
              <span class="hidden sm:inline">, or drag and drop files here</span>
            </span>
            <span class="text-xs text-base-content/60 sm:text-sm">
              {{ accepts }} — up to {{ ANALYSIS_FILE_MAX_COUNT }} files, each
              {{ ANALYSIS_FILE_MAX_LABEL }} or smaller
            </span>
            <input
              ref="input"
              type="file"
              class="sr-only"
              multiple
              :accept="ANALYSIS_FILE_ACCEPT"
              @change="onChange"
            />
          </label>

          <!-- A rejection names its file, so several can be reported at once; a
               lone message reads better without a bullet. -->
          <div v-if="errors.length" role="alert" class="alert alert-error alert-soft">
            <span v-if="errors.length === 1" class="min-w-0 break-words">{{ errors[0] }}</span>
            <ul v-else class="min-w-0 list-inside list-disc">
              <li v-for="message in errors" :key="message" class="break-words">{{ message }}</li>
            </ul>
          </div>

          <!-- The tally takes its own line on a phone and the buttons split the
               width below it; from `sm` the three sit on one row. -->
          <div
            class="card-actions flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end"
          >
            <p v-if="files.length" class="text-sm text-base-content/60 sm:mr-auto">
              {{ files.length }} of {{ ANALYSIS_FILE_MAX_COUNT }} files ·
              {{ formatSize(totalSize) }}
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-ghost flex-1 sm:flex-none"
                :disabled="!files.length || uploading"
                @click="clear"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary flex-1 sm:flex-none"
                :disabled="!ready || uploading"
                @click="upload"
              >
                <span v-if="uploading" class="loading loading-spinner loading-sm"></span>
                Upload
              </button>
            </div>
          </div>
        </div>

        <ul v-if="files.length" class="list border-t border-base-300">
          <li v-for="file in files" :key="identify(file)" class="list-row items-center">
            <FileText :size="20" class="shrink-0 text-base-content/40" />
            <!-- The name is the only part allowed to consume the leftover width,
                 so the size and the remove button never get squeezed off. -->
            <span class="min-w-0 truncate font-medium">{{ file.name }}</span>
            <span class="shrink-0 text-xs text-base-content/60 sm:text-sm">
              {{ formatSize(file.size) }}
            </span>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square shrink-0"
              :aria-label="`Remove ${file.name}`"
              @click="remove(file)"
            >
              <X :size="16" />
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="card card-border bg-base-100">
      <div class="card-body gap-4 p-4 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="card-title">Uploaded files</h2>

          <!-- On a phone the checkbox and the delete button take the row to
               themselves, pushed to opposite ends so the tap targets stay apart. -->
          <div
            v-if="stored.length"
            class="flex items-center justify-between gap-3 sm:justify-end sm:gap-4"
          >
            <label class="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                :checked="allSelected"
                @change="toggleAll"
              />
              Select all
            </label>
            <button
              type="button"
              class="btn btn-sm btn-error btn-soft"
              :disabled="!selected.size || deleting"
              @click="removeSelected"
            >
              <span v-if="deleting" class="loading loading-spinner loading-xs"></span>
              <Trash2 v-else :size="16" />
              Delete {{ selected.size ? `${selected.size} ` : '' }}selected
            </button>
          </div>
        </div>

        <div v-if="storedError" role="alert" class="alert alert-error alert-soft">
          <span>{{ storedError }}</span>
        </div>

        <div v-if="storedStatus === 'pending'" class="py-4 text-center">
          <span class="loading loading-dots"></span>
        </div>
        <p v-else-if="!stored.length" class="py-4 text-base-content/60">
          No files uploaded yet. Add some above to get started.
        </p>
      </div>

      <ul v-if="stored.length" class="list border-t border-base-300">
        <!-- Three children, not five: a checkbox, the details, and the actions
             as one group. `list-row` is a grid and only its second child takes
             the leftover width, so every extra top-level child is another track
             competing for a phone's 360px. The status badge therefore sits in
             the detail line rather than in a track of its own. -->
        <li v-for="record in stored" :key="record.id" class="list-row items-center">
          <input
            type="checkbox"
            class="checkbox checkbox-sm shrink-0"
            :checked="selected.has(record.id)"
            :aria-label="`Select ${record.fileName}`"
            @change="toggle(record.id)"
          />

          <div class="min-w-0">
            <div class="truncate font-medium">{{ record.fileName }}</div>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-content/60">
              <span>
                {{ formatSize(record.fileSizeBytes) }} · {{ record.fileFormat.toUpperCase() }}
              </span>
              <span
                class="badge badge-xs"
                :class="{
                  'badge-error': record.status === 'failed',
                  'badge-success': record.status === 'ready',
                  'badge-ghost': record.status === 'uploaded' || record.status === 'parsing'
                }"
              >
                {{ record.status }}
              </span>
            </div>
            <!-- Only a failed file carries one, and it is the whole reason the
                 row is worth looking at. `break-words` because the message comes
                 from the API and can be longer than the column. -->
            <div v-if="record.errorMessage" class="break-words text-xs text-error">
              {{ record.errorMessage }}
            </div>
          </div>

          <div class="flex shrink-0 items-center">
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square"
              :aria-label="`Analyze ${record.fileName}`"
              @click="analyze(record)"
            >
              <ChartScatter :size="16" />
            </button>

            <!-- A real link, so the browser downloads it rather than the page
                 fetching the bytes only to hand them back. -->
            <a
              class="btn btn-ghost btn-sm btn-square"
              :href="`/api/files/${record.id}/content`"
              :download="record.fileName"
              :aria-label="`Download ${record.fileName}`"
            >
              <Download :size="16" />
            </a>

            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square"
              :disabled="deleting"
              :aria-label="`Delete ${record.fileName}`"
              @click="removeOne(record)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- The panel reports what it queued rather than showing it, so both it and
         the upload card share the one toast. -->
    <AnalysisDrawer ref="drawer" @queued="toast?.show($event)" />
    <AppToast ref="toast" />
  </div>
</template>
