import * as z from 'zod/mini'
import { requiredText } from './text'

/**
 * Single source of truth for the organization record — the customer company a
 * client (requester contact) belongs to. Import from both the form and any
 * server route that accepts it, so the two can never disagree.
 */

/**
 * Lowercased on the way in, so `Acme-Diagnostics` and `acme-diagnostics` can't
 * both be stored as separate organizations. The pattern rejects leading,
 * trailing and doubled hyphens — exactly what `slugify()` avoids producing, so
 * a generated slug always passes.
 *
 * Checks run in order: `z.minLength` first means an empty field reports "is
 * required" rather than the pattern message.
 */
const Slug = z.string().check(
  z.trim(),
  z.toLowerCase(),
  z.minLength(1, { error: 'Organization slug is required' }),
  z.maxLength(64, { error: 'Organization slug must be 64 characters or fewer' }),
  z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    error: 'Use lowercase letters and digits, separated by single hyphens'
  })
)

/** What the create form submits. */
export const OrganizationDraftSchema = z.object({
  name: requiredText('Organization name', 160),
  slug: Slug
})

/**
 * What an edit submits. The slug is permanent once saved, so it is absent here
 * by construction — `z.object` strips unknown keys, so a PATCH body that smuggles
 * a slug in has it dropped before the handler ever sees it. The disabled input
 * on the form is a courtesy; this is the rule.
 */
export const OrganizationEditSchema = z.pick(OrganizationDraftSchema, { name: true })

/** A stored organization. */
export const OrganizationSchema = z.extend(OrganizationDraftSchema, {
  id: z.uuid()
})

/** A stored organization as the list endpoint returns it. */
export const OrganizationSummarySchema = z.extend(OrganizationSchema, {
  clientCount: z.int().check(z.nonnegative())
})

/** What the create form holds before parsing. */
export type OrganizationDraftInput = z.input<typeof OrganizationDraftSchema>

export type OrganizationDraft = z.infer<typeof OrganizationDraftSchema>
export type OrganizationEdit = z.infer<typeof OrganizationEditSchema>
export type Organization = z.infer<typeof OrganizationSchema>
export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>
