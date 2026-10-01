import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { InfoHint } from '@/components/common/InfoHint'
import { seriesColor } from '@/components/charts/chartPalette'
import { weightTotal, type AiWeights } from './aiWeights'

const PARTS = [
  { key: 'weightTarget', label: 'target' },
  { key: 'weightQuality', label: 'quality' },
  { key: 'weightOnTime', label: 'onTime' },
] as const

/**
 * Ba trọng số chia điểm tối đa của mỗi chỉ tiêu (thang điểm đánh giá) — dùng chung cho mặc định của công ty và
 * trọng số riêng của đơn vị. Gọn theo phản hồi 30/09: thanh chia tỉ lệ + ba ô; giải thích nằm trong ⓘ, tổng chỉ hiện
 * khi sai.
 */
export default function AiWeightFields({ value, onChange, disabled }: {
  value: AiWeights
  onChange: (next: AiWeights) => void
  disabled?: boolean
}) {
  const { t } = useTranslation('submissions')
  const total = weightTotal(value)
  const ok = total === 100

  const set = (key: keyof AiWeights, raw: string) =>
    onChange({ ...value, [key]: Math.max(0, Math.min(100, Math.round(Number(raw) || 0))) })

  return (
    <div className="space-y-2.5">
      {/* Thanh chia tỉ lệ; màu khớp chấm màu cạnh nhãn từng ô. */}
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-muted)]" aria-hidden="true">
        {PARTS.map((p, i) => value[p.key] > 0 && (
          <div key={p.key} style={{ width: `${Math.min(100, value[p.key])}%`, background: seriesColor(i) }} />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PARTS.map((p, i) => (
          <div key={p.key} className="space-y-1">
            <span className="text-label flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(i) }} aria-hidden="true" />
              {t(`AiWeights.label.${p.label}`)}
              <InfoHint label={t(`AiWeights.label.${p.label}`)}>{t(`AiWeights.hint.${p.label}`)}</InfoHint>
            </span>
            <Input type="number" min={0} max={100} value={value[p.key]} disabled={disabled} invalid={!ok}
                   aria-label={t(`AiWeights.label.${p.label}`)}
                   onChange={e => set(p.key, e.target.value)}
                   suffix={<span className="text-xs text-[var(--color-muted-foreground)]">%</span>} />
          </div>
        ))}
      </div>

      {!ok && (
        <p className="text-xs font-medium text-[var(--color-error)]">
          {t('AiWeights.total', { total })} — {total < 100
            ? t('AiWeights.missing', { n: 100 - total })
            : t('AiWeights.over', { n: total - 100 })}
        </p>
      )}
    </div>
  )
}
