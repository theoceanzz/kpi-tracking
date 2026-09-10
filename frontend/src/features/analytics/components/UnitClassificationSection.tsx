import { useMemo } from 'react'
import { Award, Activity, Building2, TrendingUp } from 'lucide-react'
import type { UnitClassificationOverview } from '../api/unitClassificationApi'
import StackedComposition from '@/components/charts/primitives/StackedComposition'
import DensityCurve from '@/components/charts/primitives/DensityCurve'
import { seriesColor } from '@/components/charts/chartPalette'

const fmt1 = (v?: number | null) => (v == null ? '—' : (Math.round(v * 10) / 10).toString())

/**
 * Xếp loại ĐƠN VỊ theo phân bố % xếp loại thành viên: badge + phân bố + biểu đồ đường + đơn vị con.
 *
 * <p>`part` chia đôi phần hiển thị vì hai nửa trả lời hai câu khác nhau: `unit` là xếp loại của
 * chính đơn vị đang xem, `children` là xếp loại của các đơn vị bên dưới. **Bỏ trống `part` mới là
 * hành vi đầy đủ** — tab Phân cấp cố ý gọi hai lần với hai giá trị để đặt mỗi nửa vào đúng khối
 * của nó, và React Query gộp chung một request nên không tốn thêm lượt gọi mạng.
 */
export default function UnitClassificationSection({ overview, part }: {
  overview?: UnitClassificationOverview
  part?: 'unit' | 'children'
}) {
  const dist = overview?.distribution ?? []
  const cls = overview?.classification
  // Xem theo kỳ thì phân bố lấy từ số chốt kỳ, không phải một đợt nào cả — nhãn phải nói đúng
  // nguồn số, nếu không người đọc sẽ tưởng đang nhìn đợt gần nhất.

  // Đường phân phối: x = mức (thấp→cao), y = % người ở mức đó (kỳ hiện tại).
  const curve = useMemo(
    () => [...(overview?.distribution ?? [])].reverse().map(d => ({ level: d.level, percent: d.percent, count: d.count, color: d.color })),
    [overview]
  )

  // Cơ cấu xếp loại qua các đợt. `percents` do backend chia sẵn nên đã cộng đúng 100 mỗi kỳ —
  // không bật `normalize`, chuẩn hoá thêm lần nữa chỉ làm tooltip hiện "% (%)".
  //
  // Thứ tự chuỗi lấy theo `curve` (thấp→cao) để mức tốt nhất nằm trên đỉnh: dải trên phình ra là
  // chất lượng đi lên, đọc được ngay mà không phải dò chú giải.
  const shareSeries = useMemo(() => {
    const seen = new Set<string>()
    const out = curve.map((d, i) => {
      seen.add(d.level)
      return { code: d.level, label: d.level, color: d.color || seriesColor(i) }
    })
    // Mức chỉ xuất hiện ở kỳ cũ (không còn trong phân bố kỳ hiện tại) vẫn phải có chỗ, nếu không
    // cột của kỳ đó hụt mất một phần mà không báo gì.
    ;(overview?.trend ?? []).forEach(t => Object.keys(t.percents ?? {}).forEach(lv => {
      if (!seen.has(lv)) { seen.add(lv); out.push({ code: lv, label: lv, color: seriesColor(out.length) }) }
    }))
    return out
  }, [curve, overview])

  const sharePoints = useMemo(
    () => (overview?.trend ?? []).map(t => ({ label: t.periodName, values: t.percents ?? {} })),
    [overview]
  )

  const showUnit = part !== 'children'
  const showChildren = part !== 'unit'

  if (overview && overview.evaluatedMembers === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-400 font-medium">
        Chưa có đánh giá nào để xếp loại đơn vị cho phạm vi/đợt/kỳ đang chọn.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showUnit && (
        <>
        {/* Badge xếp loại + phân bố */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Badge lớn */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col items-center justify-center gap-2 text-center"
            style={{ backgroundColor: cls ? `${cls.color}14` : undefined }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: cls ? `${cls.color}22` : '#94a3b822', color: cls?.color ?? '#94a3b8' }}>
              <Award size={26} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Xếp loại đơn vị</p>
            <p className="text-2xl font-black" style={{ color: cls?.color ?? '#64748b' }}>{cls?.level ?? '—'}</p>
            <p className="text-[11px] font-bold text-slate-400">
              {overview?.evaluatedMembers ?? 0}/{overview?.totalMembers ?? 0} người có đánh giá
              {overview?.currentPeriodName ? ` · ${overview.currentPeriodName}` : ''}
            </p>
            {overview?.appliedProfileName && (
              <p className="text-[10px] font-black text-indigo-500 mt-0.5">Hồ sơ: {overview.appliedProfileName}</p>
            )}
          </div>

          {/* Phân bố người theo mức */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Phân bố người theo mức</h4>
            {/* Thanh ngang xếp chồng */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 mb-3">
              {dist.filter(d => d.percent > 0).map(d => (
                <div key={d.level} style={{ width: `${d.percent}%`, backgroundColor: d.color }} title={`${d.level}: ${fmt1(d.percent)}%`} />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {dist.map(d => (
                <div key={d.level} className="text-center">
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <p className="text-[13px] font-black text-slate-800 dark:text-slate-100 mt-1">{d.count}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate" title={d.level}>{d.level}</p>
                  <p className="text-[10px] font-black" style={{ color: d.color }}>{fmt1(d.percent)}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Đường cong phân bố: CÙNG dữ liệu với dải ngang ở trên (`distribution`), chỉ khác cách đọc.
            Phải cùng nguồn thì hai hình mới nói cùng một con số — lấy từ phân phối điểm riêng sẽ ra
            bộ mức khác và tổng người khác, đặt cạnh nhau thành mâu thuẫn. */}
        {curve.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
            <h4 className="text-sm font-black flex items-center gap-2 mb-1">
              <Activity size={16} className="text-indigo-600" /> Phân phối % người theo mức xếp hạng
              {overview?.currentPeriodName && <span className="text-[11px] font-bold text-slate-400">· {overview.currentPeriodName}</span>}
            </h4>
            <p className="text-[11px] text-slate-500 font-medium mb-3">
              Hình dạng phân bố — đám đông dồn vào giữa, lệch về phía yếu, hay tách thành hai cụm
            </p>
            <DensityCurve
              levels={curve.map(c => ({ name: c.level, count: c.count, percent: c.percent, color: c.color }))}
              total={overview?.evaluatedMembers}
              lowLabel="Cần cải thiện"
              highLabel="Xuất sắc"
            />
          </div>
        )}

        {/* Tỉ trọng xếp loại qua các đợt — 100% stacked area */}
        {sharePoints.length > 1 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
            <h4 className="text-sm font-black flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-emerald-600" /> Tỉ trọng xếp loại qua các đợt
            </h4>
            <p className="text-[11px] text-slate-500 font-medium mb-3">
              Mỗi đợt cao đúng 100% — cho thấy chất lượng nhân sự dịch chuyển giữa các mức ra sao, không bị chi phối bởi số người được đánh giá mỗi đợt
            </p>
            <StackedComposition
              yLabel="Tỉ trọng (%)"
              series={shareSeries}
              points={sharePoints}
              variant="area"
              unit="%"
              height={280}
              rotateLabels={sharePoints.length > 6}
            />
          </div>
        )}
        </>
      )}

      {/* Xếp loại nhanh các đơn vị con */}
      {showChildren && (overview?.children?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
          <h4 className="text-sm font-black flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-indigo-600" /> Xếp loại đơn vị con
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview!.children.map(c => (
              <div key={c.orgUnitId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{c.orgUnitName}</p>
                  <p className="text-[10px] font-bold text-slate-400">
                    {c.evaluatedMembers} người đánh giá
                    {c.appliedProfileName ? ` · ${c.appliedProfileName}` : ''}
                  </p>
                </div>
                {c.classification ? (
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-lg shrink-0"
                    style={{ backgroundColor: `${c.color}1f`, color: c.color ?? '#64748b' }}>{c.classification}</span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-300 shrink-0">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
