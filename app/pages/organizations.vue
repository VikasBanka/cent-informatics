<script setup lang="ts">
import * as z from 'zod/mini'
import { Pencil, Plus, User } from '@lucide/vue'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable
} from '@tanstack/vue-table'
import { ClientRecordSchema, type ClientRecord } from '#shared/schemas/client'
import {
  OrganizationDraftSchema,
  OrganizationEditSchema,
  OrganizationSummarySchema,
  type OrganizationDraftInput,
  type OrganizationSummary
} from '#shared/schemas/organization'

const OrganizationList = z.array(OrganizationSummarySchema)
const ClientList = z.array(ClientRecordSchema)

/**
 * Our own routes are still a boundary — parse before the rows reach the table.
 * A throw here lands in `useFetch`'s `error`, which the template renders.
 */
const {
  data: organizations,
  status,
  refresh
} = await useFetch('/api/organizations', {
  default: (): OrganizationSummary[] => [],
  transform: (payload) => {
    const parsed = OrganizationList.safeParse(payload)
    if (!parsed.success) {
      throw createError({ statusCode: 502, statusMessage: 'Malformed organization list' })
    }
    return parsed.data
  }
})

// --- Table -----------------------------------------------------------------

/**
 * Built once in setup, never inside the table options: a fresh `features` or
 * `columns` reference throws away the memoised row models. Only
 * `rowSortingFeature` is registered — the list is short, so there is nothing to
 * page or filter yet.
 */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic }
})

const helper = createColumnHelper<typeof features, OrganizationSummary>()

const columns = helper.columns([
  helper.accessor('name', { header: 'Organization', meta: { tdClass: 'font-medium' } }),
  helper.accessor('slug', { header: 'Slug', meta: { tdClass: 'font-mono' } }),
  helper.accessor('clientCount', { header: 'Clients' }),
  // A display column: no accessor, so it is never sortable. `w-0` shrinks it to
  // the button, which is what keeps the name column wide.
  helper.display({ id: 'actions', header: 'Actions', meta: { thClass: 'w-0' } })
])

const table = useTable({
  features,
  columns,
  // The ref itself, never `.value` — that is what lets `refresh()` reach the table.
  data: organizations,
  getRowId: (row: OrganizationSummary) => row.id
})

// --- Add / edit ------------------------------------------------------------

const formDialog = useTemplateRef<HTMLDialogElement>('formDialog')

/** `null` while adding; the row being changed while editing. */
const editing = ref<OrganizationSummary | null>(null)
const form = ref<OrganizationDraftInput>({ name: '', slug: '' })
const errors = ref<Record<string, string[] | undefined>>({})
const formError = ref('')
const submitting = ref(false)
const toast = useTemplateRef<{ show: (message: string) => void }>('toast')

// Only true once the user has tried to submit, so we don't flag fields they
// haven't reached yet.
const validating = ref(false)

/** Stops the name from overwriting a slug the user typed themselves. */
const slugEdited = ref(false)

const isEditing = computed(() => editing.value !== null)

function openDialog(organization: OrganizationSummary | null) {
  editing.value = organization
  form.value = organization
    ? { name: organization.name, slug: organization.slug }
    : { name: '', slug: '' }
  // Nothing to derive when editing: the slug is frozen either way.
  slugEdited.value = organization !== null
  errors.value = {}
  formError.value = ''
  validating.value = false
  formDialog.value?.showModal()
}

function validate() {
  // Editing sends only `name`, so validating the whole draft would flag a slug
  // the user is not allowed to fix.
  const parsed = isEditing.value
    ? OrganizationEditSchema.safeParse({ name: form.value.name })
    : OrganizationDraftSchema.safeParse(form.value)

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
      await $fetch(`/api/organizations/${target.id}`, { method: 'PUT', body: parsed.data })
      toast.value?.show(`Saved changes to ${parsed.data.name}.`)
    } else {
      await $fetch('/api/organizations', { method: 'POST', body: parsed.data })
      toast.value?.show(`Added ${parsed.data.name}.`)
    }

    formDialog.value?.close()
    await refresh()
  } catch (error) {
    const fields = fieldErrorsFrom(error)
    if (fields) errors.value = fields
    else formError.value = 'Could not save the organization. Please try again.'
  } finally {
    submitting.value = false
  }
}

// Derive the slug from the name until the user takes the field over.
watch(
  () => form.value.name,
  (name) => {
    if (!isEditing.value && !slugEdited.value) form.value.slug = slugify(name)
  }
)

// Re-check as they type, but only after the first failed submit.
watch(
  form,
  () => {
    if (validating.value) validate()
  },
  { deep: true }
)

// --- Clients of an organization -------------------------------------------

const clientsDialog = useTemplateRef<HTMLDialogElement>('clientsDialog')
const clientForm = useTemplateRef<{ open: (ownerId: string, client: ClientRecord | null) => void }>(
  'clientForm'
)
const clientsOf = ref<OrganizationSummary | null>(null)
const clients = ref<ClientRecord[]>([])
const clientsPending = ref(false)
const clientsError = ref('')

async function loadClients(organizationId: string) {
  clientsError.value = ''
  clientsPending.value = true

  try {
    const payload = await $fetch(`/api/organizations/${organizationId}/clients`)
    const parsed = ClientList.safeParse(payload)
    if (!parsed.success) throw new Error('Malformed client list')
    clients.value = parsed.data
  } catch {
    clientsError.value = 'Could not load the clients for this organization.'
  } finally {
    clientsPending.value = false
  }
}

async function openClients(organization: OrganizationSummary) {
  clientsOf.value = organization
  clients.value = []
  clientsDialog.value?.showModal()
  await loadClients(organization.id)
}

/** The client form stacks over this dialog, so the list is still behind it. */
function openClientForm(client: ClientRecord | null) {
  if (!clientsOf.value) return
  clientForm.value?.open(clientsOf.value.id, client)
}

async function onClientSaved(message: string) {
  toast.value?.show(message)
  // The list behind the form, and the row's client count, are both now stale.
  await Promise.all([clientsOf.value ? loadClients(clientsOf.value.id) : undefined, refresh()])
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">Organizations</h1>        
      </div>
      <button class="btn btn-primary" @click="openDialog(null)">
        <Plus />
        Add organization
      </button>
    </div>

    <div class="card card-border bg-base-100">
      <div class="card-body">
        <AppDataTable
          :table="table"
          :loading="status === 'pending'"
          empty-message="No organizations yet. Add the first one to get started."
        >
          <!-- The actions column is labelled for screen readers only; a visible
               "Actions" heading would just widen the column. -->
          <template #header-actions>
            <span class="sr-only">Actions</span>
          </template>

          <template #cell-clientCount="{ row }">
            <button class="btn btn-ghost btn-sm" @click="openClients(row)">
              {{ row.clientCount }}
              {{ row.clientCount === 1 ? 'client' : 'clients' }}
            </button>
          </template>

          <template #cell-actions="{ row }">
            <button
              class="btn btn-ghost btn-sm"
              :aria-label="`Edit ${row.name}`"
              @click="openDialog(row)"
            >
              <Pencil />
              Edit
            </button>
          </template>
        </AppDataTable>
      </div>
    </div>

    <dialog ref="formDialog" class="modal" aria-labelledby="organization-dialog-title">
      <div class="modal-box">
        <h3 id="organization-dialog-title" class="text-lg font-bold">
          {{ isEditing ? 'Edit organization' : 'Add organization' }}
        </h3>

        <form class="flex flex-col gap-2" novalidate @submit.prevent="submit">
          <fieldset class="fieldset gap-4">
            <AppFormField
              id="organization-name"
              v-model="form.name"
              label="Organization name"
              placeholder="Acme Diagnostics"
              autocomplete="organization"
              :errors="errors.name"
            />
            <AppFormField
              id="organization-slug"
              v-model="form.slug"
              label="Slug"
              placeholder="acme-diagnostics"
              :disabled="isEditing"
              :hint="
                isEditing
                  ? 'Permanent once saved.'
                  : 'Generated from the name. Change it now — it cannot be edited later.'
              "
              :errors="errors.slug"
              @update:model-value="slugEdited = true"
            />
          </fieldset>

          <div v-if="formError" role="alert" class="alert alert-error alert-soft">
            <span>{{ formError }}</span>
          </div>

          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="formDialog?.close()">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
              {{ isEditing ? 'Save changes' : 'Add organization' }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <dialog ref="clientsDialog" class="modal" aria-labelledby="clients-dialog-title">
      <div class="modal-box max-w-2xl">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 id="clients-dialog-title" class="text-lg font-bold">
            Clients of {{ clientsOf?.name }}
          </h3>
          <button type="button" class="btn btn-sm btn-primary" @click="openClientForm(null)">
            <Plus />
            Add client
          </button>
        </div>

        <div v-if="clientsPending" class="py-4 text-center">
          <span class="loading loading-dots"></span>
        </div>
        <div v-else-if="clientsError" role="alert" class="alert alert-error alert-soft my-4">
          <span>{{ clientsError }}</span>
        </div>
        <p v-else-if="!clients.length" class="py-4 text-base-content/60">
          No clients registered against this organization yet.
        </p>
        <ul v-else class="list">
          <li v-for="client in clients" :key="client.id" class="list-row px-0">
            <User class="text-base-content/40" />
            <div class="min-w-0">
              <div class="font-medium">{{ client.firstName }} {{ client.lastName }}</div>
              <div class="text-xs text-base-content/60">{{ client.title }}</div>
              <div class="truncate text-xs text-base-content/60">{{ client.email }}</div>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-label="`Edit ${client.firstName} ${client.lastName}`"
              @click="openClientForm(client)"
            >
              <Pencil />
              Edit
            </button>
          </li>
        </ul>

        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="clientsDialog?.close()">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <ClientFormDialog ref="clientForm" @saved="onClientSaved" />

    <AppToast ref="toast" />
  </div>
</template>
