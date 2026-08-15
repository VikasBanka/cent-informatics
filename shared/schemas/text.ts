import * as z from 'zod/mini'

/**
 * Text primitives shared by every schema in this folder, so a "required" field
 * fails the same way and reads the same way wherever it appears.
 */

/** Trimmed, non-empty text with a length ceiling and copy the user can act on. */
export const requiredText = (label: string, max: number) =>
  z.string().check(
    z.trim(),
    z.minLength(1, { error: `${label} is required` }),
    z.maxLength(max, { error: `${label} must be ${max} characters or fewer` })
  )

/** Same, but an empty string is acceptable. */
export const optionalText = (label: string, max: number) =>
  z._default(
    z.string().check(
      z.trim(),
      z.maxLength(max, { error: `${label} must be ${max} characters or fewer` })
    ),
    ''
  )
