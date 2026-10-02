import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'

/**
 * Ngày rà soát và ngày hết hiệu lực (docs/DOCUMENTS_DESIGN.md §16.3) — dùng ở hộp tải lên và drawer sửa. Giá trị là
 * chuỗi `yyyy-MM-dd` ('' = không đặt). Hết hiệu lực trước ngày rà soát thì vẫn cho lưu, chỉ nhắc.
 */
export default function DocumentDateFields({ reviewDate, expiryDate, onReviewDate, onExpiryDate, idPrefix = 'doc' }: {
  reviewDate: string
  expiryDate: string
  onReviewDate: (v: string) => void
  onExpiryDate: (v: string) => void
  idPrefix?: string
}) {
  const { t } = useTranslation('documents')
  const odd = !!reviewDate && !!expiryDate && expiryDate < reviewDate
  return (
    <div className="space-y-1.5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-label" htmlFor={`${idPrefix}-review`}>{t('fields.reviewDate')}</label>
          <Input id={`${idPrefix}-review`} type="date" value={reviewDate} onChange={e => onReviewDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-label" htmlFor={`${idPrefix}-expiry`}>{t('fields.expiryDate')}</label>
          <Input id={`${idPrefix}-expiry`} type="date" value={expiryDate} onChange={e => onExpiryDate(e.target.value)} />
        </div>
      </div>
      <p className="text-caption">{odd ? t('fields.datesOdd') : t('fields.datesHint')}</p>
    </div>
  )
}
