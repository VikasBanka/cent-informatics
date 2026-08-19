<script setup lang="ts">
import * as z from 'zod/mini'
import { ClientDraftSchema, type ClientDraft, type ClientRecord } from '#shared/schemas/client'

/**
 * Add / edit form for a single client, opened imperatively by whoever owns the
 * list. It stacks on top of the clients dialog rather than replacing it, so
 * closing this one drops the user back where they were.
 */

const emit = defineEmits<{ saved: [message: string] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')

const blankForm = (): ClientDraft => ({
  firstName: '',
  lastName: '',
  title: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: ''
})

/** The organization the new client will belong to; fixed for the dialog's life. */
const organizationId = ref('')

/** `null` while adding; the client being changed while editing. */
const editing = ref<ClientRecord | null>(null)
const form = ref<ClientDraft>(blankForm())
const errors = ref<Record<string, string[] | undefined>>({})
const formError = ref('')
const submitting = ref(false)

// Only true once the user has tried to submit, so we don't flag fields they
// haven't reached yet.
const validating = ref(false)

const isEditing = computed(() => editing.value !== null)

/** Drops `id` and `organizationId` — `z.object` strips what the draft doesn't declare. */
function draftOf(client: ClientRecord): ClientDraft {
  const parsed = ClientDraftSchema.safeParse(client)
  return parsed.success ? parsed.data : blankForm()
}

function open(ownerId: string, client: ClientRecord | null) {
  organizationId.value = ownerId
  editing.value = client
  form.value = client ? draftOf(client) : blankForm()
  errors.value = {}
  formError.value = ''
  validating.value = false
  dialog.value?.showModal()
}

defineExpose({ open })

function validate() {
  const parsed = ClientDraftSchema.safeParse(form.value)
  errors.value = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors
  return parsed
}

async function submit() {
  validating.value = true
  formError.value = ''

  const parsed = validate()
  if (!parsed.success) return

  submitting.value = true
  try {
    const target = editing.value
    if (target) {
      await $fetch(`/api/clients/${target.id}`, { method: 'PUT', body: parsed.data })
    } else {
      await $fetch(`/api/organizations/${organizationId.value}/clients`, {
        method: 'POST',
        body: parsed.data
      })
    }

    dialog.value?.close()
    emit(
      'saved',
      `${target ? 'Saved changes to' : 'Added'} ${parsed.data.firstName} ${parsed.data.lastName}.`
    )
  } catch (error) {
    const fields = fieldErrorsFrom(error)
    if (fields) errors.value = fields
    else formError.value = 'Could not save the client. Please try again.'
  } finally {
    submitting.value = false
  }
}

// Re-check as they type, but only after the first failed submit.
watch(
  form,
  () => {
    if (validating.value) validate()
  },
  { deep: true }
)
</script>

<template>
  <dialog
    ref="dialog"
    class="modal modal-bottom sm:modal-middle"
    aria-labelledby="client-dialog-title"
  >
    <div class="modal-box max-w-2xl">
      <h3 id="client-dialog-title" class="text-lg font-bold">
        {{ isEditing ? 'Edit client' : 'Add client' }}
      </h3>

      <form class="flex flex-col gap-2" novalidate @submit.prevent="submit">
        <fieldset class="fieldset gap-4">
          <legend class="fieldset-legend">Requester</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <AppFormField
              id="client-first-name"
              v-model="form.firstName"
              label="First name"
              placeholder="Jane"
              autocomplete="given-name"
              :errors="errors.firstName"
            />
            <AppFormField
              id="client-last-name"
              v-model="form.lastName"
              label="Last name"
              placeholder="Okafor"
              autocomplete="family-name"
              :errors="errors.lastName"
            />
          </div>
          <AppFormField
            id="client-title"
            v-model="form.title"
            label="Title"
            placeholder="Laboratory Director"
            autocomplete="organization-title"
            :errors="errors.title"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <AppFormField
              id="client-email"
              v-model="form.email"
              label="Email"
              placeholder="jane.okafor@example.com"
              autocomplete="email"
              :errors="errors.email"
            />
            <AppFormField
              id="client-phone"
              v-model="form.phone"
              label="Phone number"
              type="tel"
              placeholder="+1 (555) 010-9999"
              autocomplete="tel"
              :errors="errors.phone"
            />
          </div>
        </fieldset>

        <fieldset class="fieldset gap-4">
          <legend class="fieldset-legend">Address</legend>
          <AppFormField
            id="client-address-line-1"
            v-model="form.addressLine1"
            label="Address line 1"
            placeholder="1200 Harbor Boulevard"
            autocomplete="address-line1"
            :errors="errors.addressLine1"
          />
          <AppFormField
            id="client-address-line-2"
            v-model="form.addressLine2"
            label="Address line 2 (optional)"
            placeholder="Suite 400"
            autocomplete="address-line2"
            :errors="errors.addressLine2"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <AppFormField
              id="client-city"
              v-model="form.city"
              label="City"
              placeholder="Portland"
              autocomplete="address-level2"
              :errors="errors.city"
            />
            <AppFormField
              id="client-state"
              v-model="form.state"
              label="State / province"
              placeholder="Oregon"
              autocomplete="address-level1"
              :errors="errors.state"
            />
            <AppFormField
              id="client-postal-code"
              v-model="form.postalCode"
              label="ZIP / postal code"
              placeholder="97201"
              autocomplete="postal-code"
              :errors="errors.postalCode"
            />
            <AppFormField
              id="client-country"
              v-model="form.country"
              label="Country"
              placeholder="United States"
              autocomplete="country-name"
              :errors="errors.country"
            />
          </div>
        </fieldset>

        <div v-if="formError" role="alert" class="alert alert-error alert-soft">
          <span>{{ formError }}</span>
        </div>

        <!-- Stacked and full-width on a phone, side by side from `sm`. -->
        <div class="modal-action flex-col-reverse gap-2 sm:flex-row">
          <button type="button" class="btn btn-ghost" @click="dialog?.close()">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            {{ isEditing ? 'Save changes' : 'Add client' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
