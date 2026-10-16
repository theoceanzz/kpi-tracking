import { LocaleNumberInput } from '@/components/ui/number-input'
import { Checkbox } from '@/components/ui/checkbox'
import { useTranslation } from 'react-i18next'
import type { UnitBellTarget, UnitClassBscBands } from '../api/organizationApi'
import { effectiveBscBands } from '../utils/bellCurve'
import { cn } from '@/lib/utils'

/**
 * Khung bell curve đổi theo kết quả BSC của đơn vị trong kỳ (sau trần): Vượt ≥ ngưỡng trên dùng khung
 * "Vượt", Chưa đạt < ngưỡng dưới dùng khung "Chưa đạt", ở giữa dùng khung chính phía trên. Chỉ số BSC đã
 * chốt mới đổi khung kiểm tra (backend `UnitClassificationService.activeCurve`).
 */
export default function BscBandsEditor({ value, levels, mainTargets, onChange }: {
  value: UnitClassBscBands | undefined
  /** Mức thành viên, CAO → THẤP. */
  levels: { name: string; color: string }[]
  mainTargets: UnitBellTarget[]
  onChange: (next: UnitClassBscBands) => void
}) {
  const { t } = useTranslation('orgunits')
  const bands = effectiveBscBands(value, levels.length, mainTargets)
  const patch = (p: Partial<UnitClassBscBands>) => onChange({ ...bands, ...p })
  const setAt = (key: 'exceed' | 'below', i: number, v: number) =>
    patch({ [key]: bands[key].map((x, j) => (j === i ? Math.max(0, Math.min(100, v)) : x)) })
  const sum = (arr: number[]) => Math.round(arr.reduce((s, x) => s + x, 0) * 10) / 10
  const mainOf = (level: string) => mainTargets.find(m => m.level === level)?.percent ?? 0
  const numCls = 'no-edit-hint w-16 h-8 px-2 rounded-control bg-[var(--color-muted)] text-sm font-medium text-right border-none outline-none focus:ring-2 focus:ring-[var(--color-ring)]'

  return (
    <div className="space-y-2 rounded-card border border-[var(--color-border)] p-3">
      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox checked={bands.enabled} onCheckedChange={v => patch({ enabled: v })} className="mt-0.5" />
        <span>
          <span className="text-label block">{t('BscBandsEditor.title')}</span>
          <span className="text-caption">{t('BscBandsEditor.hint')}</span>
        </span>
      </label>

      {bands.enabled && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              {t('BscBandsEditor.exceedAt')}
              <LocaleNumberInput type="number" min={0} max={200} value={bands.exceedAt} className={numCls}
                aria-label={t('BscBandsEditor.exceedAt')}
                onChange={e => patch({ exceedAt: Number(e.target.value) || 0 })} />%
            </span>
            <span className="inline-flex items-center gap-1.5">
              {t('BscBandsEditor.meetAt')}
              <LocaleNumberInput type="number" min={0} max={200} value={bands.meetAt} className={numCls}
                aria-label={t('BscBandsEditor.meetAt')}
                onChange={e => patch({ meetAt: Number(e.target.value) || 0 })} />%
            </span>
          </div>
          {bands.meetAt >= bands.exceedAt && (
            <p className="text-caption text-[var(--color-warning)]">{t('BscBandsEditor.thresholdOrder')}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-eyebrow text-left">
                  <th className="py-1 pr-2">{t('BscBandsEditor.level')}</th>
                  <th className="py-1 px-2 text-right">{t('BscBandsEditor.exceedFrame', { value: bands.exceedAt })}</th>
                  <th className="py-1 px-2 text-right">{t('BscBandsEditor.meetFrame')}</th>
                  <th className="py-1 pl-2 text-right">{t('BscBandsEditor.belowFrame', { value: bands.meetAt })}</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l, i) => (
                  <tr key={l.name} className="border-t border-[var(--color-border)]">
                    <td className="py-1 pr-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />{l.name}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right">
                      <LocaleNumberInput type="number" min={0} max={100} value={bands.exceed[i] ?? 0} className={numCls}
                        aria-label={`${l.name} — ${t('BscBandsEditor.exceedFrame', { value: bands.exceedAt })}`}
                        onChange={e => setAt('exceed', i, Number(e.target.value) || 0)} />
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums text-[var(--color-muted-foreground)]">{mainOf(l.name)}</td>
                    <td className="py-1 pl-2 text-right">
                      <LocaleNumberInput type="number" min={0} max={100} value={bands.below[i] ?? 0} className={numCls}
                        aria-label={`${l.name} — ${t('BscBandsEditor.belowFrame', { value: bands.meetAt })}`}
                        onChange={e => setAt('below', i, Number(e.target.value) || 0)} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--color-border)] text-caption">
                  <td className="py-1 pr-2">{t('BscBandsEditor.total')}</td>
                  {[sum(bands.exceed), sum(mainTargets.map(m => m.percent)), sum(bands.below)].map((s, i) => (
                    <td key={i} className={cn('py-1 px-2 text-right tabular-nums', Math.abs(s - 100) > 0.05 && 'text-[var(--color-warning)] font-semibold')}>{s}%</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-caption">{t('BscBandsEditor.finalizedOnly')}</p>
        </>
      )}
    </div>
  )
}
