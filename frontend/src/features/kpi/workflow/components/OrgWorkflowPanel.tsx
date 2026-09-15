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
import { Button } from '@/components/ui/button'
import { Switch as SwitchControl } from '@/components/ui/switch'

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
        <Loader2 className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  // Không có quyền thì vẫn XEM được luồng tổ chức đang chạy — biết mình đang ở trong quy trình
  // nào là thông tin hữu ích cho mọi người, chỉ có quyền SỬA mới cần gác.
  if (!canManage) {
    return (
      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-card bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="text-section-title">Luồng của tổ chức</h3>
            <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
              Chỉ người có quyền cấu hình luồng mới sửa được phần này
            </p>
          </div>
        </div>

        <div className="p-6">
          <p className="text-eyebrow mb-3">Các bước đang bật</p>
          <WorkflowRail preview previewStages={enabledPreview} className="bg-[var(--color-muted)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[var(--color-border)] p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-card bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Workflow size={20} />
            </div>
            <div>
              <h3 className="text-section-title">Luồng của tổ chức</h3>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                Áp dụng cho <b>mọi người</b> — bật/tắt bước ở đây đổi cả luật nghiệp vụ của hệ thống
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
              {resetMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RotateCcw aria-hidden="true" />}
              Đặt lại mặc định
            </Button>
            <Button onClick={save} disabled={updateMutation.isPending || !dirty || warnings.length > 0}>
              {updateMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Lưu thay đổi
            </Button>
          </div>
        </div>

        {/* Bản xem trước: chính thanh tiến trình mà người dùng sẽ thấy trên mọi trang KPI. */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-muted)] p-6">
          <p className="text-eyebrow mb-3">
            Luồng sau khi lưu
          </p>
          <WorkflowRail preview previewStages={enabledPreview} className="bg-[var(--color-card)]" />
        </div>

        {warnings.length > 0 && (
          <div className="border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4 dark:border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)]">
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 text-xs font-medium text-[var(--color-warning)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}

        <div className="divide-y divide-[var(--color-border)]">
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
            className="rounded-control p-0.5 text-[var(--color-subtle-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-muted-foreground)] disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            title="Đưa xuống sau"
            className="rounded-control p-0.5 text-[var(--color-subtle-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-muted-foreground)] disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          {stageIcon(stage.code)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[var(--color-foreground)]">{stage.label}</h4>
            {stage.required && (
              <span
                className="flex items-center gap-1 rounded-control bg-[var(--color-muted)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]"
                title="Bước lõi của luồng, không thể tắt"
              >
                <Lock size={10} /> Bắt buộc
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium text-[var(--color-muted-foreground)]">{STAGE_HINTS[stage.code]}</p>

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
        <label className="text-label flex items-center gap-2 text-[var(--color-muted-foreground)]">
          Tự động từ chối sau
          <input
            type="number"
            min={1}
            max={720}
            value={Number(o.autoRejectAfterHours ?? 24)}
            onChange={(e) => onOption('autoRejectAfterHours', Number(e.target.value))}
            className="w-20 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
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
    <div className="mt-3 flex flex-col gap-2 rounded-card bg-[var(--color-muted)] p-3">{children}</div>
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
    <label className="text-label flex cursor-pointer items-center gap-2 text-[var(--color-muted-foreground)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-ring)]"
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
    <label className="text-label flex flex-col gap-1 text-[var(--color-muted-foreground)]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
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
    <SwitchControl checked={checked} onCheckedChange={onChange} disabled={disabled} title={title} className="mt-1" />
  )
}
