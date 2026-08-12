import * as z from 'zod/mini'

/**
 * Single source of truth for the login payload.
 * Import from both the form and any server route that accepts it, so the two
 * can never disagree.
 */
export const LoginSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }),
  password: z.string().check(z.minLength(8, { error: 'Must be at least 8 characters' })),
  remember: z._default(z.boolean(), false)
})

/** What the form holds before parsing (`remember` may be absent). */
export type LoginInput = z.input<typeof LoginSchema>

/** What a successful parse yields. */
export type LoginPayload = z.infer<typeof LoginSchema>
