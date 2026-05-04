import { useState, useMemo, useEffect } from 'react'
import { useDetailTable } from '../hooks/useAnalytics'
import { useOrgUnitStats } from '@/features/dashboard/hooks/useOrgUnitStats'
import { cn, getInitials, formatDateTime } from '@/lib/utils'
import { Search, ChevronDown, CheckCircle2, Clock, XCircle, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SortKey = 'fullName' | 'assignedKpi' | 'completionRate' | 'totalSubmissions' | 'avgScore'

export default function DetailTableTab() {
  const [search, setSearch] = useState('')
  const [orgUnitId, setOrgUnitId] = useState<string>('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('completionRate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { data: orgUnits } = useOrgUnitStats()
  
  // Set root as default
  useEffect(() => {
    if (orgUnits && orgUnits.length > 0 && !orgUnitId) {
      const root = orgUnits.find(u => !u.parentOrgUnitId)
      if (root) setOrgUnitId(root.orgUnitId)
      else setOrgUnitId(orgUnits[0]!.orgUnitId)
    }
  }, [orgUnits, orgUnitId])

  const { data, isLoading } = useDetailTable({ orgUnitId: orgUnitId || undefined, search: search || undefined, page, size: 15 })

  const rows = useMemo(() => {
    if (!data?.content) return []
    const sorted = [...data.content]
    sorted.sort((a, b) => {
      let va: any = a[sortKey], vb: any = b[sortKey]
      if (va == null) va = -Infinity
      if (vb == null) vb = -Infinity
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [data?.content, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortHeader = ({ k, label, center }: { k: SortKey; label: string; center?: boolean }) => (
    <th className={cn("px-4 py-3 cursor-pointer select-none hover:text-indigo-600 transition-colors", center && "text-center")} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{label}{sortKey === k && <ChevronDown size={10} className={cn("transition-transform", sortDir === 'asc' && "rotate-180")} />}</span>
    </th>
  )

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Tìm theo tên, email..." className="w-full pl-9 pr-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none" />
        </div>
        
        <Select value={orgUnitId} onValueChange={(val) => { setOrgUnitId(val); setPage(0) }}>
          <SelectTrigger className="w-[240px] h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
            <SelectValue placeholder="Chọn đơn vị" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
            {orgUnits?.map(u => (
              <SelectItem key={u.orgUnitId} value={u.orgUnitId} className="text-sm">
                {u.orgUnitName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <LoadingSkeleton rows={8} /> : !data || rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-dashed border-slate-300 dark:border-slate-700 p-16 text-center">
          <p className="font-bold text-slate-500">Không tìm thấy nhân viên phù hợp.</p>
        </div>
      ) : (
        <>
          <p className="text-xs font-bold text-slate-400">{data.totalElements} nhân viên</p>
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <SortHeader k="fullName" label="Nhân viên" />
                    <th className="px-4 py-3 text-center">Đơn vị</th>
                    <SortHeader k="assignedKpi" label="KPI" center />
                    <SortHeader k="completionRate" label="Tỷ lệ" center />
                    <SortHeader k="totalSubmissions" label="Bài nộp" center />
                    <th className="px-4 py-3 text-center">✓ / ⏳ / ✗</th>
                    <SortHeader k="avgScore" label="Điểm TB" center />
                    <th className="px-4 py-3 text-center">Nộp cuối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {rows.map(r => {
                    const isRisk = r.rejectedSubmissions > 0
                    const isIdle = r.assignedKpi > 0 && r.totalSubmissions === 0
                    return (
                      <tr key={r.userId} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors", isRisk && "bg-red-50/40 dark:bg-red-900/5", isIdle && "bg-amber-50/40 dark:bg-amber-900/5")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0">{getInitials(r.fullName)}</div>
                            <div className="min-w-0"><p className="font-bold text-slate-900 dark:text-white truncate">{r.fullName}</p><p className="text-[11px] text-slate-500 truncate">{r.email}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{r.orgUnitName || '—'}</td>
                        <td className="px-4 py-3 text-center font-black">{r.assignedKpi}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-block px-2 py-0.5 rounded-md text-xs font-black", r.completionRate >= 80 ? "bg-emerald-100 text-emerald-700" : r.completionRate >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>{r.completionRate}%</span>
                        </td>
                        <td className="px-4 py-3 text-center font-black">{r.totalSubmissions}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2 text-xs font-bold">
                            <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={12} />{r.approvedSubmissions}</span>
                            <span className="text-amber-600 flex items-center gap-0.5"><Clock size={12} />{r.pendingSubmissions}</span>
                            <span className="text-red-600 flex items-center gap-0.5"><XCircle size={12} />{r.rejectedSubmissions}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.avgScore != null ? (
                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black", r.avgScore >= 8 ? "bg-emerald-100 text-emerald-700" : r.avgScore >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}><Star size={10} />{r.avgScore.toFixed(1)}</span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500">{r.lastSubmissionDate ? formatDateTime(r.lastSubmissionDate).split(' ')[0] : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50"><ChevronLeft size={16} /></button>
              <span className="text-sm font-bold text-slate-600 px-3">{page + 1} / {data.totalPages}</span>
              <button disabled={data.last} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
