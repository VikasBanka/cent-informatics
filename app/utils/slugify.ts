/**
 * Derives an organization slug from its name. This is a convenience for the
 * create form only — `OrganizationDraftSchema` still validates whatever ends up
 * in the field, whether generated here or typed by hand.
 *
 * Output always satisfies the schema's pattern: lowercase alphanumerics in
 * groups separated by single hyphens, with none at either end.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // drop the marks NFKD just split off, so "Zürich" slugs as "zurich"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 64)
    .replace(/^-+|-+$/g, '') // after the slice, so a truncated tail can't dangle
}
