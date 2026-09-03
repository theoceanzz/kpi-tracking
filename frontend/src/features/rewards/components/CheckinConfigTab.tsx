import { useState } from 'react'
import { AlertTriangle, CalendarCheck, Gift, Info, Loader2, Plus, Trash2, Users } from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useCheckinConfig } from '../hooks/useCheckin'
import type { CheckinConfigRequest, StreakBonus } from '../types'

const numCls =
  'rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--color-primary)]'

/**
 * Kiểm cấu hình ở phía giao diện. Backend kiểm lại y hệt — đây chỉ để sếp thấy lỗi ngay
 * khi gõ thay vì sau khi bấm lưu.
 */
function configError(form: CheckinConfigRequest): string | null {
  if (!form.pointsPerDay || form.pointsPerDay < 1) return 'Số điểm mỗi lần điểm danh phải lớn hơn 0.'
  if (form.streakCycleDays != null && form.streakCycleDays < 2) {
    return 'Chu kỳ chuỗi phải từ 2 ngày trở lên — chu kỳ 1 ngày khiến mọi mốc trúng lại mỗi ngày.'
  }

  const seen = new Set<number>()
  for (const b of form.streakBonuses) {
    if (!b.day || b.day < 1) return 'Ngày của mốc thưởng phải từ 1 trở lên.'
    if (!b.points || b.points < 1) return 'Điểm thưởng của mốc phải lớn hơn 0.'
    if (seen.has(b.day)) return `Có hai mốc thưởng cùng đặt ở ngày ${b.day}. Mỗi ngày chỉ một mốc.`
    seen.add(b.day)
    if (form.streakCycleDays != null && b.day > form.streakCycleDays) {
      return `Mốc ngày ${b.day} nằm ngoài chu kỳ ${form.streakCycleDays} ngày nên sẽ không bao giờ được trao.`
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
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-muted-foreground)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-lg font-bold tabular-nums">{value}</div>
      </div>
    </div>
  )
}

export default function CheckinConfigTab() {
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
      <div id="tour-checkin-note" className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-sm">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
        <p className="text-[var(--color-muted-foreground)]">
          Nhân viên tự bấm điểm danh mỗi ngày ở trang “Điểm thưởng của tôi” để nhận điểm. Điểm
          vào thẳng ví của họ và không trừ vào hạn mức của quản lý nào — hãy cân nhắc mức điểm
          theo số nhân sự.
        </p>
      </div>

      <div id="tour-checkin-stats" className="grid gap-4 sm:grid-cols-2">
        <StatTile
          icon={<Users size={17} />}
          label="Đã điểm danh hôm nay"
          value={`${data?.checkedInToday ?? 0} người`}
        />
        <StatTile
          icon={<CalendarCheck size={17} />}
          label="Điểm đã phát tháng này"
          value={`${(data?.pointsThisMonth ?? 0).toLocaleString('vi-VN')} điểm`}
        />
      </div>

      <div id="tour-checkin-form" className="space-y-5 rounded-2xl border border-[var(--color-border)] p-5">
        <Toggle
          checked={form.enabled}
          onChange={(v) => set({ enabled: v })}
          label="Bật điểm danh hàng ngày"
          hint="Tắt thì thẻ điểm danh biến mất khỏi màn hình nhân viên; lịch sử điểm đã phát vẫn giữ nguyên."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Điểm mỗi lần điểm danh</label>
            <input
              type="number"
              min={1}
              value={form.pointsPerDay}
              onChange={(e) => set({ pointsPerDay: Number(e.target.value) })}
              className={`w-full ${numCls}`}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Chu kỳ chuỗi (ngày)</label>
            <input
              type="number"
              min={2}
              max={366}
              placeholder="Để trống = không lặp"
              value={form.streakCycleDays ?? ''}
              onChange={(e) =>
                set({ streakCycleDays: e.target.value === '' ? null : Number(e.target.value) })
              }
              className={`w-full ${numCls}`}
            />
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Chuỗi đếm tới đây rồi quay về ngày 1, nhờ vậy các mốc thưởng lặp lại đều đặn. Để
              trống thì mỗi mốc chỉ trúng đúng một lần.
            </p>
          </div>
        </div>

        <Toggle
          checked={form.skipWeekends}
          onChange={(v) => set({ skipWeekends: v })}
          label="Không tính thứ 7 và chủ nhật"
          hint="Cuối tuần không điểm danh được và cũng không làm đứt chuỗi — thứ hai nối tiếp thứ sáu."
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Mốc thưởng chuỗi</h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {trackDays
                ? 'Bấm vào ngày trong dải bên dưới để thêm hoặc bỏ mốc thưởng.'
                : 'Thưởng thêm khi chuỗi chạm đúng ngày đó. Bỏ trống nếu chỉ muốn điểm cơ bản.'}
            </p>
          </div>
          <button
            type="button"
            disabled={firstFreeDay == null}
            onClick={() => firstFreeDay != null && toggleBonusDay(firstFreeDay)}
            title={firstFreeDay == null ? 'Mọi ngày trong chu kỳ đều đã có mốc' : undefined}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} />
            Thêm mốc
          </button>
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
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleBonusDay(n)}
                  title={
                    isBonus
                      ? `Ngày ${n}: ${form.pointsPerDay} điểm cơ bản + ${bonus} thưởng mốc. Bấm để bỏ mốc.`
                      : `Ngày ${n}: ${form.pointsPerDay} điểm. Bấm để thêm mốc thưởng.`
                  }
                  className={`flex h-[62px] w-[62px] flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
                    isBonus
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400'
                      : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-muted)]'
                  }`}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide">Ngày {n}</span>
                  <span
                    className={`text-base font-bold tabular-nums ${isBonus ? '' : 'text-[var(--color-foreground)]'}`}
                  >
                    {form.pointsPerDay + bonus}
                  </span>
                  {isBonus ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold">
                      <Gift size={9} />+{bonus}
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-0">—</span>
                  )}
                </button>
              )
            })}
            {/* Không đặt chu kỳ thì chuỗi chạy vô hạn — nói thẳng bằng dấu "…" thay vì
                cắt ở một con số tuỳ tiện làm sếp tưởng chuỗi dừng ở đó. */}
            {form.streakCycleDays == null && (
              <span className="flex h-[62px] items-center px-2 text-sm text-[var(--color-muted-foreground)]">
                … không lặp lại
              </span>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-3 text-center text-xs text-[var(--color-muted-foreground)]">
            Chu kỳ {form.streakCycleDays} ngày quá dài để vẽ thành dải — chỉnh trực tiếp ở danh
            sách bên dưới.
          </p>
        )}

        {form.streakBonuses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-5 text-center text-sm text-[var(--color-muted-foreground)]">
            Chưa có mốc nào — nhân viên nhận đều {form.pointsPerDay} điểm mỗi ngày.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedBonusIdx.map((idx) => {
              const b = form.streakBonuses[idx]!
              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-2.5 text-sm"
                >
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <Gift size={12} />
                    Ngày
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={b.day}
                    onChange={(e) => setBonus(idx, { day: Number(e.target.value) })}
                    className={`w-16 text-center ${numCls}`}
                  />
                  <span className="text-[var(--color-muted-foreground)]">thưởng thêm</span>
                  <input
                    type="number"
                    min={1}
                    value={b.points}
                    onChange={(e) => setBonus(idx, { points: Number(e.target.value) })}
                    className={`w-24 text-center ${numCls}`}
                  />
                  <span className="text-[var(--color-muted-foreground)]">điểm</span>

                  {/* Số thực nhận của ngày đó. Sếp nhập "thưởng thêm" nhưng cái nhân viên
                      thấy là tổng — không hiện ra thì lần nào cũng phải tự cộng. */}
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    → hôm đó nhận{' '}
                    <strong className="text-[var(--color-foreground)] tabular-nums">
                      {(form.pointsPerDay + (b.points || 0)).toLocaleString('vi-VN')} điểm
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => set({ streakBonuses: form.streakBonuses.filter((_, i) => i !== idx) })}
                    className="ml-auto rounded-lg p-1.5 text-rose-600 transition-colors hover:bg-rose-500/10"
                    title="Xoá mốc này"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Con số tệ nhất một người có thể nhận. Tách rõ phần cơ bản và phần mốc: gộp
            thành một số thì sếp không biết nên hạ mức ngày hay hạ mốc khi thấy nó quá cao. */}
        {cycleTotal != null && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[var(--color-muted)]/60 px-4 py-3 text-sm">
            <CalendarCheck size={15} className="text-[var(--color-muted-foreground)]" />
            <span className="text-[var(--color-muted-foreground)]">
              Đi đủ chu kỳ {form.streakCycleDays} ngày, một người nhận
            </span>
            <strong className="text-base tabular-nums">
              {cycleTotal.toLocaleString('vi-VN')} điểm
            </strong>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              ({form.streakCycleDays} × {form.pointsPerDay.toLocaleString('vi-VN')} cơ bản
              {bonusTotal > 0 && <> + {bonusTotal.toLocaleString('vi-VN')} thưởng mốc</>})
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => saveConfig(form)}
          disabled={!!error || isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving && <Loader2 size={16} className="animate-spin" />}
          Lưu cấu hình
        </button>
      </div>
    </div>
  )
}
