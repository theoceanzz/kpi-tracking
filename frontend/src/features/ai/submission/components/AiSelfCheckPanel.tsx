import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Lock, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/apiError'
import { useFormat } from '@/i18n/useFormat'
import type { AiSelfCheck, AiSelfCheckAvailability } from '../api/aiReviewApi'
import { useAiSelfCheckAvailability, useLatestAiSelfCheck, useStartAiSelfCheck } from '../hooks/useAiSelfCheck'
import AiBasisList from './AiBasisList'
import { AiItemDetail, AiPanelShell, Bullets, QuoteList, UnreadableFiles } from './AiReviewParts'

interface Props {
  kpiCriteriaId: string
  /** Tên chỉ tiêu, hiện ở đầu phần chi tiết như dòng chỉ tiêu ở màn chấm. */
  kpiName?: string
  /** Bản nháp đang sửa — tệp đã tải lên của nó cũng được đọc. */
  submissionId?: string
  /** Giá trị form ngay lúc bấm (đọc lúc bấm, không theo dõi từng phím). */
  getDraft: () => { actualValue?: number | null; qualitativeLevelId?: string | null; note?: string | null }
  /** Tệp minh chứng đang chọn, chưa tải lên. */
  files: File[]
  /** Dấu vân tay của bài hiện tại — khác lúc soi thì kết quả đang hiện là của bản cũ. */
  signature: string
}

/** Tổ chức / đơn vị đã chủ động tắt — không mời dùng thứ không có. */
const TURNED_OFF: AiSelfCheckAvailability['reason'][] = ['AI_OFF', 'REVIEW_OFF', 'UNIT_OFF']

/**
 * Nhân viên tự nhờ AI soi bài trước khi nộp (khách chốt câu E3: "có token thì được dùng"). Cùng khung với khối
 * "AI đọc trước bài nộp" ở màn chấm của quản lý ({@link AiPanelShell}) để hai nơi trông như một tính năng.
 *
 * <p>Chỉ NHẬN XÉT — không mức chất lượng, không điểm (máy chủ cũng không trả hai thứ đó). Kết quả chỉ chính người
 * nộp xem được, không ảnh hưởng điểm. Chỉ ẩn khi tổ chức / đơn vị đã tắt tính năng; hết token thì nút khoá kèm lý
 * do; không kiểm tra được (máy chủ lỗi, chưa cập nhật) thì vẫn hiện và nói rõ — không bao giờ ẩn im lặng.
 */
export default function AiSelfCheckPanel({ kpiCriteriaId, kpiName, submissionId, getDraft, files, signature }: Props) {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const availabilityQuery = useAiSelfCheckAvailability()
  const availability = availabilityQuery.data
  const turnedOff = !!availability && !availability.available && TURNED_OFF.includes(availability.reason)
  const { data: check } = useLatestAiSelfCheck(kpiCriteriaId, !!availability && !turnedOff)
  const start = useStartAiSelfCheck()
  /** Dấu vân tay của bài lúc bấm soi trong phiên này — mở lại trang thì chưa có, chỉ hiện giờ soi. */
  const [checkedSignature, setCheckedSignature] = useState<string | null>(null)

  if (turnedOff) return null

  const running = check?.status === 'QUEUED' || check?.status === 'RUNNING' || start.isPending
  const stale = !!check && checkedSignature !== null && checkedSignature !== signature
  const canRun = !!availability?.available && !running

  const run = () => {
    setCheckedSignature(signature)
    start.mutate({ kpiCriteriaId, submissionId, files, ...getDraft() })
  }

  const action = running ? null : check ? (
    <Button size="sm" variant="outline" disabled={!canRun} onClick={run}>
      <RefreshCw aria-hidden="true" /> {t('AiSelfCheckPanel.checkAgain')}
    </Button>
  ) : (
    <Button size="sm" disabled={!canRun} onClick={run}>
      <Sparkles aria-hidden="true" /> {t('AiSelfCheckPanel.askAi')}
    </Button>
  )

  return (
    <AiPanelShell
      title={t('AiSelfCheckPanel.title')}
      chipTone="neutral"
      chip={<><Lock size={11} aria-hidden="true" /> {t('AiSelfCheckPanel.privateNote')}</>}
      action={action}
    >
      <div className="space-y-2.5">
        {availabilityQuery.isError ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-error)]">
            <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
            {t('AiSelfCheckPanel.couldNotCheckFeature')}
            <Button size="sm" variant="ghost" onClick={() => availabilityQuery.refetch()}>
              {t('AiSelfCheckPanel.retry')}
            </Button>
          </p>
        ) : running ? (
          <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {t('AiSelfCheckPanel.running')}
          </p>
        ) : !check ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('AiSelfCheckPanel.intro')}</p>
        ) : check.status === 'FAILED' ? (
          <p className="flex items-start gap-2 text-sm text-[var(--color-error)]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t('AiSelfCheckPanel.failed')}
          </p>
        ) : (
          <Result check={check} kpiName={kpiName} stale={stale} />
        )}

        {start.isError && (
          <p className="text-sm text-[var(--color-error)]">
            {getApiErrorMessage(start.error, t('AiSelfCheckPanel.couldNotStart'))}
          </p>
        )}
        {availability && (
          availability.available ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {t('AiSelfCheckPanel.tokensLeft', { tokens: fmt.number(availability.remainingTokens) })}
            </p>
          ) : (
            <p className="text-xs text-[var(--color-warning)]">
              {availability.reason === 'QUOTA_USED' ? t('AiSelfCheckPanel.quotaUsed') : t('AiSelfCheckPanel.noQuota')}
            </p>
          )
        )}
      </div>
    </AiPanelShell>
  )
}

/** Bố cục như kết quả ở màn chấm: tóm tắt, dòng thông tin, tệp không đọc được, rồi khối chi tiết của chỉ tiêu. */
function Result({ check, kpiName, stale }: { check: AiSelfCheck; kpiName?: string; stale: boolean }) {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const empty = !check.strengths.length && !check.gaps.length && !check.suggestions.length

  const meta = [
    t('AiSelfCheckPanel.checkedAt', { time: fmt.dateTime(check.finishedAt ?? check.createdAt) }),
    check.filesTotal ? t('AiSelfCheckPanel.filesRead', { read: check.filesRead ?? 0, total: check.filesTotal }) : null,
    check.criteriaSetVersion != null ? t('AiSelfCheckPanel.criteriaSetVersion', { version: check.criteriaSetVersion }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-3">
      {check.summary && <p className="text-sm text-[var(--color-foreground)]">{check.summary}</p>}
      <p className="text-xs text-[var(--color-muted-foreground)]">{meta}</p>
      {stale && (
        <p className="flex items-start gap-1.5 rounded-control bg-[var(--color-warning-bg)] px-2 py-1.5 text-xs text-[var(--color-warning)]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {t('AiSelfCheckPanel.stale')}
        </p>
      )}
      {check.reused && !stale && <p className="text-xs text-[var(--color-muted-foreground)]">{t('AiSelfCheckPanel.reused')}</p>}

      <UnreadableFiles label={t('AiSelfCheckPanel.unreadable', { count: check.unreadableFiles.length })}
                       files={check.unreadableFiles} />

      <div className="overflow-hidden rounded-control border border-[var(--color-border)]">
        <p className="truncate px-3 py-2.5 text-sm font-medium text-[var(--color-foreground)]">
          {kpiName ?? t('AiSelfCheckPanel.kpi')}
        </p>
        <AiItemDetail>
          {empty && <p className="text-[var(--color-muted-foreground)]">{t('AiSelfCheckPanel.noFindings')}</p>}
          <Bullets title={t('AiSelfCheckPanel.strengths')} items={check.strengths} />
          <QuoteList quotes={check.evidenceQuotes} />
          <Bullets title={t('AiSelfCheckPanel.gaps')} items={check.gaps} />
          <Bullets title={t('AiSelfCheckPanel.suggestions')} items={check.suggestions} />
          <AiBasisList basis={check.basis} />
        </AiItemDetail>
      </div>
    </div>
  )
}
