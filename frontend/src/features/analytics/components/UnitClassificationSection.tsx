import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Award, Activity, Building2 } from 'lucide-react'
import type { UnitClassificationOverview } from '../api/unitClassificationApi'

const fmt1 = (v?: number | null) => (v == null ? '—' : (Math.round(v * 10) / 10).toString())

/** Điểm trên đường phân phối, tô màu theo mức xếp hạng. */
function DistDot(props: any) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null
  return <circle cx={cx} cy={cy} r={4.5} fill={payload?.color ?? '#6366f1'} stroke="#fff" strokeWidth={1.5} />
}

/** Xếp loại ĐƠN VỊ theo phân bố % xếp loại thành viên: badge + phân bố + biểu đồ đường + đơn vị con. */
export default function UnitClassificationSection({ overview }: { overview?: UnitClassificationOverview }) {
  const dist = overview?.distribution ?? []
  const cls = overview?.classification

  // Đường phân phối: x = mức (thấp→cao), y = % người ở mức đó (kỳ hiện tại).
  const curve = useMemo(
    () => [...(overview?.distribution ?? [])].reverse().map(d => ({ level: d.level, percent: d.percent, color: d.color })),
    [overview]
  )

  if (overview && overview.evaluatedMembers === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-400 font-medium">
        Chưa có đánh giá nào để xếp loại đơn vị cho phạm vi/kỳ đang chọn.
      </div>
    )
  }

  return (
    <div className="space-y-4">
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

      {/* Đường phân phối: x = mức xếp hạng (thấp→cao), y = % người (kỳ hiện tại) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
        <h4 className="text-sm font-black flex items-center gap-2 mb-4">
          <Activity size={16} className="text-indigo-600" /> Phân phối % người theo mức xếp hạng
          {overview?.currentPeriodName && <span className="text-[11px] font-bold text-slate-400">· {overview.currentPeriodName}</span>}
        </h4>
        {curve.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" strokeOpacity={0.8} />
                <XAxis dataKey="level" interval={0} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} width={40} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [`${fmt1(v as number)}% người`, 'Tỷ lệ']} labelFormatter={(l: any) => `Mức: ${l}`} />
                <Line type="monotone" dataKey="percent" name="% người" stroke="#6366f1" strokeWidth={2.5}
                  isAnimationActive={false} dot={<DistDot />} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[120px] flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu phân bố</div>
        )}
      </div>

      {/* Xếp loại nhanh các đơn vị con */}
      {(overview?.children?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
          <h4 className="text-sm font-black flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-indigo-600" /> Xếp loại đơn vị con
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview!.children.map(c => (
              <div key={c.orgUnitId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{c.orgUnitName}</p>
                  <p className="text-[10px] font-bold text-slate-400">{c.evaluatedMembers} người đánh giá</p>
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
