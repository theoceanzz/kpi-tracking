import { cn } from '@/lib/utils'

interface DataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  /**
   * Áp cho CẢ ô dữ liệu lẫn ô tiêu đề, để cột căn phải thì tiêu đề cũng căn phải —
   * cột số mà tiêu đề nằm lệch một bên thì mắt không nối được đầu cột với giá trị.
   * Dùng `cn()` (có tailwind-merge) nên `text-right` đè được `text-left` mặc định.
   */
  className?: string
}

/** Lớp căn chỉnh áp cho tiêu đề; bỏ những lớp chỉ có nghĩa với ô dữ liệu. */
const headerAlignClass = (className?: string) =>
  (className ?? '')
    .split(' ')
    .filter((c) => c.startsWith('text-right') || c.startsWith('text-center') || c.startsWith('text-left'))
    .join(' ')

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  /** Custom mobile card renderer for screens below `md`. Falls back to an auto-generated label/value card from `columns`. */
  renderMobileCard?: (row: T) => React.ReactNode
}

export default function DataTable<T>({ columns, data, keyExtractor, onRowClick, emptyMessage = 'Chưa có dữ liệu', renderMobileCard }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-muted-foreground)]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--color-muted)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]',
                    headerAlignClass(col.className)
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-[var(--color-accent)] transition-colors' : ''}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            onClick={() => onRowClick?.(row)}
            className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 ${onRowClick ? 'cursor-pointer active:bg-[var(--color-accent)] transition-colors' : ''}`}
          >
            {renderMobileCard ? renderMobileCard(row) : (
              <dl className="space-y-2">
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] shrink-0">{col.header}</dt>
                    <dd className={`text-right ${col.className ?? ''}`}>{col.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
