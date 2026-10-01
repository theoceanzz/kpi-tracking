import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useFormat } from '@/i18n/useFormat'
import { useAiReview, useRequestAiReview } from '../hooks/useAiReview'
import AiBasisList from './AiBasisList'
import AiScoreBreakdown, { type ReviewWeights } from './AiScoreBreakdown'
import { AiItemDetail, AiPanelShell, Bullets, QuoteList, UnreadableFiles } from './AiReviewParts'
import type { AiReview, AiReviewConfidence, AiReviewItem } from '../api/aiReviewApi'

interface Props {
  periodId: string
  userId: string
}

const CONFIDENCE_CLS: Record<AiReviewConfidence, string> = {
  CAO: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]',
  TRUNG_BINH: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
  THAP: 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]',
}

/**
 * "Nhờ AI xem trước" trong màn chấm: AI đọc bài nộp và gợi ý điểm đánh giá — quản lý quyết.
 *
 * <p>Điểm gợi ý nằm trên THANG ĐIỂM ĐÁNH GIÁ (cùng thang ô quản lý nhập): mỗi chỉ tiêu định lượng có điểm tối đa, chia
 * theo ba trọng số đạt chỉ tiêu / chất lượng / đúng hạn, mỗi phần kèm lý do ({@link AiScoreBreakdown}). Chỉ tiêu
 * định tính chỉ gợi ý MỨC. Điểm AI không tự điền vào ô nào; chỉ hiện khi tổ chức bật và người dùng có `AI_REVIEW:USE`.
 */
export default function AiReviewPanel({ periodId, userId }: Props) {
  const { t } = useTranslation('submissions')
  const user = useAuthStore(s => s.user)
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const { hasPermission } = useHasPermission()
  const available = !!org?.enableAi && !!org?.enableAiReview && hasPermission('AI_REVIEW:USE')

  const { data: review, isLoading } = useAiReview(periodId, userId, available)
  const requestMutation = useRequestAiReview(periodId, userId)

  if (!available) return null

  const running = review?.status === 'QUEUED' || review?.status === 'RUNNING' || requestMutation.isPending

  return (
    <AiPanelShell
      title={t('AiReviewPanel.title')}
      chip={review?.disclaimer ?? t('AiReviewPanel.disclaimer')}
      action={review?.status === 'DONE' || review?.status === 'FAILED' ? (
        <Button size="sm" variant="outline" disabled={running}
                onClick={() => requestMutation.mutate({ rerunId: review.id })}>
          <RefreshCw aria-hidden="true" /> {t('AiReviewPanel.rerun')}
        </Button>
      ) : !running && (
        <Button size="sm" disabled={isLoading} onClick={() => requestMutation.mutate({})}>
          <Sparkles aria-hidden="true" /> {t('AiReviewPanel.ask')}
        </Button>
      )}
    >
      {running ? (
        <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {t('AiReviewPanel.running')}
        </p>
      ) : !review ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('AiReviewPanel.intro')}</p>
      ) : review.status === 'FAILED' ? (
        <p className="flex items-start gap-2 text-sm text-[var(--color-error)]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {review.errorMessage ?? t('AiReviewPanel.failed')}
        </p>
      ) : (
        <ReviewResult review={review} />
      )}
    </AiPanelShell>
  )
}

function ReviewResult({ review }: { review: AiReview }) {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const n = (v?: number | null) => (v == null ? '—' : fmt.number(v, { maximumFractionDigits: 1 }))
  const weights: ReviewWeights = { target: review.weightTarget, quality: review.weightQuality, onTime: review.weightOnTime }
  const meta = [
    review.filesTotal ? t('AiReviewPanel.filesRead', { read: review.filesRead ?? 0, total: review.filesTotal }) : null,
    review.criteriaSetVersion != null ? t('AiReviewPanel.criteriaSetVersion', { version: review.criteriaSetVersion }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-3">
      {review.suggestedTotal != null && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-[var(--color-muted-foreground)]">{t('AiReviewPanel.suggestedTotal')}</span>
          <span className="text-lg font-semibold tabular-nums text-[var(--color-ai)]">{n(review.suggestedTotal)}</span>
          <span className="text-[var(--color-muted-foreground)]">/ 100</span>
          {review.systemTotal != null && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              · {t('AiReviewPanel.systemTotal', { points: n(review.systemTotal) })}
            </span>
          )}
        </p>
      )}
      {/* Định tính nằm trên thang hành vi riêng — như hệ thống tách điểm KPI và điểm hành vi. */}
      {review.behaviorSuggestedTotal != null && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-[var(--color-muted-foreground)]">{t('AiReviewPanel.behaviorTotal')}</span>
          <span className="text-lg font-semibold tabular-nums text-[var(--color-ai)]">{n(review.behaviorSuggestedTotal)}</span>
          <span className="text-[var(--color-muted-foreground)]">/ 100</span>
          {review.behaviorSuggestedLevel && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              → {t('AiReviewPanel.levelOf', { level: review.behaviorSuggestedLevel })}
            </span>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-2">
        {review.confidence && (
          <span className={cn('rounded-control border px-2 py-0.5 text-xs font-medium', CONFIDENCE_CLS[review.confidence])}>
            {t(`AiReviewPanel.confidence.${review.confidence}`)}
          </span>
        )}
        {review.overallSummary && (
          <p className="min-w-0 flex-1 text-sm text-[var(--color-foreground)]">{review.overallSummary}</p>
        )}
      </div>

      <Bullets title={t('AiReviewPanel.missingData')} items={review.missingData} />
      {meta && <p className="text-xs text-[var(--color-muted-foreground)]">{meta}</p>}
      <UnreadableFiles label={t('AiReviewPanel.unreadable', { count: review.unreadableFiles.length })}
                       files={review.unreadableFiles} />

      <ul className="divide-y divide-[var(--color-border)] rounded-control border border-[var(--color-border)]">
        {review.items.map(item => <ItemRow key={item.id} item={item} weights={weights} />)}
      </ul>
    </div>
  )
}

function ItemRow({ item, weights }: { item: AiReviewItem; weights: ReviewWeights }) {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const n = (v?: number | null) => (v == null ? '—' : fmt.number(v, { maximumFractionDigits: 1 }))
  const [open, setOpen] = useState(false)
  // Lượt kiểu mới có điểm trên thang đánh giá; lượt cũ (trước 30/09) chỉ có điểm theo trọng số thô.
  const onEvalScale = item.maxPoints != null
  const hasDetail = onEvalScale || !!(item.qualityComment || item.evidenceQuotes.length || item.strengths.length
    || item.gaps.length || item.suggestions.length || item.summary || item.basis?.length)

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
          <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{item.kpiCriteriaName ?? t('AiReviewPanel.kpi')}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {t('AiReviewPanel.qualityLabel')}{' '}
            <span className="font-medium text-[var(--color-foreground)]">{item.qualityLevel ?? t('AiReviewPanel.qualityUnknown')}</span>
            {item.qualitative
              ? item.selfLevel && <>{' · '}{t('AiReviewPanel.selfLevel', { level: item.selfLevel })}</>
              : <>{' · '}{t('AiReviewPanel.achievement', { percent: n(item.achievementPercent) })}</>}
            {' · '}{t('AiReviewPanel.onTime', { percent: n(item.onTimePercent) })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {item.qualitative && onEvalScale ? (
            <>
              <p className="text-sm font-semibold tabular-nums text-[var(--color-ai)]">
                {n(item.suggestedScore)}
                <span className="text-xs font-normal text-[var(--color-muted-foreground)]"> / {n(item.maxPoints)}</span>
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {item.suggestedLevel ? `→ ${t('AiReviewPanel.levelOf', { level: item.suggestedLevel })}` : t('AiReviewPanel.behaviorScale')}
              </p>
            </>
          ) : item.qualitative ? (
            <>
              <p className="text-sm font-semibold text-[var(--color-ai)]">{item.qualityLevel ?? '—'}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{t('AiReviewPanel.suggestedLevel')}</p>
            </>
          ) : onEvalScale ? (
            <>
              <p className="text-sm font-semibold tabular-nums text-[var(--color-ai)]">
                {n(item.suggestedScore)}
                <span className="text-xs font-normal text-[var(--color-muted-foreground)]"> / {n(item.maxPoints)}</span>
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {t('AiReviewPanel.systemPoints', { points: n(item.systemPoints) })}
              </p>
            </>
          ) : item.weight ? (
            <>
              <p className="text-sm font-semibold tabular-nums text-[var(--color-ai)]">
                {n(item.suggestedScore)}
                <span className="text-xs font-normal text-[var(--color-muted-foreground)]"> / {n(item.weight)}</span>
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{t('AiReviewPanel.legacyScore')}</p>
            </>
          ) : (
            <p className="text-xs text-[var(--color-muted-foreground)]">{t('AiReviewPanel.noWeight')}</p>
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
        <AiItemDetail>
          {onEvalScale && <AiScoreBreakdown item={item} weights={weights} />}
          {item.summary && <p className="text-[var(--color-foreground)]">{item.summary}</p>}
          {/* Kiểu mới: nhận xét chất lượng đã nằm ở lý do phần "Chất lượng" trong bảng chia điểm. */}
          {!onEvalScale && item.qualityComment && (
            <p><span className="font-medium">{t('AiReviewPanel.qualityComment')} </span>{item.qualityComment}</p>
          )}
          <QuoteList quotes={item.evidenceQuotes} />
          <Bullets title={t('AiReviewPanel.strengths')} items={item.strengths} />
          <Bullets title={t('AiReviewPanel.gaps')} items={item.gaps} />
          <Bullets title={t('AiReviewPanel.suggestions')} items={item.suggestions} />
          <AiBasisList basis={item.basis} />
        </AiItemDetail>
      )}
    </li>
  )
}
