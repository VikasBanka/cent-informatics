<script setup lang="ts">
import { X } from '@lucide/vue'
import { ANALYSIS_TYPES, type AnalysisType, type FileRecord } from '#shared/schemas/analysis'

/**
 * The analysis panel for a single stored file, opened imperatively from the row
 * that owns it. Pick a statistic, then submit it — nothing is queued until the
 * submit button is pressed.
 *
 * The statistics are radio inputs wearing `btn`, not `<button>`s: picking one of
 * a set is what a radio group is, and the browser then supplies the single-select
 * behaviour, the arrow-key navigation and the `radio`/`checked` semantics that
 * five buttons would each need hand-wiring. daisyUI renders a `btn` radio's label
 * from its `aria-label`, so the accessible name and the visible one are the same
 * string by construction.
 *
 * `modal-end` rather than the `drawer` component: `drawer` is a page-layout
 * grid, so nesting one inside the capped `main` column would leave its overlay
 * covering only that column on a wide screen. A `<dialog>` renders in the top
 * layer instead, which also brings Esc-to-close and a focus trap with it, and
 * daisyUI's `modal-end` already gives the box its full height, its slide-in from
 * the right, and the square right-hand corners a panel wants.
 */

/**
 * Reported rather than shown here, so the one `AppToast` on the page handles it.
 * A second instance inside this dialog could race the page's own messages.
 */
const emit = defineEmits<{ queued: [message: string] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')

/** `null` until the drawer has been opened at least once. */
const record = ref<FileRecord | null>(null)

/** The chosen statistic, and `null` until one is picked. */
const selected = ref<AnalysisType | null>(null)

const pending = ref(false)
const error = ref('')

function open(target: FileRecord) {
  record.value = target
  // Neither a choice nor a failure belongs to the next file.
  selected.value = null
  error.value = ''
  dialog.value?.showModal()
}

/**
 * Queues the chosen statistic. Fire-and-forget by design: nothing consumes the
 * queue yet, so a success is the broker having accepted the request and there is
 * no result to wait for.
 *
 * The panel stays open and the choice stays made, so a second statistic for the
 * same file is one more click rather than a reopen.
 */
async function submit() {
  // Guarded as well as disabled: the button is disabled with nothing chosen and
  // while a request is in flight, and a keyboard repeat should not outrun that.
  if (!record.value || !selected.value || pending.value) return

  const analysisType = selected.value
  pending.value = true
  error.value = ''

  try {
    await $fetch(`/api/files/${record.value.id}/analyses`, {
      method: 'POST',
      body: { analysisType }
    })
    // The file is named in the panel header directly above, so the message does
    // not repeat it — a long name from the API would widen the toast.
    emit('queued', `Queued the ${analysisType}.`)
  } catch (cause) {
    error.value = messagesFrom(cause)?.[0] ?? 'Could not queue that analysis. Please try again.'
  } finally {
    pending.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <dialog ref="dialog" class="modal modal-end" aria-labelledby="analysis-drawer-title">
    <!-- The panel is the whole screen on a phone, where there is no room beside
         it, and takes a cap once there is. No height: `modal-end` already gives
         the box the full viewport. -->
    <div class="modal-box flex w-full flex-col gap-4 sm:max-w-md">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 id="analysis-drawer-title" class="text-lg font-bold">Analyze</h3>
          <!-- A file name comes from the API and can outrun the panel. -->
          <p class="truncate text-sm text-base-content/60">{{ record?.fileName }}</p>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-square shrink-0"
          aria-label="Close analysis panel"
          @click="dialog?.close()"
        >
          <X />
        </button>
      </div>

      <div v-if="error" role="alert" class="alert alert-error alert-soft">
        <span class="min-w-0 break-words">{{ error }}</span>
      </div>

      <!-- A real `fieldset`/`legend`, so the group has a name of its own rather
           than five radios each announced with no idea what they belong to. -->
      <fieldset class="fieldset grow">
        <legend class="fieldset-legend">Statistics</legend>

        <!-- Two columns at 360px and three once the panel takes its cap. A grid
             rather than a wrapping flex row so every option is the same width,
             which keeps the labels — one short word each — readable as a set.
             `min-w-0` because this is a grid item as well as a grid. -->
        <div class="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
          <!-- Ghost until chosen, then filled: a background change rather than
               only a colour change, so the selection does not depend on hue
               alone. `capitalize` styles the `aria-label` daisyUI renders through
               `::after`, which leaves the accessible name the plain word. -->
          <input
            v-for="analysisType in ANALYSIS_TYPES"
            :key="analysisType"
            v-model="selected"
            type="radio"
            name="analysis-type"
            :value="analysisType"
            :aria-label="analysisType"
            class="btn capitalize"
            :class="selected === analysisType ? 'btn-primary' : 'btn-ghost'"
            :disabled="pending"
          />
        </div>
      </fieldset>

      <!-- Stacked on a phone, and `-reverse` keeps the submit button on top while
           it is — so the DOM order still ends on the primary action. -->
      <div class="modal-action flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          class="btn btn-primary w-full sm:w-auto"
          :disabled="!selected || pending"
          @click="submit"
        >
          <span v-if="pending" class="loading loading-spinner loading-sm"></span>
          Queue {{ selected ?? 'analysis' }}
        </button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
