import { useState } from 'react'
import { AlertTriangle, ChevronDown, FileWarning, Loader2, Quote, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAiReview, useRequestAiReview } from '../hooks/useAiReview'
import type { AiReview, AiReviewConfidence, AiReviewItem } from '../api/aiReviewApi'

interface Props {
  periodId: string
  userId: string
}

/** Nhãn bắt buộc ở MỌI chỗ hiện kết quả — không có cờ tắt. */
const DISCLAIMER = 'Kết quả do AI gợi ý – cần quản lý xác nhận'

const CONFIDENCE: Record<AiReviewConfidence, { label: string; cls: string }> = {
  CAO: { label: 'Tin cậy cao', cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]' },
  TRUNG_BINH: { label: 'Tin cậy trung bình', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]' },
  THAP: { label: 'Tin cậy thấp', cls: 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]' },
}

const fmt = (v?: number | null, suffix = '') =>
  v == null ? '—' : `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}${suffix}`

/**
 * "Nhờ AI xem trước" trong màn chấm: AI đọc phần chữ của các bài nộp và đề xuất — quản lý quyết.
 *
 * <p>Điểm AI không tự điền vào ô điểm nào: quản lý tự nhập ở luồng chấm hiện có. Khối này chỉ đọc.
 * Chỉ hiện khi tổ chức bật tính năng và người dùng có quyền `AI_REVIEW:USE`.
 */
export default function AiReviewPanel({ periodId, userId }: Props) {
  const user = useAuthStore(s => s.user)
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const { hasPermission } = useHasPermission()
  const available = !!org?.enableAi && !!org?.enableAiReview && hasPermission('AI_REVIEW:USE')

  const { data: review, isLoading } = useAiReview(periodId, userId, available)
  const requestMutation = useRequestAiReview(periodId, userId)

  if (!available) return null

  const running = review?.status === 'QUEUED' || review?.status === 'RUNNING' || requestMutation.isPending

  return (
    <section className="rounded-card border border-[var(--color-ai-line)] bg-[var(--color-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-ai)]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">AI đọc trước bài nộp</h3>
          <span className="rounded-control border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
            {review?.disclaimer ?? DISCLAIMER}
          </span>
        </div>
        {review?.status === 'DONE' || review?.status === 'FAILED' ? (
          <Button size="sm" variant="outline" disabled={running}
                  onClick={() => requestMutation.mutate({ rerunId: review.id })}>
            <RefreshCw aria-hidden="true" /> Chạy lại
          </Button>
        ) : !running && (
          <Button size="sm" disabled={isLoading} onClick={() => requestMutation.mutate({})}>
            <Sparkles aria-hidden="true" /> Nhờ AI xem trước
          </Button>
        )}
      </header>

      <div className="px-4 py-3">
        {running ? (
          <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            AI đang đọc bài nộp… Bạn có thể đóng màn này, kết quả vẫn được giữ.
          </p>
        ) : !review ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            AI đọc phần chữ nhân viên đã viết, tóm tắt, nhận xét chất lượng và đề xuất điểm cho từng chỉ tiêu.
            % đáp ứng và đúng hạn do hệ thống tính; điểm chính thức vẫn là điểm bạn chấm.
          </p>
        ) : review.status === 'FAILED' ? (
          <p className="flex items-start gap-2 text-sm text-[var(--color-error)]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {review.errorMessage ?? 'AI chưa phân tích được lượt này.'}
          </p>
        ) : (
          <ReviewResult review={review} />
        )}
      </div>
    </section>
  )
}

function ReviewResult({ review }: { review: AiReview }) {
  const conf = review.confidence ? CONFIDENCE[review.confidence] : null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        {conf && (
          <span className={cn('rounded-control border px-2 py-0.5 text-xs font-medium', conf.cls)}>{conf.label}</span>
        )}
        {review.overallSummary && (
          <p className="min-w-0 flex-1 text-sm text-[var(--color-foreground)]">{review.overallSummary}</p>
        )}
      </div>

      {review.missingData.length > 0 && (
        <div className="text-sm">
          <p className="font-medium text-[var(--color-foreground)]">Còn thiếu để đánh giá chắc hơn</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--color-muted-foreground)]">
            {review.missingData.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {(!!review.filesTotal || review.criteriaSetVersion != null) && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {!!review.filesTotal && `AI đã đọc ${review.filesRead ?? 0}/${review.filesTotal} tệp minh chứng`}
          {!!review.filesTotal && review.criteriaSetVersion != null && ' · '}
          {review.criteriaSetVersion != null && `chấm theo bộ tiêu chí phiên bản ${review.criteriaSetVersion}`}
        </p>
      )}

      {review.unreadableFiles.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
          <FileWarning size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p>AI không đọc được {review.unreadableFiles.length} tệp — hãy tự mở xem:</p>
            <ul className="mt-0.5 list-disc pl-4">
              {review.unreadableFiles.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        </div>
      )}

      <ul className="divide-y divide-[var(--color-border)] rounded-control border border-[var(--color-border)]">
        {review.items.map(item => <ItemRow key={item.id} item={item} />)}
      </ul>
    </div>
  )
}

function ItemRow({ item }: { item: AiReviewItem }) {
  const [open, setOpen] = useState(false)
  const hasDetail = !!(item.qualityComment || item.evidenceQuotes.length || item.strengths.length
    || item.gaps.length || item.suggestions.length || item.summary)

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        disabled={!hasDetail}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-muted)] disabled:cursor-default disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{item.kpiCriteriaName ?? 'Chỉ tiêu'}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Chất lượng: <span className="font-medium text-[var(--color-foreground)]">{item.qualityLevel ?? 'chưa xác định'}</span>
            {' · '}Đáp ứng {fmt(item.achievementPercent, '%')}
            {' · '}Đúng hạn {fmt(item.onTimePercent, '%')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {/* Chỉ tiêu không có trọng số (thưởng, định tính ngoài pool) không đóng góp điểm — "0 / 0" chỉ gây rối. */}
          {item.weight ? (
            <>
              <p className="text-sm font-semibold tabular-nums text-[var(--color-ai)]">
                {fmt(item.suggestedScore)}
                <span className="text-xs font-normal text-[var(--color-muted-foreground)]"> / {fmt(item.weight)}</span>
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">điểm AI đề xuất</p>
            </>
          ) : (
            <p className="text-xs text-[var(--color-muted-foreground)]">không tính trọng số</p>
          )}
        </div>
        {hasDetail && (
          <ChevronDown size={16} aria-hidden="true"
                       className={cn('shrink-0 text-[var(--color-muted-foreground)] transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {item.errorMessage && (
        <p className="px-3 pb-2 text-xs text-[var(--color-error)]">{item.errorMessage}</p>
      )}

      {open && (
        <div className="space-y-2 bg-[var(--color-muted)] px-3 py-3 text-sm">
          {item.summary && <p className="text-[var(--color-foreground)]">{item.summary}</p>}
          {item.qualityComment && (
            <p><span className="font-medium">Nhận xét chất lượng: </span>{item.qualityComment}</p>
          )}
          {item.evidenceQuotes.length > 0 && (
            <div className="space-y-1">
              {item.evidenceQuotes.map((q, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs italic text-[var(--color-muted-foreground)]">
                  <Quote size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {q}
                </p>
              ))}
            </div>
          )}
          <Bullets title="Điểm mạnh" items={item.strengths} />
          <Bullets title="Cần bổ sung" items={item.gaps} />
          <Bullets title="Gợi ý chỉnh sửa" items={item.suggestions} />
        </div>
      )}
    </li>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="font-medium text-[var(--color-foreground)]">{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-[var(--color-muted-foreground)]">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  )
}
