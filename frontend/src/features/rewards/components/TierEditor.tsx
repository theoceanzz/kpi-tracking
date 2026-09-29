import { LocaleNumberInput } from '@/components/ui/number-input'
import { Plus, Trash2 } from 'lucide-react'
import type { RewardTier } from '../types'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'

interface TierEditorProps {
  tiers: RewardTier[]
  onChange: (tiers: RewardTier[]) => void
}

/**
 * Kiểm bậc thưởng ở phía giao diện. Backend cũng kiểm lại — đây chỉ để người dùng thấy
 * lỗi ngay khi gõ thay vì sau khi bấm lưu.
 */
export function tierError(tiers: RewardTier[]): string | null {
  if (tiers.length === 0) return i18n.t('rewards:TierEditor.atLeastOneRewardTierIs')
  const sorted = [...tiers].sort((a, b) => a.fromRank - b.fromRank)
  for (const t of sorted) {
    if (t.toRank < t.fromRank) {
      return i18n.t('rewards:TierEditor.theTierFromRankEndsAt', { fromRank: t.fromRank })
    }
    if (t.points <= 0) return i18n.t('rewards:TierEditor.pointsForEachTierMustBe')
  }
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const prev = sorted[i - 1]
    // Chồng nhau thì một người rơi vào hai bậc và không rõ nhận mức nào.
    if (cur && prev && cur.fromRank <= prev.toRank) {
      return i18n.t('rewards:TierEditor.twoTiersOverlapAtRankEach', { fromRank: cur.fromRank })
    }
  }
  return null
}

/** Tổng điểm nếu mọi hạng đều có người — con số tệ nhất có thể phát ra. */
export function maxTierCost(tiers: RewardTier[]): number {
  return tiers.reduce((sum, t) => sum + t.points * Math.max(0, t.toRank - t.fromRank + 1), 0)
}

/** Soạn bậc thưởng. Dùng chung cho cấu hình chương trình và cho từng lần chạy. */
export default function TierEditor({ tiers, onChange }: TierEditorProps) {
  const { t: tr } = useTranslation('rewards')
  const set = (idx: number, patch: Partial<RewardTier>) =>
    onChange(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)))

  const numCls =
    'rounded-control border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-center'

  return (
    <div className="space-y-2">
      {tiers.map((t, idx) => (
        <div key={idx} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--color-muted-foreground)]">{tr('TierEditor.rank')}</span>
          <LocaleNumberInput
            type="number"
            min={1}
            value={t.fromRank}
            onChange={(e) => set(idx, { fromRank: Number(e.target.value) })}
            className={`w-16 ${numCls}`}
          />
          <span className="text-[var(--color-muted-foreground)]">–</span>
          <LocaleNumberInput
            type="number"
            min={1}
            value={t.toRank}
            onChange={(e) => set(idx, { toRank: Number(e.target.value) })}
            className={`w-16 ${numCls}`}
          />
          <span className="text-[var(--color-muted-foreground)]">{tr('TierEditor.gets')}</span>
          <LocaleNumberInput
            type="number"
            min={1}
            value={t.points}
            onChange={(e) => set(idx, { points: Number(e.target.value) })}
            className={`w-24 ${numCls}`}
          />
          <span className="text-[var(--color-muted-foreground)]">{tr('TierEditor.points')}</span>
          <button
            type="button"
            onClick={() => onChange(tiers.filter((_, i) => i !== idx))}
            disabled={tiers.length === 1}
            className="ml-auto rounded-control p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] disabled:opacity-30"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <Button variant="outline" size="sm" type="button" onClick={() => {
          const maxTo = Math.max(0, ...tiers.map((t) => t.toRank))
          onChange([...tiers, { fromRank: maxTo + 1, toRank: maxTo + 1, points: 100 }])
        }}>
        <Plus aria-hidden="true" />
        {tr('TierEditor.addTier')}
      </Button>
    </div>
  )
}
