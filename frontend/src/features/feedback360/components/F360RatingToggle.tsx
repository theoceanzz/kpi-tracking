import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { getApiErrorMessage } from '@/lib/apiError'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useUpdateOrganization } from '@/features/orgunits/hooks/useUpdateOrganization'
import { useOrgId } from '../hooks/useFeedback360'
import { useTranslation } from 'react-i18next'

/**
 * Cửa cho phép chiến dịch 360 đi vào xếp loại kỳ (§7.2). Chỉ là cửa: từng chiến dịch vẫn phải tự
 * chọn chế độ ảnh hưởng điểm, và kỳ đã chốt dữ liệu dùng điểm 360 đã chụp nên gạt ở đây không làm
 * đổi kết quả cũ.
 */
export default function F360RatingToggle() {
  const { t } = useTranslation('feedback360')
  const orgId = useOrgId()
  const { data: org } = useOrganization(orgId)
  const update = useUpdateOrganization(orgId)
  const on = !!org?.feedback360AffectsRating

  return (
    <div className="flex items-start justify-between gap-4 rounded-control border border-[var(--color-border)] p-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-foreground)]">{t('F360RatingToggle.allow360ToCountTowardThe')}</p>
        <p className="text-caption">
          {t('F360RatingToggle.whenOnEach360CampaignLinked')}
        </p>
      </div>
      <Switch
        checked={on}
        disabled={!org || update.isPending}
        aria-label={t('F360RatingToggle.allow360ToCountTowardThe')}
        onCheckedChange={v => update.mutate({ feedback360AffectsRating: v }, {
          onSuccess: () => toast.success(v ? t('F360RatingToggle.allowed360ToCountTowardThe') : t('F360RatingToggle.turnedOffCounting360TowardThe')),
          onError: e => toast.error(getApiErrorMessage(e, t('F360RatingToggle.couldNotUpdateTheConfiguration'))),
        })}
      />
    </div>
  )
}
