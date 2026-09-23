import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Lock, Maximize2, Minimize2, RotateCcw, Save, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useKpiWorkflow,
  useResetKpiWorkflow,
  useUpdateKpiWorkflow,
} from '../hooks/useKpiWorkflow'
import type { WorkflowStage, WorkflowStageCode } from '../types'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { stageIcon, STAGE_ACTORS } from '../workflowStageIcons'
import WorkflowGraph from './graph/WorkflowGraph'
import StageInspector from './graph/StageInspector'

/**
 * Cấu hình luồng KPI cho toàn tổ chức — vẽ thành sơ đồ nút–cạnh, chỉnh ngay trên sơ đồ.
 *
 * Trước đây là danh sách dọc mười dòng kèm bản xem trước dải tiến trình. Danh sách không cho thấy
 * HÌNH DẠNG của quy trình: bước nào rẽ nhánh, tắt một bước thì đường đi vòng qua đâu, "Không
 * duyệt" quay về chỗ nào. Sơ đồ trả lời cả ba ngay khi nhìn.
 *
 * Bản nháp, cảnh báo phụ thuộc, lưu, đặt lại — giữ nguyên như cũ; chỉ phần trình bày đổi.
 *
 * Luật bố cục: từ lúc vẽ xong, canvas KHÔNG được dịch chuyển vì một thao tác trên chính nó. Cảnh
 * báo là lớp phủ trong canvas, bảng chi tiết là drawer nổi — cả hai không nằm trong dòng chảy bố
 * cục. Trước đây dải cảnh báo chèn giữa header và canvas: tắt một bước là canvas trôi xuống 50px,
 * công tắc vừa bấm rời khỏi con trỏ, muốn bật lại phải dò chuột.
 */
export default function OrgWorkflowPanel() {
  const { stages, isLoading, canManage } = useKpiWorkflow()
  const updateMutation = useUpdateKpiWorkflow()
  const resetMutation = useResetKpiWorkflow()

  const [draft, setDraft] = useState<WorkflowStage[]>([])
  const [syncedFrom, setSyncedFrom] = useState<WorkflowStage[] | null>(null)
  const [selected, setSelected] = useState<WorkflowStageCode | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  // Esc thoát toàn màn hình — nhưng chỉ khi drawer đóng: drawer tự nuốt Esc để đóng chính nó.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selected) setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [fullscreen, selected])

  // Nạp lại bản nháp mỗi khi cấu hình từ server đổi (tải xong, lưu xong, đặt lại mặc định).
  // Chỉnh state ngay trong lúc render theo đúng mẫu React khuyến nghị cho việc đồng bộ theo props,
  // thay vì useEffect — useEffect ở đây gây thêm một lượt render thừa cho mỗi lần dữ liệu về.
  if (stages.length > 0 && stages !== syncedFrom) {
    setSyncedFrom(stages)
    setDraft(stages.map((s) => ({ ...s, options: { ...s.options } })))
  }

  /**
   * Kiểm phụ thuộc ngay tại chỗ, cùng luật với `WorkflowConfigValidator` bên backend.
   * Backend vẫn kiểm lại khi lưu — bản ở đây chỉ để người dùng thấy vấn đề trước khi bấm Lưu.
   *
   * Trả về theo MÃ BƯỚC (không chỉ là danh sách câu) để sơ đồ tô được đúng nút đang có vấn đề.
   */
  const warningsByCode = useMemo(() => {
    const byCode = new Map(draft.map((s) => [s.code, s]))
    const out: Partial<Record<WorkflowStageCode, string>> = {}
    for (const stage of draft) {
      if (!stage.enabled) continue
      for (const req of stage.requires) {
        if (byCode.get(req)?.enabled === false) {
          out[stage.code] = `Bước "${stage.label}" cần bước "${byCode.get(req)?.label}" cũng được bật.`
        }
      }
    }
    return out
  }, [draft])
  const warnings = useMemo(() => Object.values(warningsByCode), [warningsByCode])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(stages), [draft, stages])

  const toggle = useCallback(
    (code: WorkflowStageCode) =>
      setDraft((prev) => prev.map((s) => (s.code === code ? { ...s, enabled: !s.enabled } : s))),
    [],
  )

  const setOption = (code: WorkflowStageCode, key: string, value: unknown) =>
    setDraft((prev) =>
      prev.map((s) => (s.code === code ? { ...s, options: { ...s.options, [key]: value } } : s)),
    )

  const save = () =>
    updateMutation.mutate({
      stages: draft.map((s) => ({
        code: s.code,
        enabled: s.enabled,
        // Không còn màn nào đổi thứ tự; gửi nguyên giá trị đang có vì backend vẫn đòi trường này.
        order: s.order,
        options: s.options,
      })),
    })

  const selectedStage = selected ? (draft.find((s) => s.code === selected) ?? null) : null

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  const readOnly = !canManage

  const warningOverlay = warnings.length > 0 && (
    <div className="space-y-1 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 shadow-sm">
      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 text-xs font-medium text-[var(--color-warning)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {w}
        </p>
      ))}
    </div>
  )

  return (
    <>
      <div
        className={cn(
          'flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm',
          // Toàn màn hình: cả thẻ phủ kín viewport. z-[900] nằm trên sidebar/header ứng dụng nhưng
          // DƯỚI Drawer (1000) và SelectContent (1100) để drawer vẫn mở đè lên được.
          fullscreen ? 'fixed inset-0 z-[900] rounded-none' : 'rounded-card',
        )}
      >
        <div className="flex shrink-0 flex-col gap-4 border-b border-[var(--color-border)] p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={
                readOnly
                  ? 'flex h-10 w-10 items-center justify-center rounded-card bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]'
                  : 'flex h-10 w-10 items-center justify-center rounded-card bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
              }
            >
              {readOnly ? <Lock size={20} /> : <Workflow size={20} />}
            </div>
            <div>
              <h3 className="text-section-title">Luồng của tổ chức</h3>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                {readOnly
                  ? 'Chỉ người có quyền cấu hình luồng mới sửa được. Bạn đang xem quy trình tổ chức đang áp dụng.'
                  : <>Áp dụng cho <b>mọi người</b> — bật/tắt bước ở đây đổi cả luật nghiệp vụ. Bấm một bước để mở cài đặt.</>}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Không có quyền thì vẫn XEM được luồng tổ chức đang chạy — biết mình đang ở trong quy
                trình nào là thông tin hữu ích cho mọi người, chỉ có quyền SỬA mới cần gác. */}
            {!readOnly && (
              <>
                <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                  {resetMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RotateCcw aria-hidden="true" />}
                  Đặt lại mặc định
                </Button>
                <Button onClick={save} disabled={updateMutation.isPending || !dirty || warnings.length > 0}>
                  {updateMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                  Lưu thay đổi
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setFullscreen((v) => !v)}
              title={fullscreen ? 'Thoát toàn màn hình (Esc)' : 'Toàn màn hình'}
              aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            >
              {fullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            </Button>
          </div>
        </div>

        {/* Chiều cao: calc(100vh-…) ở chế độ thường (bẫy h-full trong trang Thiết lập công ty),
            flex-1 khi toàn màn hình vì lúc đó thẻ đã có chiều cao xác định. */}
        <WorkflowGraph
          stages={draft}
          selected={selected}
          onSelect={setSelected}
          warnings={warningsByCode}
          readOnly={readOnly}
          onToggle={readOnly ? undefined : toggle}
          overlay={warningOverlay}
          className={fullscreen ? 'min-h-0 flex-1' : 'h-[calc(100vh-250px)] min-h-[560px]'}
        />
      </div>

      <Drawer
        open={!!selectedStage}
        onClose={() => setSelected(null)}
        size="md"
        title={selectedStage?.label ?? ''}
        description={selectedStage ? STAGE_ACTORS[selectedStage.code] : undefined}
        headerExtra={
          selectedStage && (
            <span className="ml-1 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                {stageIcon(selectedStage.code, 15)}
              </span>
              {!readOnly && (
                selectedStage.required ? (
                  <span
                    className="flex items-center gap-1 rounded-control bg-[var(--color-muted)] px-1.5 py-1 text-[11px] font-medium text-[var(--color-muted-foreground)]"
                    title="Bước lõi của luồng, không thể tắt"
                  >
                    <Lock size={11} /> Bắt buộc
                  </span>
                ) : (
                  <Switch size="sm" checked={selectedStage.enabled} onCheckedChange={() => toggle(selectedStage.code)} />
                )
              )}
            </span>
          )
        }
      >
        {selectedStage && (
          <StageInspector
            stage={selectedStage}
            allStages={draft}
            warning={warningsByCode[selectedStage.code]}
            readOnly={readOnly}
            onOption={setOption}
          />
        )}
      </Drawer>
    </>
  )
}
