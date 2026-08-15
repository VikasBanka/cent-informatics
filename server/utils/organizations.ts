import type { ClientDraft, ClientRecord } from '#shared/schemas/client'
import type {
  Organization,
  OrganizationDraft,
  OrganizationEdit,
  OrganizationSummary
} from '#shared/schemas/organization'

/**
 * In-memory store standing in for a database. It lives for the lifetime of the
 * server process and resets on restart — every route below goes through these
 * functions, so swapping them for real queries is the only change needed.
 *
 * Seed IDs are literals rather than generated so the seeded clients can point at
 * their organization.
 */

const ACME = '7e1c0d6a-2f4b-4a1e-9c3d-8b5f0a2e6d41'
const HARBORVIEW = 'c4a9f2b8-5d13-4e7a-b0c6-1f8e3d9a4b27'
const NORTHWIND = '1b6d8e30-9a75-4c22-8f4d-3e0a7c5b9d18'

const organizations: Organization[] = [
  { id: ACME, name: 'Acme Diagnostics', slug: 'acme-diagnostics' },
  { id: HARBORVIEW, name: 'Harborview Labs', slug: 'harborview-labs' },
  { id: NORTHWIND, name: 'Northwind Analytical', slug: 'northwind-analytical' }
]

const clients: ClientRecord[] = [
  {
    id: 'd9f3a1c7-6b28-4e05-9a71-2c4d8f0b3e56',
    organizationId: ACME,
    firstName: 'Jane',
    lastName: 'Okafor',
    title: 'Laboratory Director',
    email: 'jane.okafor@example.com',
    phone: '+1 (555) 010-9901',
    addressLine1: '1200 Harbor Boulevard',
    addressLine2: 'Suite 400',
    city: 'Portland',
    state: 'Oregon',
    postalCode: '97201',
    country: 'United States'
  },
  {
    id: '5a2e7b94-3c61-4d08-a7f2-9b0d6e1c8f43',
    organizationId: ACME,
    firstName: 'Marcus',
    lastName: 'Bell',
    title: 'QA Manager',
    email: 'marcus.bell@example.com',
    phone: '+1 (555) 010-9902',
    addressLine1: '1200 Harbor Boulevard',
    addressLine2: '',
    city: 'Portland',
    state: 'Oregon',
    postalCode: '97201',
    country: 'United States'
  },
  {
    id: 'f0c5d283-7e14-4a69-b3d8-6a1e9f2c4b70',
    organizationId: HARBORVIEW,
    firstName: 'Priya',
    lastName: 'Raman',
    title: 'Principal Chemist',
    email: 'priya.raman@example.com',
    phone: '+1 (555) 010-7745',
    addressLine1: '88 Pier Street',
    addressLine2: '',
    city: 'Seattle',
    state: 'Washington',
    postalCode: '98101',
    country: 'United States'
  }
]

/** Organizations with the count of clients each one owns, newest last. */
export function listOrganizations(): OrganizationSummary[] {
  return organizations.map((organization) => ({
    ...organization,
    clientCount: clients.filter((client) => client.organizationId === organization.id).length
  }))
}

export function findOrganizationById(id: string): Organization | undefined {
  return organizations.find((organization) => organization.id === id)
}

/** The slug is the human-facing key, so it has to stay unique across the store. */
export function slugIsTaken(slug: string): boolean {
  return organizations.some((organization) => organization.slug === slug)
}

export function createOrganization(draft: OrganizationDraft): Organization {
  const organization: Organization = { id: crypto.randomUUID(), ...draft }
  organizations.push(organization)
  return organization
}

/**
 * Applies the editable fields only. `OrganizationEdit` has no `slug` key, so a
 * saved slug is unreachable from here by design.
 */
export function updateOrganization(id: string, edit: OrganizationEdit): Organization | undefined {
  const organization = findOrganizationById(id)
  if (!organization) return undefined

  Object.assign(organization, edit)
  return organization
}

export function listClientsByOrganization(id: string): ClientRecord[] {
  return clients.filter((client) => client.organizationId === id)
}

export function findClientById(id: string): ClientRecord | undefined {
  return clients.find((client) => client.id === id)
}

export function createClient(organizationId: string, draft: ClientDraft): ClientRecord {
  const client: ClientRecord = { id: crypto.randomUUID(), organizationId, ...draft }
  clients.push(client)
  return client
}

/**
 * `ClientDraft` has no `organizationId`, so an edit can rewrite every detail of
 * a client except which organization owns it.
 */
export function updateClient(id: string, draft: ClientDraft): ClientRecord | undefined {
  const client = findClientById(id)
  if (!client) return undefined

  Object.assign(client, draft)
  return client
}
