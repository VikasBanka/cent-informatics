import type { CellData, RowData, TableFeatures } from '@tanstack/table-core'

/**
 * Per-column daisyUI classes, declared once for every table in the app.
 *
 * TanStack owns no CSS, so anything positional — the width of an actions column,
 * a monospaced identifier column — has to reach the renderer somehow.
 * `columnDef.meta` is that channel, and declaration merging is what makes it
 * typed rather than a bag of `any`. Read by
 * [app/components/AppDataTable.vue](../components/AppDataTable.vue).
 *
 * The generic list must match the upstream `ColumnMeta` declaration exactly,
 * variance annotations included, or TypeScript refuses to merge it.
 */
declare module '@tanstack/table-core' {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData
  > {
    /** Extra classes for this column's `<th>` — e.g. `w-0` to shrink it to its content. */
    thClass?: string
    /** Extra classes for this column's `<td>`s — e.g. `font-mono`, `font-medium`. */
    tdClass?: string
  }
}
