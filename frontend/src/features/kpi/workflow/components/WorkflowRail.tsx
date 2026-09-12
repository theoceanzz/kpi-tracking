import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { useAuthStore } from '@/store/authStore'
import { useWorkflowPrefsStore } from '@/store/workflowPrefsStore'
import { useKpiWorkflow } from '../hooks/useKpiWorkflow'
import { stageIcon, STAGE_HINTS } from '../workflowStageIcons'
import type { WorkflowStage } from '../types'

interface Props {
  /** Render từ cấu hình đang chỉnh thay vì cấu hình đã lưu — dùng cho bản xem trước ở trang cấu hình. */
  previewStages?: WorkflowStage[]
  /** Bản xem trước hiện mọi bước kể cả bước người xem không có quyền, và không gắn liên kết. */
  preview?: boolean
  className?: string
}

/**
 * Thanh tiến trình nối các bước của luồng KPI.
 *
 * Lý do tồn tại: trước đây tám trang của luồng đều là ngõ cụt. Tạo đợt xong không có gì dẫn sang
 * bước giao chỉ tiêu — người dùng phải tự quay lại sidebar và tự nhớ mình đang ở đâu. Thanh này
 * hiện đúng những bước tổ chức đang bật, tô sáng bước hiện tại, và mang theo đợt đang chọn qua
 * `?periodId=` nên sang trang sau không phải chọn lại từ đầu.
 */
export default function WorkflowRail({ previewStages, preview = false, className }: Props) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { hasPermission } = useHasPermission()
  const { user } = useAuthStore()
  const { enabledStages, stageForPath, showRail } = useKpiWorkflow()
  const { data: customLabels } = useSidebarSettings(user?.memberships?.[0]?.organizationId ?? '')
  const isStageHiddenByMe = useWorkflowPrefsStore(s => s.isHidden)
  const railHiddenByMe = useWorkflowPrefsStore(s => s.isRailHidden)(user?.id)

  const source = previewStages ?? enabledStages
  const current = preview ? undefined : stageForPath(location.pathname)

  // Ba tầng lọc, mỗi tầng một lý do khác nhau:
  // 1. tổ chức TẮT bước (đã lọc sẵn trong enabledStages) — luật nghiệp vụ;
  // 2. người xem không có quyền mở — hiện ra rồi dẫn tới trang 403 thì tệ hơn là không hiện;
  // 3. chính người dùng ẨN bước khỏi màn hình của họ ở trang Luồng KPI — thuần hiển thị.
  const visible = preview
    ? source
    : source.filter(s => hasPermission(s.navPermission) && !isStageHiddenByMe(user?.id, s.code))

  if (!preview && (!showRail || railHiddenByMe || visible.length < 2)) return null

  // Mang bối cảnh đợt sang bước kế tiếp. Dùng lại đúng quy ước deep-link sẵn có của dự án
  // (?kpiId=, ?periodId=, ?tab=) thay vì dựng một context provider riêng.
  const periodId = searchParams.get('periodId')
  const withContext = (route: string) => {
    const [path, query] = route.split('?')
    const params = new URLSearchParams(query)

    // Bước Tự đánh giá được đăng ký là /evaluations?action=self-eval — một HÀNH ĐỘNG mở sẵn modal,
    // và trang đích chỉ mở khi có ĐỦ cả action lẫn periodId. Chưa chọn đợt mà vẫn gắn action thì
    // liên kết trông như hỏng: bấm vào không có gì xảy ra. Bỏ action đi, để nó dẫn về trang đánh
    // giá bình thường cho tới khi có bối cảnh đợt.
    if (!periodId) {
      params.delete('action')
      const rest = params.toString()
      return rest ? `${path}?${rest}` : (path ?? route)
    }

    if (!params.has('periodId')) params.set('periodId', periodId)
    return `${path}?${params.toString()}`
  }

  /**
   * Nhãn tuỳ chỉnh của tổ chức chỉ áp cho bước có route là một TRANG thật.
   *
   * Bước Tự đánh giá đăng ký là `/evaluations?action=self-eval` — cùng trang với Kết quả đánh giá.
   * Cắt bỏ query rồi tra bảng nhãn khiến hai bước nhận CHUNG một nhãn, và thanh bước hiện ra hai
   * mục trùng tên y hệt nhau. Bước gắn query giữ nhãn gốc của nó.
   */
  const labelOf = (stage: WorkflowStage) =>
    (stage.route.includes('?') ? undefined : customLabels?.[stage.route]) || stage.label

  return (
    <nav
      aria-label="Các bước của luồng KPI"
      className={cn(
        'flex items-center gap-1 overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-1.5',
        '',
        className,
      )}
    >
      {visible.map((stage, index) => {
        const isCurrent = current?.code === stage.code
        const content = (
          <>
            <span className={cn('shrink-0', isCurrent ? 'text-[var(--color-primary)]' : 'text-[var(--color-subtle-foreground)]')}>
              {stageIcon(stage.code, 16)}
            </span>
            <span className="whitespace-nowrap">{labelOf(stage)}</span>
          </>
        )

        const shared = cn(
          'flex items-center gap-2 rounded-card px-3 py-2 text-xs font-medium transition-colors',
          isCurrent
            ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
            : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
        )

        return (
          <div key={stage.code} className="flex items-center">
            {index > 0 && <ChevronRight size={14} className="mx-0.5 shrink-0 text-[var(--color-subtle-foreground)]" />}
            {preview ? (
              <span className={shared} title={STAGE_HINTS[stage.code]}>
                {content}
              </span>
            ) : (
              <Link
                to={withContext(stage.route)}
                className={shared}
                title={STAGE_HINTS[stage.code]}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {content}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
