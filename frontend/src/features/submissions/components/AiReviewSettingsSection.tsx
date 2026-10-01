import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { InfoHint } from '@/components/common/InfoHint'
import AiWeightFields from './AiWeightFields'
import { weightTotal, type AiWeights } from './aiWeights'
import { useFormat } from '@/i18n/useFormat'
import AiReviewUnitSettingsSection from './AiReviewUnitSettingsSection'
import { useAiReviewSettings, useUpdateAiReviewSettings } from '../hooks/useAiReview'
import type { AiReviewSettings } from '../api/aiReviewApi'

/**
 * Một thẻ duy nhất cho "AI gợi ý điểm khi chấm": bật/tắt cho công ty, trọng số mặc định (kèm ví dụ tính), rồi trọng
 * số riêng theo đơn vị ngay bên dưới. Trước đây đơn vị là thẻ thứ hai cùng ba ô % — người dùng (30/09) thấy như hai
 * cấu hình, không biết cái nào thắng. Chỉ người có quyền `AI_REVIEW:CONFIG` sửa được; điểm AI luôn chỉ để tham khảo.
 */
/** Ví dụ cố định (chỉ trọng số thay đổi) — đúng công thức `ReviewScoreCalculator.points`. */
const EXAMPLE = { max: 40, achievement: 80, quality: 75, onTime: 100 }

function example(w: AiWeights, t: TFunction, num: (v: number, o?: Intl.NumberFormatOptions) => string) {
  const one = { maximumFractionDigits: 1 }
  const tMax = EXAMPLE.max * w.weightTarget / 100
  const qMax = EXAMPLE.max * w.weightQuality / 100
  const oMax = EXAMPLE.max * w.weightOnTime / 100
  const total = tMax * EXAMPLE.achievement / 100 + qMax * EXAMPLE.quality / 100 + oMax * EXAMPLE.onTime / 100
  return t('AiReviewSettings.example', {
    max: EXAMPLE.max, achievement: EXAMPLE.achievement, quality: EXAMPLE.quality,
    tMax: num(tMax, one), qMax: num(qMax, one), oMax: num(oMax, one), total: num(total, one),
  })
}

export default function AiReviewSettingsSection() {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const { hasPermission } = useHasPermission()
  const canConfig = hasPermission('AI_REVIEW:CONFIG')
  const { data, isLoading } = useAiReviewSettings(canConfig)
  const save = useUpdateAiReviewSettings()
  // Bản nháp chỉ tồn tại khi người dùng đã sửa; chưa sửa thì hiện đúng dữ liệu máy chủ.
  const [edited, setDraft] = useState<AiReviewSettings | null>(null)
  const draft = edited ?? data

  if (!canConfig) return null
  if (isLoading || !draft || !data) {
    return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--color-muted-foreground)]" /></div>
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data)
  const valid = weightTotal(draft) === 100

  return (
    <div className="space-y-5 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Bot size={20} className="mt-0.5 text-[var(--color-ai)]" aria-hidden="true" />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-foreground)]">
              {t('AiReviewSettings.title')}
              <InfoHint>{t('AiReviewSettings.titleHint')}</InfoHint>
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">{t('AiReviewSettings.subtitle')}</p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          {draft.enabled ? t('AiReviewSettings.on') : t('AiReviewSettings.off')}
          <Switch checked={draft.enabled} onCheckedChange={enabled => setDraft({ ...draft, enabled })}
                  aria-label={t('AiReviewSettings.toggleAria')} />
        </label>
      </div>

      <section className="space-y-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-foreground)]">
            {t('AiReviewSettings.weightsTitle')}
            <InfoHint label={t('AiReviewSettings.exampleLabel')}>{example(draft, t, fmt.number)}</InfoHint>
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('AiReviewSettings.weightsDescription')}</p>
        </div>
        <AiWeightFields value={draft} onChange={w => setDraft({ ...draft, ...w })} />
        <div className="flex justify-end gap-2">
          {dirty && (
            <Button variant="ghost" disabled={save.isPending} onClick={() => setDraft(null)}>
              {t('AiReviewSettings.discard')}
            </Button>
          )}
          <Button disabled={!dirty || !valid || save.isPending}
                  onClick={() => save.mutate(draft, { onSuccess: () => setDraft(null) })}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} {t('AiReviewSettings.save')}
          </Button>
        </div>
      </section>

      <div className="border-t border-[var(--color-border)] pt-5">
        {/* Điền sẵn cho đơn vị mới là trọng số ĐÃ LƯU của công ty, không phải bản đang sửa dở. */}
        <AiReviewUnitSettingsSection companyEnabled={data.enabled} companyWeights={{
          weightTarget: data.weightTarget, weightQuality: data.weightQuality, weightOnTime: data.weightOnTime,
        }} />
      </div>
    </div>
  )
}
