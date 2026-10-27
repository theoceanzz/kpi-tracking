import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useFormat } from '@/i18n/useFormat'
import { achievementSurface } from '@/components/charts/chartPalette'
import { cn } from '@/lib/utils'
import { useUnitPeriodHeatmap } from '../../hooks/useLeaderboard'
import { treeGuides } from './treeGuides'

/**
 * Lưới nhiệt %đạt: mỗi hàng một đơn vị (đơn vị đang xem + cây con), mỗi cột một đợt.
 *
 * <p>Trả lời câu "đơn vị nào tụt ở đợt nào" — thứ mà bảng xếp hạng một đợt không nói được và
 * đường xu hướng gộp cả tổ chức cũng không nói được.
 *
 * <p>Dựng bằng `<table>` chứ không qua thư viện biểu đồ: ô là chữ nhật đều nhau, không có trục nào
 * phải tính, và như vậy chụp ảnh/in ra vẫn sắc nét. Đây cũng là cách hai lưới nhiệt sẵn có trong
 * sản phẩm đang làm (`MatrixOverviewPanel`, `HeatmapCard`).
 *
 * <p>Màu lấy từ `achievementSurface` dùng chung — không tự chế thang màu, không thì cùng một mức
 * %đạt lại ra hai màu ở hai biểu đồ cạnh nhau.
 */
export default function UnitPeriodHeatmapWidget({ scope, meta }: {
  scope: { orgUnitId?: string; periodId?: string; periodIdTo?: string }
  meta?: React.ReactNode
}) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const navigate = useNavigate()
  const { data, isLoading } = useUnitPeriodHeatmap(scope)

  const periods = data?.periods ?? []
  const units = data?.units ?? []
  // Nét nối suy từ chính thứ tự + độ sâu server gửi; không hỏi thêm gì.
  const guides = treeGuides(units)

  if (!isLoading && (periods.length === 0 || units.length === 0)) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        {meta}
        <p className="flex-1 flex items-center justify-center px-6 text-center text-sm text-slate-400">
          {t('leaderboard.noHeatmapData')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {meta}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full border-separate border-spacing-[2px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--color-card)] px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t('leaderboard.unit')}
              </th>
              {periods.map(p => (
                <th key={p.id} className="px-1 py-1 text-center text-[11px] font-medium text-slate-500">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((u, rowIndex) => (
              <tr key={u.orgUnitId ?? u.name}>
                <td
                  onClick={u.orgUnitId ? () => navigate(`/analytics/unit/${u.orgUnitId}`) : undefined}
                  className={cn(
                    'sticky left-0 z-10 max-w-[16rem] bg-[var(--color-card)] pr-2 text-sm text-[var(--color-foreground)]',
                    u.orgUnitId && 'cursor-pointer',
                  )}
                  title={u.name ?? undefined}
                >
                  <span className="flex h-8 items-stretch">
                    <TreeBranch guide={guides[rowIndex]} />
                    <span className="flex min-w-0 items-center truncate hover:underline">{u.name}</span>
                  </span>
                </td>
                {u.cells.map((v, i) => (
                  <td
                    key={periods[i]?.id ?? i}
                    className="h-8 rounded-control text-center text-[11px] font-semibold tabular-nums"
                    style={{
                      backgroundColor: v == null ? 'var(--color-muted)' : achievementSurface(v),
                      color: v == null ? 'var(--color-muted-foreground)' : '#1e293b',
                    }}
                    title={`${u.name} · ${periods[i]?.name ?? ''} · ${v == null ? t('leaderboard.noData') : fmt.percent(v)}`}
                  >
                    {v == null ? '' : fmt.percent(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chú giải: không có chú giải thì dải màu chỉ là trang trí. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-400">
        <span>{t('leaderboard.heatmapLegend')}</span>
        {[20, 50, 70, 90, 110].map(v => (
          <span key={v} className="inline-flex items-center gap-1">
            <span className="h-3 w-5 rounded-sm" style={{ backgroundColor: achievementSurface(v) }} />
            {v < 40 ? '<40%' : v < 60 ? '40–60%' : v < 80 ? '60–80%' : v < 100 ? '80–100%' : '≥100%'}
          </span>
        ))}
        {data?.source === 'BSC' && <span>{t('leaderboard.heatmapFromBsc')}</span>}
      </div>
    </div>
  )
}

/**
 * Nét nối của một hàng trong cột tên đơn vị.
 *
 * <p>Vẽ bằng VIỀN của các ô trống đều nhau, không dùng ký tự khung (`├`, `└`): phông hệ thống vẽ
 * mỗi máy một kiểu và `html-to-image` chụp đúng cái phông vẽ ra, nên ảnh chiếu dễ dính ô vuông.
 *
 * <p>Mỗi cấp một ô 16px. Cấp tổ tiên: một nét dọc chạy suốt NẾU cấp đó còn hàng bên dưới. Cấp của
 * chính hàng: nét dọc từ trên xuống giữa (nối lên cha), nét ngang từ giữa sang phải (nối vào tên),
 * và nét dọc chạy tiếp xuống dưới nếu chưa phải hàng cuối của nhánh.
 */
function TreeBranch({ guide }: { guide?: { isLast: boolean; ancestorContinues: boolean[] } }) {
  const line = 'absolute bg-[var(--color-border)]'
  if (!guide || guide.ancestorContinues.length === 0) {
    return <span className="w-2 shrink-0" aria-hidden="true" />
  }
  return (
    <span className="flex shrink-0 items-stretch" aria-hidden="true">
      {/* Cấp tổ tiên: chỉ có nét dọc, và chỉ khi nhánh đó còn hàng phía dưới. */}
      {guide.ancestorContinues.slice(0, -1).map((continues, i) => (
        <span key={i} className="relative w-4 shrink-0">
          {continues && <span className={cn(line, 'left-1/2 top-0 bottom-0 w-px -translate-x-1/2')} />}
        </span>
      ))}
      {/* Khuỷu của chính hàng này. */}
      <span className="relative w-4 shrink-0">
        <span className={cn(line, 'left-1/2 top-0 h-1/2 w-px -translate-x-1/2')} />
        {!guide.isLast && <span className={cn(line, 'left-1/2 top-1/2 bottom-0 w-px -translate-x-1/2')} />}
        <span className={cn(line, 'left-1/2 top-1/2 h-px w-1/2')} />
      </span>
      <span className="w-1.5 shrink-0" />
    </span>
  )
}
