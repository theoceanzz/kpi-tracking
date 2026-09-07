import { Eye, EyeOff, RotateCcw, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useWorkflowPrefsStore } from '@/store/workflowPrefsStore'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useKpiWorkflow } from '../hooks/useKpiWorkflow'
import { stageIcon, STAGE_HINTS } from '../workflowStageIcons'

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
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
            <UserCog size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-white">Hiển thị của tôi</h3>
            <p className="text-xs font-medium text-slate-500">
              Chỉ ảnh hưởng màn hình của bạn — không đổi gì với người khác
            </p>
          </div>
        </div>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => reset(userId)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RotateCcw size={16} />
            Hiện lại tất cả
          </button>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
        <input
          type="checkbox"
          checked={!isRailHidden(userId)}
          onChange={e => setRailHidden(userId, !e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            Hiện thanh tiến trình trên các trang KPI
          </span>
          <span className="mt-0.5 block text-xs font-medium text-slate-500">
            Dải các bước nằm ngay dưới thanh tiêu đề, giúp biết mình đang ở đâu trong luồng
          </span>
        </span>
      </label>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {visibleToMe.map(stage => {
          const hidden = isHidden(userId, stage.code)
          return (
            <div key={stage.code} className={cn('flex items-start gap-4 p-5 transition-opacity', hidden && 'opacity-50')}>
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                {stageIcon(stage.code)}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 dark:text-white">{stage.label}</h4>
                <p className="mt-1 text-xs font-medium text-slate-500">{STAGE_HINTS[stage.code]}</p>
              </div>

              <button
                type="button"
                onClick={() => toggleStage(userId, stage.code)}
                title={hidden ? 'Hiện lại bước này' : 'Ẩn bước này khỏi màn hình của tôi'}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors',
                  hidden
                    ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                    : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20',
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
