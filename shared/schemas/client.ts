import * as z from 'zod/mini'
import { timestamps } from './record'
import { optionalText, requiredText } from './text'

/**
 * Single source of truth for the client record — a requester contact that
 * belongs to exactly one organization, which owns many of them. Import from
 * both the form and any server route that accepts it, so the two can never
 * disagree.
 */

/**
 * Trim before the format check runs — checks execute in order, and the format
 * check is baked in at construction, so a plain `.check(z.trim())` would trim
 * only after `a@b.com ` had already been rejected.
 */
const Email = z.pipe(
  z.string().check(z.trim(), z.minLength(1, { error: 'Email is required' })),
  z.email({ error: 'Enter a valid email address' })
)

/**
 * Accepts the shapes people actually type — `+1 (555) 010-9999`, `555.010.9999`
 * — then counts the digits so formatting punctuation can't pad a short number.
 */
const Phone = z.string().check(
  z.trim(),
  z.minLength(1, { error: 'Phone number is required' }),
  z.regex(/^\+?[\d\s().-]+$/, {
    error: 'Phone number may only contain digits, spaces and + ( ) - .'
  }),
  z.refine(
    (value) => {
      const digits = value.replace(/\D/g, '')
      return digits.length >= 10 && digits.length <= 15
    },
    { error: 'Enter a phone number with 10 to 15 digits' }
  )
)

const PostalCode = z.string().check(
  z.trim(),
  z.minLength(1, { error: 'ZIP / postal code is required' }),
  z.regex(/^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$/, {
    error: 'Enter a valid ZIP / postal code'
  })
)

export const ClientSchema = z.object({
  /** The owning organization. A client cannot exist without one. */
  organizationId: z.uuid({ error: 'Select an organization' }),
  firstName: requiredText('First name', 80),
  lastName: requiredText('Last name', 80),
  title: requiredText('Title', 120),
  email: Email,
  phone: Phone,
  addressLine1: requiredText('Address line 1', 160),
  addressLine2: optionalText('Address line 2', 160),
  city: requiredText('City', 80),
  state: requiredText('State / province', 80),
  postalCode: PostalCode,
  country: requiredText('Country', 80)
})

/** A stored client, as the API returns it. */
export const ClientRecordSchema = z.extend(ClientSchema, {
  id: z.uuid(),
  ...timestamps
})

/**
 * What the client form submits. The owning organization comes from the route
 * the form posts to, not the body, so a client can't be moved between
 * organizations — or created under one it never named — by editing a payload.
 */
export const ClientDraftSchema = z.omit(ClientSchema, { organizationId: true })

/** What the form holds before parsing (`addressLine2` may be absent). */
export type ClientDraftInput = z.input<typeof ClientDraftSchema>

export type ClientDraft = z.infer<typeof ClientDraftSchema>

/** What the form holds before parsing (`addressLine2` may be absent). */
export type ClientInput = z.input<typeof ClientSchema>

/** What a successful parse yields. */
export type ClientPayload = z.infer<typeof ClientSchema>

export type ClientRecord = z.infer<typeof ClientRecordSchema>
