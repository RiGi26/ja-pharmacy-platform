'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface Column<T extends object> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T extends object> {
  data: T[]
  columns: Column<T>[]
  keyField: keyof T
  loading?: boolean
  emptyMessage?: string
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onRowClick?: (row: T) => void
  /**
   * Optional custom mobile card. When omitted, a card is derived from `columns`:
   * the first titled column becomes the card title, columns with an empty header
   * become the top-right slot (actions/icons), and the rest render as label:value
   * rows. This lets every DataTable page get a usable mobile layout for free while
   * still allowing a bespoke card where the default reads poorly.
   */
  renderMobileCard?: (row: T) => React.ReactNode
}

function cellValue<T extends object>(col: Column<T>, row: T): React.ReactNode {
  return col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')
}

// Column-derived mobile card (see renderMobileCard docs). Kept dumb: no data
// fetching, mirrors exactly what the desktop row renders per column.
function DefaultMobileCard<T extends object>({ row, columns }: { row: T; columns: Column<T>[] }) {
  const actionCols = columns.filter(c => !c.header)
  const dataCols = columns.filter(c => c.header)
  const [primary, ...rest] = dataCols

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
      {(primary || actionCols.length > 0) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-sm font-semibold text-gray-900">
            {primary ? cellValue(primary, row) : null}
          </div>
          {actionCols.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {actionCols.map(c => <span key={c.key}>{cellValue(c, row)}</span>)}
            </div>
          )}
        </div>
      )}
      {rest.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
          {rest.map(c => (
            <div key={c.key} className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-gray-400">{c.header}</span>
              <span className="min-w-0 text-right text-sm text-gray-800">{cellValue(c, row)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Pagination({
  page, totalPages, onPageChange, className,
}: {
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-3', className)}>
      <p className="text-xs text-gray-500">Halaman {page} dari {totalPages}</p>
      <div className="flex gap-1">
        <Button
          variant="outline" size="icon"
          className="h-7 w-7"
          aria-label="Halaman sebelumnya"
          onClick={() => onPageChange?.((page ?? 1) - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline" size="icon"
          className="h-7 w-7"
          aria-label="Halaman berikutnya"
          onClick={() => onPageChange?.((page ?? 1) + 1)}
          disabled={page === totalPages}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function DataTable<T extends object>({
  data, columns, keyField, loading, emptyMessage = 'Tidak ada data',
  page, totalPages, onPageChange, onRowClick, renderMobileCard,
}: DataTableProps<T>) {
  const showPagination = Boolean(totalPages && totalPages > 1)

  return (
    <>
      {/* Desktop table (unchanged) */}
      <div className="hidden lg:block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap',
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map(row => (
                  <tr
                    key={String(row[keyField])}
                    className={cn(
                      'border-b border-gray-50 transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-gray-50'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map(col => (
                      <td key={col.key} className={cn('px-4 py-3 text-gray-700', col.className)}>
                        {cellValue(col, row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showPagination && (
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} className="border-t border-gray-100" />
        )}
      </div>

      {/* Mobile cards (derived from the same columns) */}
      <div className="lg:hidden">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
                <div className="mt-3 h-3 w-full bg-gray-100 rounded animate-pulse" />
                <div className="mt-2 h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-12 text-center text-sm text-gray-400">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(row => (
              <div
                key={String(row[keyField])}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(row)}
              >
                {renderMobileCard ? renderMobileCard(row) : <DefaultMobileCard row={row} columns={columns} />}
              </div>
            ))}
          </div>
        )}

        {showPagination && (
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} className="mt-3 rounded-2xl border border-gray-100 bg-white shadow-sm" />
        )}
      </div>
    </>
  )
}
