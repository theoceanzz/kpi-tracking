import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import AiUnitSelect from './AiUnitSelect'
import AiWeightFields from './AiWeightFields'
import { weightTotal, type AiWeights } from './aiWeights'
import { useSaveAiReviewUnitSetting } from '../hooks/useAiReview'

interface Props {
  /** Đơn vị đang sửa; không truyền = thêm mới (chọn đơn vị trong hộp thoại). */
  unit?: { id: string; name: string; enabled: boolean; weights: AiWeights }
  /** Trọng số mặc định của công ty — điền sẵn khi thêm mới hoặc khi đơn vị đang "Tắt AI". */
  companyWeights: AiWeights
  /** Đơn vị đã có trọng số riêng — không chọn lại được. */
  taken: Set<string>
  onClose: () => void
}

interface Form {
  unitId?: string
  enabled: boolean
  weights: AiWeights
}

/**
 * Thêm / sửa trọng số riêng của một đơn vị (áp cả đơn vị con), hoặc tắt AI gợi ý điểm cho đơn vị đó. Tách thành hộp
 * thoại để khỏi trông như một cấu hình thứ hai của công ty (người dùng phản hồi 30/09).
 */
export default function AiUnitWeightDialog({ unit, companyWeights, taken, onClose }: Props) {
  const { t } = useTranslation('submissions')
  const save = useSaveAiReviewUnitSetting()
  const [form, setForm] = useState<Form>(() => unit
    ? { unitId: unit.id, enabled: unit.enabled, weights: unit.enabled ? unit.weights : companyWeights }
    : { unitId: undefined, enabled: true, weights: companyWeights })
  const draft = useStateDraft(form, setForm, { key: `ai-unit-weight:${unit?.id ?? 'new'}`, enabled: true })

  const busy = save.isPending
  const canSave = !!form.unitId && (!form.enabled || weightTotal(form.weights) === 100) && !busy

  const submit = () => {
    if (!form.unitId) return
    // Tắt AI thì trọng số không dùng tới, nhưng API vẫn đòi tổng 100 — gửi trọng số công ty.
    const weights = form.enabled ? form.weights : companyWeights
    save.mutate({ orgUnitId: form.unitId, body: { enabled: form.enabled, ...weights } }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!busy}
      title={unit ? t('AiUnitWeights.dialog.editTitle', { unit: unit.name }) : t('AiUnitWeights.dialog.addTitle')}
      description={t('AiUnitWeights.dialog.description')}
      footer={(
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('AiUnitWeights.dialog.cancel')}</Button>}
          primary={(
            <Button onClick={submit} disabled={!canSave}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />} {t('AiUnitWeights.dialog.save')}
            </Button>
          )}
        />
      )}
    >
      <div className="space-y-4">
        <DraftNotice draft={draft} />
        {!unit && (
          <div className="space-y-1">
            <span className="text-label">{t('AiUnitWeights.dialog.unit')}</span>
            <AiUnitSelect value={form.unitId} exclude={taken} className="w-full"
                          placeholder={t('AiUnitWeights.dialog.chooseUnit')}
                          onChange={id => setForm(f => ({ ...f, unitId: id ?? undefined }))} />
          </div>
        )}

        <div className="space-y-1.5">
          <span className="text-label">{t('AiUnitWeights.dialog.thisUnitWill')}</span>
          <div className="flex flex-wrap gap-2" role="group">
            <ChoiceChip selected={form.enabled} onClick={() => setForm(f => ({ ...f, enabled: true }))}>
              {t('AiUnitWeights.dialog.useOwnWeights')}
            </ChoiceChip>
            <ChoiceChip selected={!form.enabled} onClick={() => setForm(f => ({ ...f, enabled: false }))}>
              {t('AiUnitWeights.dialog.turnOff')}
            </ChoiceChip>
          </div>
        </div>

        {form.enabled ? (
          <AiWeightFields value={form.weights}
                          onChange={weights => setForm(f => ({ ...f, weights }))} />
        ) : (
          <p className="rounded-control bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
            {t('AiUnitWeights.dialog.turnOffExplain')}
          </p>
        )}
      </div>
    </Dialog>
  )
}
