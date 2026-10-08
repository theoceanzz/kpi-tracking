import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ItemDetail, ItemSummary } from './AiReviewPanel'
import type { AiReview, AiReviewItem } from '../api/aiReviewApi'

/**
 * "Xem cách AI chấm" của MỘT chỉ tiêu — mở từ nút trong ô "AI chấm" của phiếu chấm. Điểm chia ba phần (đạt chỉ tiêu /
 * chất lượng / đúng hạn) kèm lý do, mức tin cậy kèm "vì sao", trích dẫn và căn cứ; chân hộp có "Chấm lại bài này".
 */
export default function AiReviewDetailDialog({ open, onClose, item, review, onRescore, rescoring }: {
  open: boolean
  onClose: () => void
  item: AiReviewItem
  /** Kết quả hiện hành — lấy trọng số ba phần và nhãn "do AI gợi ý". */
  review: AiReview
  onRescore: () => void
  rescoring: boolean
}) {
  const { t } = useTranslation('submissions')
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t('AiReviewDetail.title')}
      description={<><span className="font-medium text-[var(--color-foreground)]">{item.kpiCriteriaName}</span> · {review.disclaimer || t('AiReviewPanel.disclaimer')}</>}
      footer={
        <DialogFooter
          note={t('AiReviewDetail.note')}
          secondary={<Button variant="outline" onClick={onClose}>{t('AiReviewDetail.close')}</Button>}
          primary={
            <Button variant="outline" onClick={onRescore} disabled={rescoring}>
              <RefreshCw className={rescoring ? 'animate-spin' : undefined} aria-hidden="true" /> {t('ScorerColumns.aiRescoreRow')}
            </Button>
          }
        />
      }
    >
      <div className="overflow-hidden rounded-control border border-[var(--color-border)]">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <ItemSummary item={item} showName={false} />
        </div>
        {item.errorMessage && <p className="px-3 pb-2 text-xs text-[var(--color-error)]">{item.errorMessage}</p>}
        <ItemDetail item={item} weights={{ target: review.weightTarget, quality: review.weightQuality, onTime: review.weightOnTime }} />
      </div>
    </Dialog>
  )
}
