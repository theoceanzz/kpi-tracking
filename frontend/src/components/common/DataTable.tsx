import { useEffect, useRef } from 'react'
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
  /**
   * Chọn nhiều hàng (UX_PATTERNS.md §R1). Bật thì thêm cột checkbox đầu bảng; checkbox ở đầu
   * bảng chọn/bỏ toàn bộ hàng CHỌN ĐƯỢC của trang hiện tại, hiện trạng thái nửa chọn khi
   * mới chọn một phần. Hàng đang chọn có nền primary-soft.
   */
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  /** Hàng nào không chọn được (vd đã duyệt rồi) thì ô checkbox để trống. */
  isRowSelectable?: (row: T) => boolean
}

/**
 * Bảng dữ liệu chuẩn. Hàng cao 44px (py-3 + chữ 14/20) — đủ thoáng để quét mà 20 hàng
 * vẫn vừa một màn 1080p. Đầu bảng dùng nhãn nhỏ chữ hoa, nền muted, dính khi cuộn.
 * Dưới `md` chuyển sang danh sách thẻ: mỗi cột thành một cặp nhãn–giá trị.
 */
export default function DataTable<T>({
  columns, data, keyExtractor, onRowClick, emptyMessage = 'Chưa có dữ liệu', renderMobileCard,
  selectable, selectedKeys, onSelectionChange, isRowSelectable,
}: DataTableProps<T>) {
  const selected = selectedKeys ?? new Set<string>()
  const selectableRows = selectable ? data.filter(r => isRowSelectable?.(r) ?? true) : []
  const selectableKeys = selectableRows.map(keyExtractor)
  const selectedOnPage = selectableKeys.filter(k => selected.has(k)).length
  const allSelected = selectableKeys.length > 0 && selectedOnPage === selectableKeys.length
  const someSelected = selectedOnPage > 0 && !allSelected

  const headRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someSelected
  }, [someSelected])

  const toggleAll = () => {
    const next = new Set(selected)
    if (allSelected) selectableKeys.forEach(k => next.delete(k))
    else selectableKeys.forEach(k => next.add(k))
    onSelectionChange?.(next)
  }
  const toggleOne = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange?.(next)
  }

  const checkboxCls = 'h-4 w-4 cursor-pointer rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-card)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2'

  if (data.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] py-12 text-center text-sm text-[var(--color-muted-foreground)]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2.5">
                  {selectableKeys.length > 0 && (
                    <input
                      ref={headRef}
                      type="checkbox"
                      aria-label={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      checked={allSelected}
                      onChange={toggleAll}
                      className={checkboxCls}
                    />
                  )}
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn('px-4 py-2.5 text-left text-eyebrow', headerAlignClass(col.className))}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.map((row) => {
              const key = keyExtractor(row)
              const canSelect = selectable && (isRowSelectable?.(row) ?? true)
              const isSelected = selectable && selected.has(key)
              return (
              <tr
                  key={key}
                onClick={() => onRowClick?.(row)}
                  aria-selected={selectable ? isSelected : undefined}
                  className={cn(
                    'transition-colors',
                    isSelected ? 'bg-[var(--color-primary-soft)]' : onRowClick && 'hover:bg-[var(--color-muted)]',
                    onRowClick && 'cursor-pointer'
                  )}
              >
                  {selectable && (
                    <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                      {canSelect && (
                        <input
                          type="checkbox"
                          aria-label="Chọn hàng"
                          checked={isSelected}
                          onChange={() => toggleOne(key)}
                          className={checkboxCls}
                        />
                      )}
                    </td>
                  )}
                {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-sm text-[var(--color-foreground)]', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {data.map((row) => {
          const key = keyExtractor(row)
          const canSelect = selectable && (isRowSelectable?.(row) ?? true)
          const isSelected = selectable && selected.has(key)
          return (
          <div
              key={key}
            onClick={() => onRowClick?.(row)}
              className={cn(
                'rounded-card border bg-[var(--color-card)] p-4',
                isSelected ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)]',
                onRowClick && 'cursor-pointer active:bg-[var(--color-muted)] transition-colors'
              )}
          >
              {canSelect && (
                <label className="mb-3 flex items-center gap-2 text-caption" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleOne(key)} className={checkboxCls} />
                  Chọn
                </label>
              )}
            {renderMobileCard ? renderMobileCard(row) : (
              <dl className="space-y-2">
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-3 text-sm">
                      <dt className="shrink-0 text-eyebrow">{col.header}</dt>
                      <dd className={cn('text-right', col.className)}>{col.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          )
        })}
      </div>
    </>
  )
}
