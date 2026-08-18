<script setup lang="ts" generic="TFeatures extends TableFeatures, TData extends RowData">
/**
 * The only place daisyUI table markup is written in this app.
 *
 * TanStack Table v9 is headless: it owns rows, sorting, filtering and paging
 * state, and owns no markup, CSS or accessibility. That split is the whole
 * point of this component — the page builds the instance with `useTable` and
 * registers the features it needs, and this renders that instance in daisyUI's
 * `table` classes so every table in the app is themed identically.
 *
 * Feature-dependent APIs (`column.getCanSort`, `row.getVisibleCells`,
 * `table.getPageCount`, …) exist only when the page registered the matching
 * feature, and v9's types gate them on `TFeatures`. A generic renderer cannot
 * know which are present, so the helpers below probe for the method instead of
 * assuming it — a table built with `tableFeatures({})` renders plain, and one
 * built with sorting and pagination grows the header buttons and pager with no
 * extra props here.
 */
import type { RowData, Table, TableFeatures } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown
} from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    /** A `useTable()` instance. Features are the page's choice, not ours. */
    table: Table<TFeatures, TData>
    /** Renders the loading row instead of the body. Pass `status === 'pending'`. */
    loading?: boolean
    /** Shown when the table has no rows and isn't loading. */
    emptyMessage?: string
    zebra?: boolean
    /** Sticky header — needs a height-bounded scroll container to do anything. */
    pinRows?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Renders the pager when the instance has `rowPaginationFeature`. */
    pageSizes?: number[]
  }>(),
  {
    emptyMessage: 'No records found.',
    size: 'md',
    pageSizes: () => [10, 25, 50, 100]
  }
)

/**
 * `any` is deliberate and contained to these probes. Narrowing back to the
 * gated types would mean re-deriving `TFeatures`, which is exactly the coupling
 * this component exists to avoid.
 */
type Loose = Record<string, any>

const has = (target: Loose, method: string) => typeof target[method] === 'function'

const canSort = (column: Loose) => has(column, 'getCanSort') && column.getCanSort()
const sortDirection = (column: Loose): 'asc' | 'desc' | false =>
  has(column, 'getIsSorted') ? column.getIsSorted() : false
const sortHandler = (column: Loose): ((event: unknown) => void) | undefined =>
  has(column, 'getToggleSortingHandler') ? column.getToggleSortingHandler() : undefined

/** daisyUI has no `aria-sort` equivalent, so the semantics are ours to add. */
function ariaSort(column: Loose): 'ascending' | 'descending' | 'none' | undefined {
  if (!canSort(column)) return undefined
  const direction = sortDirection(column)
  if (direction === 'asc') return 'ascending'
  if (direction === 'desc') return 'descending'
  return 'none'
}

const loose = computed(() => props.table as unknown as Loose)

/** Visible cells once `columnVisibilityFeature` is registered; all cells before. */
const cellsOf = (row: Loose) =>
  has(row, 'getVisibleCells') ? row.getVisibleCells() : row.getAllCells()

const rows = computed(() => props.table.getRowModel().rows)

/** Spans the full width for the loading and empty rows — visible columns only,
 *  or a hidden column would push the message off-centre. */
const columnCount = computed(() =>
  has(loose.value, 'getVisibleLeafColumns')
    ? loose.value.getVisibleLeafColumns().length
    : props.table.getAllLeafColumns().length
)

const paginated = computed(() => has(loose.value, 'getPageCount'))

/**
 * v9 has no `getState()`. Slices live on `table.atoms`, and the Vue adapter
 * backs them with refs — so the read has to happen inside a `computed` (or a
 * template) to be tracked at all. `atoms.pagination` is absent entirely until
 * `rowPaginationFeature` is registered, hence the optional chain.
 */
const pagination = computed(() => loose.value.atoms.pagination?.get())
const pageIndex = computed<number>(() => pagination.value?.pageIndex ?? 0)
const pageSize = computed<number>(() => pagination.value?.pageSize ?? 0)
const pageCount = computed<number>(() => (paginated.value ? loose.value.getPageCount() : 0))

const sizeClass = computed(() => `table-${props.size}`)

/** Per-column daisyUI classes from `columnDef.meta` — see app/types/tanstack-table.d.ts. */
const thClass = (column: Loose) => column.columnDef.meta?.thClass
const tdClass = (column: Loose) => column.columnDef.meta?.tdClass
</script>

<template>
  <div class="flex flex-col gap-4">
    <slot name="toolbar" />

    <!-- overflow-x-auto is what keeps a wide table from widening the page. -->
    <div class="overflow-x-auto">
      <table
        class="table"
        :class="[sizeClass, { 'table-zebra': zebra, 'table-pin-rows': pinRows }]"
      >
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colspan="header.colSpan > 1 ? header.colSpan : undefined"
              :class="thClass(header.column)"
              :aria-sort="ariaSort(header.column)"
            >
              <template v-if="!header.isPlaceholder">
                <!-- A sortable header is a real button so it is keyboard- and
                     screen-reader-reachable, but it carries no `btn` classes:
                     every daisyUI button size sets its own `font-size`, and
                     `btn-xs` renders the label at 11px against 14px rows —
                     smaller than the data it heads. Inheriting `thead`'s own
                     type (14px / 600 / 60% base-content) is what keeps the
                     header reading as a header. Hover lifts it to full contrast
                     for affordance instead.
                     The handler (rather than `toggleSorting()`) is what carries
                     the modifier key through for multi-sort. -->
                <button
                  v-if="canSort(header.column)"
                  type="button"
                  class="group inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-base-content focus-visible:ring-2"
                  @click="sortHandler(header.column)?.($event)"
                >
                  <slot :name="`header-${header.column.id}`" :header="header">
                    <FlexRender :header="header" />
                  </slot>
                  <ArrowUp v-if="sortDirection(header.column) === 'asc'" class="size-3" />
                  <ArrowDown
                    v-else-if="sortDirection(header.column) === 'desc'"
                    class="size-3"
                  />
                  <!-- Idle hint: reserved space, revealed on hover/keyboard focus,
                       so an unsorted column stays quiet without the header
                       reflowing when the icon appears. -->
                  <ChevronsUpDown
                    v-else
                    class="size-3 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
                  />
                </button>
                <slot v-else :name="`header-${header.column.id}`" :header="header">
                  <FlexRender :header="header" />
                </slot>
              </template>
            </th>
          </tr>
        </thead>

        <tbody v-if="loading">
          <tr>
            <td :colspan="columnCount" class="text-center">
              <span class="loading loading-dots"></span>
            </td>
          </tr>
        </tbody>
        <tbody v-else-if="!rows.length">
          <tr>
            <td :colspan="columnCount" class="text-center text-base-content/60">
              <slot name="empty">{{ emptyMessage }}</slot>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="row in rows" :key="row.id">
            <!-- A `#cell-<columnId>` slot lets the page write interactive cells
                 as ordinary daisyUI markup, keeping its click handlers in the
                 page rather than pushing them into `h()` calls in a column def.
                 Without a slot the column's own `cell` definition renders. -->
            <td v-for="cell in cellsOf(row)" :key="cell.id" :class="tdClass(cell.column)">
              <slot
                :name="`cell-${cell.column.id}`"
                :row="row.original"
                :cell="cell"
                :value="cell.getValue()"
              >
                <FlexRender :cell="cell" />
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Only rendered when the page registered `rowPaginationFeature`. -->
    <div
      v-if="paginated && !loading && rows.length"
      class="flex flex-wrap items-center justify-between gap-4"
    >
      <p class="text-sm text-base-content/60">
        Page {{ pageIndex + 1 }} of {{ Math.max(pageCount, 1) }}
      </p>

      <div class="flex items-center gap-2">
        <select
          class="select select-sm w-auto"
          :value="pageSize"
          aria-label="Rows per page"
          @change="loose.setPageSize(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in pageSizes" :key="option" :value="option">
            {{ option }} / page
          </option>
        </select>

        <div class="join">
          <button
            type="button"
            class="btn btn-sm join-item"
            aria-label="First page"
            :disabled="!loose.getCanPreviousPage()"
            @click="loose.firstPage()"
          >
            <ChevronsLeft class="size-4" />
          </button>
          <button
            type="button"
            class="btn btn-sm join-item"
            aria-label="Previous page"
            :disabled="!loose.getCanPreviousPage()"
            @click="loose.previousPage()"
          >
            <ChevronLeft class="size-4" />
          </button>
          <button
            type="button"
            class="btn btn-sm join-item"
            aria-label="Next page"
            :disabled="!loose.getCanNextPage()"
            @click="loose.nextPage()"
          >
            <ChevronRight class="size-4" />
          </button>
          <button
            type="button"
            class="btn btn-sm join-item"
            aria-label="Last page"
            :disabled="!loose.getCanNextPage()"
            @click="loose.lastPage()"
          >
            <ChevronsRight class="size-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
