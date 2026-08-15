<script setup lang="ts">
/**
 * A success message that appears at the top-centre of the screen and clears
 * itself after a second. Opened imperatively by whoever did the saving.
 *
 * It is a manual popover rather than a plain fixed div because a message can
 * follow a save made from inside a `showModal()` dialog that stays open — e.g.
 * adding a client from the clients list. That dialog is in the top layer, so
 * anything in the normal flow paints behind its backdrop no matter its
 * z-index. A popover joins the top layer too, and being promoted last it lands
 * above the dialog; `manual` keeps it there until we hide it and lets clicks
 * through to the page.
 */
const VISIBLE_MS = 1000

const toast = useTemplateRef<HTMLDivElement>('toast')
const message = ref('')

/**
 * `v-show`, not the popover's own hiding: the browser hides a closed popover
 * with a UA rule, and `.toast` is an author rule setting `display: flex`, so it
 * wins and the message would stay on screen after `hidePopover()`.
 */
const open = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined

async function show(text: string) {
  message.value = text
  open.value = true
  // Let `v-show` clear the inline `display: none` first, so the element is
  // visible in the frame it gets promoted to the top layer.
  await nextTick()

  // A second save can land while the first message is still up; showing an
  // already-open popover is a no-op, but so is re-promoting it.
  if (!toast.value?.matches(':popover-open')) toast.value?.showPopover()

  clearTimeout(timer)
  timer = setTimeout(hide, VISIBLE_MS)
}

function hide() {
  open.value = false
  // Out of the top layer as well, so it cannot sit over a later dialog.
  if (toast.value?.matches(':popover-open')) toast.value.hidePopover()
}

defineExpose({ show })

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <!-- The utilities undo the browser's default popover box (border, padding,
       and a margin that would fight `toast-center`'s translate); the toast
       classes do the positioning. -->
  <div
    v-show="open"
    ref="toast"
    popover="manual"
    class="toast toast-top toast-center m-0 overflow-visible border-0 p-0"
  >
    <div role="status" class="alert alert-success alert-soft">
      <span>{{ message }}</span>
    </div>
  </div>
</template>
