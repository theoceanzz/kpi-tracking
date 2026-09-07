import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Lock, RotateCcw, Save, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useKpiWorkflow,
  useResetKpiWorkflow,
  useUpdateKpiWorkflow,
} from '../hooks/useKpiWorkflow'
import WorkflowRail from './WorkflowRail'
import { stageIcon, STAGE_HINTS } from '../workflowStageIcons'
import type { WorkflowStage, WorkflowStageCode } from '../types'

/**
 * Cấu hình luồng KPI cho toàn tổ chức.
 *
 * Mô hình tương tác mượn nguyên từ phần tuỳ chỉnh dashboard ở trang Thống kê (bật/tắt hiển thị,
 * lưu, đặt lại mặc định) để người dùng không phải học lại một kiểu thao tác thứ hai.
 *
 * Bản xem trước bên dưới chính là `WorkflowRail` thật, dựng từ cấu hình ĐANG chỉnh — nên thấy ngay
 * kết quả trước khi lưu, thay vì phải lưu rồi đi dò từng trang.
 */
export default function OrgWorkflowPanel() {
  const { stages, isLoading, canManage } = useKpiWorkflow()
  const updateMutation = useUpdateKpiWorkflow()
  const resetMutation = useResetKpiWorkflow()

  const [draft, setDraft] = useState<WorkflowStage[]>([])
  const [syncedFrom, setSyncedFrom] = useState<WorkflowStage[] | null>(null)

  // Nạp lại bản nháp mỗi khi cấu hình từ server đổi (tải xong, lưu xong, đặt lại mặc định).
  // Chỉnh state ngay trong lúc render theo đúng mẫu React khuyến nghị cho việc đồng bộ theo props,
  // thay vì useEffect — useEffect ở đây gây thêm một lượt render thừa cho mỗi lần dữ liệu về.
  if (stages.length > 0 && stages !== syncedFrom) {
    setSyncedFrom(stages)
    setDraft(stages.map((s) => ({ ...s, options: { ...s.options } })))
  }

  const enabledPreview = useMemo(
    () => draft.filter((s) => s.enabled).sort((a, b) => a.order - b.order),
    [draft],
  )

  /**
   * Kiểm phụ thuộc ngay tại chỗ, cùng luật với `WorkflowConfigValidator` bên backend.
   * Backend vẫn kiểm lại khi lưu — bản ở đây chỉ để người dùng thấy vấn đề trước khi bấm Lưu.
   */
  const warnings = useMemo(() => {
    const byCode = new Map(draft.map((s) => [s.code, s]))
    const messages: string[] = []
    for (const stage of draft) {
      if (!stage.enabled) continue
      for (const req of stage.requires) {
        if (byCode.get(req)?.enabled === false) {
          messages.push(`Bước "${stage.label}" cần bước "${byCode.get(req)?.label}" cũng được bật.`)
        }
      }
    }
    return messages
  }, [draft])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(stages), [draft, stages])

  const toggle = (code: WorkflowStageCode) =>
    setDraft((prev) => prev.map((s) => (s.code === code ? { ...s, enabled: !s.enabled } : s)))

  const setOption = (code: WorkflowStageCode, key: string, value: unknown) =>
    setDraft((prev) =>
      prev.map((s) => (s.code === code ? { ...s, options: { ...s.options, [key]: value } } : s)),
    )

  /**
   * Đổi thứ tự HIỂN THỊ của hai bước liền kề.
   *
   * Chỉ là thứ tự trình bày trong menu và thanh tiến trình — thứ tự NGHIỆP VỤ do phụ thuộc dữ liệu
   * quyết định và không đổi được (không thể nộp báo cáo trước khi có chỉ tiêu để nộp).
   */
  const move = (code: WorkflowStageCode, direction: -1 | 1) =>
    setDraft((prev) => {
      const ordered = [...prev].sort((a, b) => a.order - b.order)
      const from = ordered.findIndex((s) => s.code === code)
      const to = from + direction
      if (from < 0 || to < 0 || to >= ordered.length) return prev

      const swapped = [...ordered]
      const a = swapped[from]
      const b = swapped[to]
      if (!a || !b) return prev
      swapped[from] = b
      swapped[to] = a

      // Đánh lại số thứ tự liên tục từ 1, để không tích luỹ khoảng trống sau nhiều lần đổi chỗ.
      return swapped.map((s, i) => ({ ...s, order: i + 1 }))
    })

  const save = () =>
    updateMutation.mutate({
      stages: draft.map((s) => ({
        code: s.code,
        enabled: s.enabled,
        order: s.order,
        options: s.options,
      })),
    })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    )
  }

  // Không có quyền thì vẫn XEM được luồng tổ chức đang chạy — biết mình đang ở trong quy trình
  // nào là thông tin hữu ích cho mọi người, chỉ có quyền SỬA mới cần gác.
  if (!canManage) {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-white">Luồng của tổ chức</h3>
            <p className="text-xs font-medium text-slate-500">
              Chỉ người có quyền cấu hình luồng mới sửa được phần này
            </p>
          </div>
        </div>

        <div className="p-6">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Các bước đang bật</p>
          <WorkflowRail preview previewStages={enabledPreview} className="bg-slate-50 dark:bg-slate-800/40" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30">
              <Workflow size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Luồng của tổ chức</h3>
              <p className="text-xs font-medium text-slate-500">
                Áp dụng cho <b>mọi người</b> — bật/tắt bước ở đây đổi cả luật nghiệp vụ của hệ thống
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {resetMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              Đặt lại mặc định
            </button>
            <button
              onClick={save}
              disabled={updateMutation.isPending || !dirty || warnings.length > 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Lưu thay đổi
            </button>
          </div>
        </div>

        {/* Bản xem trước: chính thanh tiến trình mà người dùng sẽ thấy trên mọi trang KPI. */}
        <div className="border-b border-slate-100 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-800/30">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Luồng sau khi lưu
          </p>
          <WorkflowRail preview previewStages={enabledPreview} className="bg-white dark:bg-slate-900" />
        </div>

        {warnings.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {draft
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((stage, index, list) => (
              <StageRow
                key={stage.code}
                stage={stage}
                isFirst={index === 0}
                isLast={index === list.length - 1}
                onToggle={() => toggle(stage.code)}
                onMove={(dir) => move(stage.code, dir)}
                onOption={(k, v) => setOption(stage.code, k, v)}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

function StageRow({
  stage,
  isFirst,
  isLast,
  onToggle,
  onMove,
  onOption,
}: {
  stage: WorkflowStage
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onMove: (direction: -1 | 1) => void
  onOption: (key: string, value: unknown) => void
}) {
  return (
    <div className={cn('p-5 transition-opacity', !stage.enabled && 'opacity-60')}>
      <div className="flex items-start gap-4">
        {/* Đổi thứ tự hiển thị. Dùng nút thay vì kéo-thả để bàn phím và màn hình cảm ứng đều dùng được. */}
        <div className="mt-0.5 flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            title="Đưa lên trước"
            className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:hover:bg-transparent dark:hover:bg-slate-800"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            title="Đưa xuống sau"
            className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:hover:bg-transparent dark:hover:bg-slate-800"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
          {stageIcon(stage.code)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 dark:text-white">{stage.label}</h4>
            {stage.required && (
              <span
                className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:bg-slate-800"
                title="Bước lõi của luồng, không thể tắt"
              >
                <Lock size={10} /> Bắt buộc
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">{STAGE_HINTS[stage.code]}</p>

          {stage.enabled && <StageOptions stage={stage} onOption={onOption} />}
        </div>

        <Switch
          checked={stage.enabled}
          disabled={stage.required}
          onChange={onToggle}
          title={stage.required ? 'Bước lõi của luồng, không thể tắt' : undefined}
        />
      </div>
    </div>
  )
}

/** Tuỳ chọn riêng của từng bước. Chỉ hiện khi bước đang bật — tắt rồi thì tuỳ chọn vô nghĩa. */
function StageOptions({
  stage,
  onOption,
}: {
  stage: WorkflowStage
  onOption: (key: string, value: unknown) => void
}) {
  const o = stage.options ?? {}

  if (stage.code === 'CRITERIA_APPROVAL') {
    return (
      <OptionBox>
        <Check
          label="Người có quyền tự duyệt thì chỉ tiêu họ tạo là đã duyệt ngay"
          checked={o.allowSelfApprove !== false}
          onChange={(v) => onOption('allowSelfApprove', v)}
        />
        <Select
          label="Ai được duyệt"
          value={String(o.approverMode ?? 'UNIT_HEAD')}
          onChange={(v) => onOption('approverMode', v)}
          options={[
            { value: 'UNIT_HEAD', label: 'Cấp trên trực tiếp (mặc định)' },
            { value: 'ANY_WITH_PERMISSION', label: 'Bất kỳ ai có quyền duyệt trong đơn vị' },
          ]}
        />
      </OptionBox>
    )
  }

  if (stage.code === 'CRITERIA_ADJUSTMENT') {
    return (
      <OptionBox>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          Tự động từ chối sau
          <input
            type="number"
            min={1}
            max={720}
            value={Number(o.autoRejectAfterHours ?? 24)}
            onChange={(e) => onOption('autoRejectAfterHours', Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
          />
          giờ
        </label>
      </OptionBox>
    )
  }

  if (stage.code === 'SUBMISSION') {
    return (
      <OptionBox>
        <Check
          label="Cho phép lưu nháp trước khi nộp"
          checked={o.allowDraft !== false}
          onChange={(v) => onOption('allowDraft', v)}
        />
        <Check
          label="Bắt buộc đính kèm minh chứng"
          checked={o.requireAttachment === true}
          onChange={(v) => onOption('requireAttachment', v)}
        />
      </OptionBox>
    )
  }

  if (stage.code === 'SUBMISSION_REVIEW') {
    return (
      <OptionBox>
        <Select
          label="Chế độ duyệt"
          value={String(o.mode ?? 'MANUAL')}
          onChange={(v) => onOption('mode', v)}
          options={[
            { value: 'MANUAL', label: 'Quản lý duyệt thủ công (mặc định)' },
            { value: 'AUTO_APPROVE', label: 'Tự động duyệt mọi bản nộp' },
          ]}
        />
      </OptionBox>
    )
  }

  return null
}

function OptionBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">{children}</div>
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      {label}
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Switch({
  checked,
  disabled,
  onChange,
  title,
}: {
  checked: boolean
  disabled?: boolean
  onChange: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      title={title}
      className={cn(
        'relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
