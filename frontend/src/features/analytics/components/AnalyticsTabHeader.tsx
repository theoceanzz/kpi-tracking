import type { ReactNode } from 'react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { cn } from '@/lib/utils'

interface AnalyticsTabHeaderProps {
  title: string
  description?: string
  /** Nút Tuỳ chỉnh bố cục (DashboardEditToolbar) hoặc hành động khác của tab. */
  actions?: ReactNode
  /** Các ô lọc: bộ lọc thời gian + lọc riêng của tab. */
  filters?: ReactNode
  /** Thanh lọc có dính đầu trang khi cuộn không — mặc định có, vì lọc áp cho mọi biểu đồ bên dưới. */
  sticky?: boolean
  className?: string
}

/**
 * Đầu trang chuẩn cho mọi tab Phân tích (UX_PATTERNS.md §P2 áp cho trang biểu đồ).
 *
 * Trước đây mỗi tab tự vẽ hai khối: dòng tiêu đề + nút Tuỳ chỉnh, rồi một "Bộ lọc …" có
 * icon vuông và tiêu đề lặp lại tên tab. Gộp về một `WorkspaceHeader` (tiêu đề, mô tả, nút)
 * và một hàng lọc chỉ chứa ô lọc — bộ lọc không cần tự giới thiệu nó là bộ lọc.
 */
export default function AnalyticsTabHeader({ title, description, actions, filters, sticky = true, className }: AnalyticsTabHeaderProps) {
  // Trả về fragment, KHÔNG bọc thêm div: `sticky` chỉ bám trong phạm vi phần tử cha, bọc lại
  // là hàng lọc chỉ dính được trong cái hộp nhỏ của riêng nó rồi trôi theo khi cuộn.
  return (
    <>
      <WorkspaceHeader
        id="tour-analytics-header"
        title={title}
        description={description}
        actions={actions ? <div id="tour-analytics-customize">{actions}</div> : undefined}
        className={className}
      />
      {filters && (
        <div
          id="tour-analytics-filter"
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2',
            sticky && 'sticky top-0 z-20',
          )}
        >
          {filters}
        </div>
      )}
    </>
  )
}
