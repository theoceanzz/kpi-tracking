import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useFormat } from '@/i18n/useFormat'
import { useAiReview } from '../hooks/useAiReview'
import AiBasisList from './AiBasisList'
import AiScoreBreakdown, { type ReviewWeights } from './AiScoreBreakdown'
import AiConfidenceBars from './AiConfidenceBars'
import { AiItemDetail, AiPanelShell, Bullets, QuoteList, UnreadableFiles } from './AiReviewParts'
import type { AiReview, AiReviewItem } from '../api/aiReviewApi'

interface Props {
  periodId: string
  userId: string
}

/**
 * Khối "AI đọc trước bài nộp" ở màn Xem đánh giá — CHỈ ĐỂ XEM. Từ 06/10 AI chỉ chấm từng chỉ tiêu khi quản lý bấm
 * "Gợi ý" ở ô của phiếu chấm, nên khối này không còn nút chạy; nó hiện kết quả hiện hành của từng chỉ tiêu.
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

  const { data: review } = useAiReview(periodId, userId, available)

  if (!available) return null

  const running = review?.status === 'QUEUED' || review?.status === 'RUNNING' || !!review?.runningCriteriaIds?.length

  return (
    <AiPanelShell title={t('AiReviewPanel.title')} chip={review?.disclaimer ?? t('AiReviewPanel.disclaimer')}>
      {running && (
        <p className="mb-3 flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {t('AiReviewPanel.running')}
        </p>
      )}
      {review?.items.length ? (
        <ReviewResult review={review} />
      ) : review?.status === 'FAILED' ? (
        <p className="flex items-start gap-2 text-sm text-[var(--color-error)]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {review.errorMessage ?? t('AiReviewPanel.failed')}
        </p>
      ) : !running && (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('AiReviewPanel.introPerKpi')}</p>
      )}
    </AiPanelShell>
  )
}

/** Trọng số đạt chỉ tiêu / chất lượng / đúng hạn của lượt — để giải thích cách chia điểm. */
function weightsOf(review: AiReview): ReviewWeights {
  return { target: review.weightTarget, quality: review.weightQuality, onTime: review.weightOnTime }
}

/**
 * Kết quả hiện hành: nhận xét chung (chỉ lượt chấm cả phiếu trước 06/10 mới có), rồi từng chỉ tiêu mở ra xem cách
 * chia điểm. Mỗi chỉ tiêu mang mức tin cậy riêng; không còn "tin cậy chung".
 */
function ReviewResult({ review }: { review: AiReview }) {
  const { t } = useTranslation('submissions')
  const weights = weightsOf(review)
  return (
    <div className="space-y-3">
      {review.overallSummary && (
        <p className="text-sm text-[var(--color-foreground)]">{review.overallSummary}</p>
      )}
      <Bullets title={t('AiReviewPanel.missingData')} items={review.missingData} />
      {review.criteriaSetVersion != null && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {t('AiReviewPanel.criteriaSetVersion', { version: review.criteriaSetVersion })}
        </p>
      )}
      <UnreadableFiles label={t('AiReviewPanel.unreadable', { count: review.unreadableFiles.length })}
                       files={review.unreadableFiles} />

      <ul className="divide-y divide-[var(--color-border)] rounded-control border border-[var(--color-border)]">
        {review.items.map(item => <ItemRow key={item.id} item={item} weights={weights} />)}
      </ul>
    </div>
  )
}

/** Có gì để mở ra xem không — lượt cũ trước 30/09 có thể chỉ có điểm. */
function hasDetail(item: AiReviewItem) {
  return item.maxPoints != null || !!(item.qualityComment || item.evidenceQuotes.length || item.strengths.length
    || item.gaps.length || item.suggestions.length || item.summary || item.basis?.length)
}

function ItemRow({ item, weights }: { item: AiReviewItem; weights: ReviewWeights }) {
  const [open, setOpen] = useState(false)
  const expandable = hasDetail(item)
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        disabled={!expandable}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-muted)] disabled:cursor-default disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        <ItemSummary item={item} />
        <AiConfidenceBars level={item.confidence} />
        {expandable && (
          <ChevronDown size={16} aria-hidden="true"
                       className={cn('shrink-0 text-[var(--color-muted-foreground)] transition-transform', open && 'rotate-180')} />
        )}
      </button>
      {item.errorMessage && (
        <p className="px-3 pb-2 text-xs text-[var(--color-error)]">{item.errorMessage}</p>
      )}
      {open && <ItemDetail item={item} weights={weights} />}
    </li>
  )
}

/** Dòng tóm tắt một chỉ tiêu: tên + chất lượng · đạt · đúng hạn bên trái, điểm AI bên phải. */
export function ItemSummary({ item, showName = true }: { item: AiReviewItem; showName?: boolean }) {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const n = (v?: number | null) => (v == null ? '-' : fmt.number(v, { maximumFractionDigits: 1 }))
  // Lượt kiểu mới có điểm trên thang đánh giá; lượt cũ (trước 30/09) chỉ có điểm theo trọng số thô.
  const onEvalScale = item.maxPoints != null
  return (
    <>
      <div className="min-w-0 flex-1">
        {showName && (
          <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{item.kpiCriteriaName ?? t('AiReviewPanel.kpi')}</p>
        )}
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
            <p className="text-sm font-semibold text-[var(--color-ai)]">{item.qualityLevel ?? '-'}</p>
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
    </>
  )
}

/**
 * Chi tiết AI chấm MỘT chỉ tiêu: mức tin cậy + lý do, chia điểm ba phần, nhận xét, trích dẫn, căn cứ. Dùng cho dòng mở
 * ra ở khối Xem đánh giá và cho hộp "Cách AI chấm" của phiếu chấm.
 */
export function ItemDetail({ item, weights }: { item: AiReviewItem; weights: ReviewWeights }) {
  const { t } = useTranslation('submissions')
  const onEvalScale = item.maxPoints != null
  return (
    <AiItemDetail>
      <AiConfidenceBars size="md" level={item.confidence} reasons={item.confidenceReasons}
                        qualityLevel={item.qualityLevel} />
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
  )
}
