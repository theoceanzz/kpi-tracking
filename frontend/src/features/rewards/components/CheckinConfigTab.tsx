import { LocaleNumberInput } from '@/components/ui/number-input'
import { intlLocale } from '@/i18n/format'
import { useState } from 'react'
import { AlertTriangle, CalendarCheck, Gift, Info, Loader2, Plus, Trash2, Users } from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useCheckinConfig } from '../hooks/useCheckin'
import type { CheckinConfigRequest, StreakBonus } from '../types'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { tourAnchor } from '@/components/common/tours/anchors'

const numCls =
  'rounded-control border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--color-primary)]'

/**
 * Kiểm cấu hình ở phía giao diện. Backend kiểm lại y hệt — đây chỉ để sếp thấy lỗi ngay
 * khi gõ thay vì sau khi bấm lưu.
 */
function configError(form: CheckinConfigRequest): string | null {
  if (!form.pointsPerDay || form.pointsPerDay < 1) return i18n.t('rewards:CheckinConfigTab.pointsPerCheckInMustBe')
  if (form.streakCycleDays != null && form.streakCycleDays < 2) {
    return i18n.t('rewards:CheckinConfigTab.theStreakCycleMustBe2')
  }

  const seen = new Set<number>()
  for (const b of form.streakBonuses) {
    if (!b.day || b.day < 1) return i18n.t('rewards:CheckinConfigTab.theMilestoneDayMustBe1')
    if (!b.points || b.points < 1) return i18n.t('rewards:CheckinConfigTab.milestoneBonusPointsMustBeGreater')
    if (seen.has(b.day)) return i18n.t('rewards:CheckinConfigTab.twoMilestonesAreSetOnDay', { day: b.day })
    seen.add(b.day)
    if (form.streakCycleDays != null && b.day > form.streakCycleDays) {
      return i18n.t('rewards:CheckinConfigTab.theDayMilestoneIsOutsideThe', { day: b.day, streakCycleDays: form.streakCycleDays })
    }
  }
  return null
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-primary)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-[var(--color-muted-foreground)]">{hint}</span>
      </span>
    </label>
  )
}

/** Ô chỉ số vận hành. Chỉ đọc — cho sếp biết cấu hình đang thực sự tiêu bao nhiêu điểm. */
function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-[var(--color-border)] px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-eyebrow">
          {label}
        </div>
        <div className="mt-0.5 truncate text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  )
}

export default function CheckinConfigTab() {
  const { t } = useTranslation('rewards')
  const { data, isLoading, saveConfig, isSaving } = useCheckinConfig()

  // Bản nháp CHỈ tồn tại sau khi sếp sửa gì đó; trước đó form dẫn xuất thẳng từ dữ liệu
  // server. Nhờ vậy không cần useEffect đồng bộ state, và cũng không có cửa nào để một
  // lần refetch (sau khi lưu, hoặc khi quay lại tab) xoá mất thứ đang gõ dở.
  const [draft, setDraft] = useState<CheckinConfigRequest | null>(null)
  const form: CheckinConfigRequest | null =
    draft ??
    (data
      ? {
          enabled: data.enabled,
          pointsPerDay: data.pointsPerDay,
          streakCycleDays: data.streakCycleDays ?? null,
          skipWeekends: data.skipWeekends,
          streakBonuses: data.streakBonuses ?? [],
        }
      : null)

  if (isLoading || !form) return <LoadingSkeleton type="table" rows={4} />

  const set = (patch: Partial<CheckinConfigRequest>) => setDraft({ ...form, ...patch })
  const setBonus = (idx: number, patch: Partial<StreakBonus>) =>
    set({ streakBonuses: form.streakBonuses.map((b, i) => (i === idx ? { ...b, ...patch } : b)) })

  const error = configError(form)
  const bonusTotal = form.streakBonuses.reduce((s, b) => s + (b.points || 0), 0)
  const cycleTotal =
    form.streakCycleDays != null ? form.streakCycleDays * form.pointsPerDay + bonusTotal : null

  const bonusByDay = new Map(form.streakBonuses.map((b) => [b.day, b.points]))

  /**
   * Các ngày vẽ trên dải. Có chu kỳ thì vẽ trọn chu kỳ; không có chu kỳ thì chuỗi chạy
   * vô hạn nên chỉ vẽ tới mốc xa nhất (tối thiểu 7 ngày) rồi để dấu "…" nói phần còn lại.
   * Chu kỳ quá dài thì bỏ hẳn dải — 200 ô vuông không giúp ai hiểu nhanh hơn.
   */
  const TRACK_MAX = 31
  const trackDays: number[] | null = (() => {
    const last =
      form.streakCycleDays ?? Math.max(7, ...form.streakBonuses.map((b) => b.day || 0))
    if (last > TRACK_MAX) return null
    return Array.from({ length: last }, (_, i) => i + 1)
  })()

  /**
   * Ngày trống đầu tiên trong chu kỳ — chỗ nút "Thêm mốc" đặt mốc mới vào. Null khi mọi
   * ngày đã có mốc; lúc đó nút phải bị khoá, vì {@link toggleBonusDay} lên một ngày đã
   * có mốc sẽ XOÁ nó — nút tên "Thêm mốc" mà lại xoá là chuyện không ai lường được.
   */
  const firstFreeDay = (() => {
    const limit = form.streakCycleDays ?? 366
    for (let d = 1; d <= limit; d++) if (!bonusByDay.has(d)) return d
    return null
  })()

  /** Bấm một ngày: đang có mốc thì bỏ, chưa có thì thêm với mức mặc định. */
  const toggleBonusDay = (day: number) => {
    if (bonusByDay.has(day)) {
      set({ streakBonuses: form.streakBonuses.filter((b) => b.day !== day) })
    } else {
      set({ streakBonuses: [...form.streakBonuses, { day, points: 50 }] })
    }
  }

  /**
   * Thứ tự HIỂN THỊ theo ngày, nhưng vẫn thao tác qua chỉ số gốc của mảng. Sắp xếp
   * thẳng mảng state sẽ làm ô đang gõ nhảy chỗ ngay giữa lúc sếp sửa số ngày.
   */
  const sortedBonusIdx = form.streakBonuses
    .map((b, idx) => ({ b, idx }))
    .sort((x, y) => (x.b.day || 0) - (y.b.day || 0))
    .map((x) => x.idx)

  return (
    <div id="tour-checkin-root" className="space-y-6">
      <div {...tourAnchor('checkin.note')} id="tour-checkin-note" className="flex items-start gap-2.5 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-sm">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
        <p className="text-[var(--color-muted-foreground)]">
          {t('CheckinConfigTab.employeesCheckInThemselvesEveryDay')}
        </p>
      </div>

      <div {...tourAnchor('checkin.stats')} id="tour-checkin-stats" className="grid gap-4 sm:grid-cols-2">
        <StatTile
          icon={<Users size={17} />}
          label={t('CheckinConfigTab.checkedInToday')}
          value={`${data?.checkedInToday ?? 0} người`}
        />
        <StatTile
          icon={<CalendarCheck size={17} />}
          label={t('CheckinConfigTab.pointsGivenThisMonth')}
          value={`${(data?.pointsThisMonth ?? 0).toLocaleString(intlLocale())} điểm`}
        />
      </div>

      <div {...tourAnchor('checkin.form')} id="tour-checkin-form" className="space-y-5 rounded-card border border-[var(--color-border)] p-5">
        <Toggle
          checked={form.enabled}
          onChange={(v) => set({ enabled: v })}
          label={t('CheckinConfigTab.turnOnDailyCheckIn')}
          hint={t('CheckinConfigTab.whenOffTheCheckInCard')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-label mb-1.5 block font-medium">{t('CheckinConfigTab.pointsPerCheckIn')}</label>
            <LocaleNumberInput
              type="number"
              min={1}
              value={form.pointsPerDay}
              onChange={(e) => set({ pointsPerDay: Number(e.target.value) })}
              className={`w-full ${numCls}`}
            />
          </div>

          <div>
            <label className="text-label mb-1.5 block font-medium">{t('CheckinConfigTab.streakCycleDays')}</label>
            <LocaleNumberInput
              type="number"
              min={2}
              max={366}
              placeholder={t('CheckinConfigTab.emptyNoRepeat')}
              value={form.streakCycleDays ?? ''}
              onChange={(e) =>
                set({ streakCycleDays: e.target.value === '' ? null : Number(e.target.value) })
              }
              className={`w-full ${numCls}`}
            />
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {t('CheckinConfigTab.theStreakCountsUpToHere')}
            </p>
          </div>
        </div>

        <Toggle
          checked={form.skipWeekends}
          onChange={(v) => set({ skipWeekends: v })}
          label={t('CheckinConfigTab.excludeSaturdaysAndSundays')}
          hint={t('CheckinConfigTab.weekendsCannotBeCheckedInAnd')}
        />
      </div>

      <div className="space-y-4 rounded-card border border-[var(--color-border)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 {...tourAnchor('checkin.milestones')} className="text-section-title">{t('CheckinConfigTab.streakMilestones')}</h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {trackDays
                ? t('CheckinConfigTab.clickADayInTheStrip')
                : t('CheckinConfigTab.bonusWhenTheStreakHitsExactly')}
            </p>
          </div>
          <Button variant="outline" size="sm" type="button" disabled={firstFreeDay == null} onClick={() => firstFreeDay != null && toggleBonusDay(firstFreeDay)} title={firstFreeDay == null ? t('CheckinConfigTab.everyDayInTheCycleAlready') : undefined}>
            <Plus aria-hidden="true" />
            {t('CheckinConfigTab.addMilestone')}
          </Button>
        </div>

        {/* Dải chu kỳ: thứ sếp thật sự cần thấy là "mỗi ngày nhân viên nhận bao nhiêu",
            chứ không phải danh sách mốc rời rạc. Vẽ nguyên chu kỳ ra thì mốc nằm ở đâu,
            ngày nào trống, ngày nào nhảy vọt đều thấy ngay mà không phải nhẩm. */}
        {trackDays ? (
          <div className="flex flex-wrap gap-1.5">
            {trackDays.map((n) => {
              const bonus = bonusByDay.get(n) ?? 0
              const isBonus = bonus > 0
              return (
                <ChoiceChip selected={!(isBonus)} key={n} onClick={() => toggleBonusDay(n)} title={
                    isBonus
                      ? t('CheckinConfigTab.dayBasePointsMilestoneBonusClick', { n, pointsPerDay: form.pointsPerDay, bonus })
                      : t('CheckinConfigTab.dayPointsClickToAddA', { n, pointsPerDay: form.pointsPerDay })
                  }>
                  <span className="text-eyebrow">{t('CheckinConfigTab.date')} {n}</span>
                  <span
                    className={`text-base font-semibold tabular-nums ${isBonus ? '' : 'text-[var(--color-foreground)]'}`}
                  >
                    {form.pointsPerDay + bonus}
                  </span>
                  {isBonus ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold">
                      <Gift />+{bonus}
                    </span>
                  ) : (
                    <span className="text-xs opacity-0">—</span>
                  )}
                </ChoiceChip>
              )
            })}
            {/* Không đặt chu kỳ thì chuỗi chạy vô hạn — nói thẳng bằng dấu "…" thay vì
                cắt ở một con số tuỳ tiện làm sếp tưởng chuỗi dừng ở đó. */}
            {form.streakCycleDays == null && (
              <span className="flex h-[62px] items-center px-2 text-sm text-[var(--color-muted-foreground)]">
                {t('CheckinConfigTab.noRepeat')}
              </span>
            )}
          </div>
        ) : (
          <p className="rounded-control border border-dashed border-[var(--color-border)] px-4 py-3 text-center text-xs text-[var(--color-muted-foreground)]">
            {t('CheckinConfigTab.cycle')} {form.streakCycleDays} {t('CheckinConfigTab.daysIsTooLongToDraw')}
          </p>
        )}

        {form.streakBonuses.length === 0 ? (
          <p className="rounded-control border border-dashed border-[var(--color-border)] px-4 py-5 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('CheckinConfigTab.noMilestonesYetEmployeesGetA')} {form.pointsPerDay} {t('CheckinConfigTab.pointsPerDay')}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedBonusIdx.map((idx) => {
              const b = form.streakBonuses[idx]!
              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-2.5 text-sm"
                >
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-control bg-[var(--color-warning-bg)] px-2.5 text-xs font-medium text-[var(--color-warning)]">
                    <Gift size={12} />
                    {t('CheckinConfigTab.date')}
                  </span>
                  <LocaleNumberInput
                    type="number"
                    min={1}
                    value={b.day}
                    onChange={(e) => setBonus(idx, { day: Number(e.target.value) })}
                    className={`w-16 text-center ${numCls}`}
                  />
                  <span className="text-[var(--color-muted-foreground)]">{t('CheckinConfigTab.bonus')}</span>
                  <LocaleNumberInput
                    type="number"
                    min={1}
                    value={b.points}
                    onChange={(e) => setBonus(idx, { points: Number(e.target.value) })}
                    className={`w-24 text-center ${numCls}`}
                  />
                  <span className="text-[var(--color-muted-foreground)]">{t('CheckinConfigTab.points')}</span>

                  {/* Số thực nhận của ngày đó. Sếp nhập "thưởng thêm" nhưng cái nhân viên
                      thấy là tổng — không hiện ra thì lần nào cũng phải tự cộng. */}
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {t('CheckinConfigTab.thatDayGets')}{' '}
                    <strong className="text-[var(--color-foreground)] tabular-nums">
                      {(form.pointsPerDay + (b.points || 0)).toLocaleString(intlLocale())} {t('CheckinConfigTab.points')}
                    </strong>
                  </span>

                  <Button variant="ghost" size="icon-sm" className="ml-auto text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={t('CheckinConfigTab.deleteThisMilestone')} type="button" onClick={() => set({ streakBonuses: form.streakBonuses.filter((_, i) => i !== idx) })} title={t('CheckinConfigTab.deleteThisMilestone')}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Con số tệ nhất một người có thể nhận. Tách rõ phần cơ bản và phần mốc: gộp
            thành một số thì sếp không biết nên hạ mức ngày hay hạ mốc khi thấy nó quá cao. */}
        {cycleTotal != null && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card bg-[var(--color-muted)]/60 px-4 py-3 text-sm">
            <CalendarCheck size={15} className="text-[var(--color-muted-foreground)]" />
            <span className="text-[var(--color-muted-foreground)]">
              {t('CheckinConfigTab.overAFullCycleOf')} {form.streakCycleDays} {t('CheckinConfigTab.daysOnePersonGets')}
            </span>
            <strong className="text-base tabular-nums">
              {cycleTotal.toLocaleString(intlLocale())} {t('CheckinConfigTab.points')}
            </strong>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              ({form.streakCycleDays} × {form.pointsPerDay.toLocaleString(intlLocale())} {t('CheckinConfigTab.base')}
              {bonusTotal > 0 && <> + {bonusTotal.toLocaleString(intlLocale())} {t('CheckinConfigTab.milestoneBonus')}</>})
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-card border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button {...tourAnchor('checkin.save')} onClick={() => saveConfig(form)} disabled={!!error || isSaving}>
          {isSaving && <Loader2 aria-hidden="true" className="animate-spin" />}
          {t('CheckinConfigTab.saveSettings')}
        </Button>
      </div>
    </div>
  )
}
