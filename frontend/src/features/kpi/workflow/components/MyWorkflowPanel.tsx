import { Eye, EyeOff, RotateCcw, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useWorkflowPrefsStore } from '@/store/workflowPrefsStore'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useKpiWorkflow } from '../hooks/useKpiWorkflow'
import { stageIcon, STAGE_HINTS } from '../workflowStageIcons'
import { Button } from '@/components/ui/button'

/**
 * Thiết lập hiển thị của RIÊNG người đang đăng nhập.
 *
 * Ranh giới với phần tổ chức: ở đây không có gì đổi được luật nghiệp vụ. Ẩn một bước chỉ là gỡ nó
 * khỏi sidebar và thanh tiến trình của chính mình — bước đó vẫn chạy, người khác vẫn thấy, và
 * backend vẫn cưỡng chế y nguyên. Nhờ ranh giới đó, phần này mở cho tất cả mọi người mà không
 * tạo ra rủi ro nào.
 *
 * Chỉ liệt kê những bước người dùng thật sự vào được: ẩn một bước mà mình vốn không có quyền mở
 * là một lựa chọn vô nghĩa.
 */
export default function MyWorkflowPanel() {
  const user = useAuthStore(s => s.user)
  const { hasPermission } = useHasPermission()
  const { enabledStages } = useKpiWorkflow()
  const { isHidden, toggleStage, isRailHidden, setRailHidden, reset } = useWorkflowPrefsStore()

  const userId = user?.id
  const visibleToMe = enabledStages.filter(s => hasPermission(s.navPermission))
  const hiddenCount = visibleToMe.filter(s => isHidden(userId, s.code)).length

  if (!userId || visibleToMe.length === 0) return null

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[var(--color-border)] p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-card bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]">
            <UserCog size={20} />
          </div>
          <div>
            <h3 className="text-section-title">Hiển thị của tôi</h3>
            <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
              Chỉ ảnh hưởng màn hình của bạn — không đổi gì với người khác
            </p>
          </div>
        </div>

        {hiddenCount > 0 && (
          <Button variant="outline" type="button" onClick={() => reset(userId)}>
            <RotateCcw aria-hidden="true" />
            Hiện lại tất cả
          </Button>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-3 border-b border-[var(--color-border)] p-5">
        <input
          type="checkbox"
          checked={!isRailHidden(userId)}
          onChange={e => setRailHidden(userId, !e.target.checked)}
          className="h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-ring)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--color-foreground)]">
            Hiện thanh tiến trình trên các trang KPI
          </span>
          <span className="mt-0.5 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Dải các bước nằm ngay dưới thanh tiêu đề, giúp biết mình đang ở đâu trong luồng
          </span>
        </span>
      </label>

      <div className="divide-y divide-[var(--color-border)]">
        {visibleToMe.map(stage => {
          const hidden = isHidden(userId, stage.code)
          return (
            <div key={stage.code} className={cn('flex items-start gap-4 p-5 transition-opacity', hidden && 'opacity-50')}>
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                {stageIcon(stage.code)}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-[var(--color-foreground)]">{stage.label}</h4>
                <p className="mt-1 text-xs font-medium text-[var(--color-muted-foreground)]">{STAGE_HINTS[stage.code]}</p>
              </div>

              <button
                type="button"
                onClick={() => toggleStage(userId, stage.code)}
                title={hidden ? 'Hiện lại bước này' : 'Ẩn bước này khỏi màn hình của tôi'}
                className={cn(
                  'text-eyebrow flex shrink-0 items-center gap-2 rounded-card px-3 py-2 transition-colors',
                  hidden
                    ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)]'
                    : 'text-[var(--color-success)] hover:bg-[var(--color-success-bg)] dark:text-[var(--color-success)] dark:hover:bg-[var(--color-success-bg)]',
                )}
              >
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                <span className="hidden sm:inline">{hidden ? 'Đang ẩn' : 'Đang hiện'}</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
