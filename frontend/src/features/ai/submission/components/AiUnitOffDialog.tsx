import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import AiUnitSelect from './AiUnitSelect'
import { useSaveAiReviewUnitSetting } from '../hooks/useAiReview'

/**
 * Chọn một đơn vị để tắt AI gợi ý điểm (áp cả đơn vị con). Từ 13/10 AI không còn trọng số nên đây là cấu hình riêng
 * duy nhất của đơn vị.
 */
export default function AiUnitOffDialog({ taken, onClose }: {
  /** Đơn vị đã tắt — không chọn lại được. */
  taken: Set<string>
  onClose: () => void
}) {
  const { t } = useTranslation('submissions')
  const save = useSaveAiReviewUnitSetting()
  const [unitId, setUnitId] = useState<string | undefined>()
  const draft = useStateDraft(unitId, setUnitId, { key: 'ai-unit-off:new', enabled: true })
  const busy = save.isPending

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!busy}
      title={t('AiUnitWeights.dialog.addTitle')}
      description={t('AiUnitWeights.dialog.turnOffExplain')}
      footer={(
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('AiUnitWeights.dialog.cancel')}</Button>}
          primary={(
            <Button onClick={() => unitId && save.mutate(unitId, { onSuccess: onClose })} disabled={!unitId || busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />} {t('AiUnitWeights.dialog.turnOff')}
            </Button>
          )}
        />
      )}
    >
      <div className="space-y-4">
        <DraftNotice draft={draft} />
        <div className="space-y-1">
          <span className="text-label">{t('AiUnitWeights.dialog.unit')}</span>
          <AiUnitSelect value={unitId} exclude={taken} className="w-full"
                        placeholder={t('AiUnitWeights.dialog.chooseUnit')}
                        onChange={id => setUnitId(id ?? undefined)} />
        </div>
      </div>
    </Dialog>
  )
}
