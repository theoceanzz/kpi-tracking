import { useMemo, useState } from 'react'
import { ClipboardCheck, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import { Button } from '@/components/ui/button'

/**
 * Các đợt người dùng đã tắt lời nhắc, lưu theo id đợt.
 *
 * Lưu ID chứ không lưu cờ true/false: một cờ chung thì tắt một lần là im cho MỌI đợt về sau,
 * còn ở đây đợt sau hoàn tất vẫn nhắc lại, đúng ý "tắt cái đang hiện thôi".
 */
const STORAGE_KEY = 'selfEvalPromptDismissedPeriods'

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư) hoặc dữ liệu cũ hỏng. Coi như chưa tắt
    // còn hơn để cả lời nhắc chết vì một API lưu trữ không thiết yếu.
    return []
  }
}

/**
 * Nhắc tự đánh giá khi một kỳ đã hoàn tất mà chưa có phiếu.
 *
 * <p><b>Là một dải nhắc, KHÔNG phải modal tự bật.</b> Bản trước mở thẳng form tự đánh giá ngay
 * khi trang chủ vẽ xong: vừa đăng nhập đã bị một hộp thoại che hết màn hình, mà cờ "đã hiện"
 * chỉ nằm trong state của component nên rời trang rồi quay lại là nó bật tiếp, và đóng đi cũng
 * không ai nhớ. Người dùng phải là bên quyết định lúc nào ngồi tự chấm — lời nhắc chỉ có việc
 * nói ra rằng có đợt đang chờ, và im lặng khi đã bị tắt.
 */
export default function CompletedPeriodEvaluationPrompt() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)

  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const { data: myKpis } = useMyKpi({ size: 100 })
  const { data: allSubmissions } = useMySubmissions({ size: 100 })
  const { data: evaluations } = useEvaluations({ userId: user?.id, size: 50 })

  const completedPeriod = useMemo(() => {
    if (!periodsData?.content || !myKpis?.content || !allSubmissions?.content || !evaluations?.content) return null

    const sorted = [...periodsData.content].sort(
      (a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime()
    )

    for (const period of sorted) {
      if (evaluations.content.some(e => e.kpiPeriodId === period.id)) continue
      const periodKpis = myKpis.content.filter(k => k.kpiPeriodId === period.id)
      if (periodKpis.length === 0) continue

      const isCompleted = periodKpis.every(kpi => {
        const approved = allSubmissions.content.filter(s => s.kpiCriteriaId === kpi.id && s.status === 'APPROVED')
        return kpi.frequency === 'UNLIMITED' || approved.length >= kpi.expectedSubmissions
      })
      if (isCompleted) return period
    }
    return null
  }, [periodsData, myKpis, allSubmissions, evaluations])

  if (!completedPeriod) return null
  if (dismissed.includes(completedPeriod.id)) return null

  const dismiss = () => {
    const next = [...dismissed, completedPeriod.id]
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Không lưu được thì lần tải trang sau lại nhắc. Chấp nhận được; ném lỗi ở đây sẽ
      // làm hỏng chính cú bấm tắt.
    }
    setDismissed(next)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--color-card)] text-[var(--color-primary)]">
          <ClipboardCheck size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            Đợt “{completedPeriod.name}” đã hoàn tất — bạn chưa tự đánh giá
          </p>
          <p className="text-caption">Mọi chỉ tiêu của đợt đã được duyệt. Tự đánh giá để quản lý chấm tiếp.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>Tự đánh giá ngay</Button>
        <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Tắt lời nhắc cho đợt này" title="Tắt lời nhắc cho đợt này">
          <X aria-hidden="true" />
        </Button>
      </div>

      <EvaluationFormModal
        open={open}
        onClose={() => setOpen(false)}
        initialPeriodId={completedPeriod.id}
        readOnly={false}
      />
    </>
  )
}
