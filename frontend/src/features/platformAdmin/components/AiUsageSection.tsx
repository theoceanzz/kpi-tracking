import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Coins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { platformAdminApi, type OrgAiUsage } from '../api/platformAdminApi'

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN')

/** YYYY-MM của tháng hiện tại. */
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function BudgetInput({ row, onSaved }: { row: OrgAiUsage; onSaved: () => void }) {
  const [value, setValue] = useState(String(row.monthlyLimit ?? 0))
  const mutation = useMutation({
    mutationFn: (limit: number) => platformAdminApi.updateAiBudget(row.organizationId, limit),
    onSuccess: () => {
      toast.success(`Đã cập nhật ngân sách cho ${row.organizationName}`)
      onSaved()
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Không cập nhật được ngân sách'),
  })

  const parsed = Number(value.replace(/\D/g, '')) || 0
  const dirty = parsed !== (row.monthlyLimit ?? 0)

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="numeric"
        className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
      />
      <button
        type="button"
        onClick={() => mutation.mutate(parsed)}
        disabled={!dirty || mutation.isPending}
        className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-white transition-all hover:bg-indigo-700 disabled:opacity-40"
      >
        {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      </button>
    </div>
  )
}

export default function AiUsageSection() {
  const [month, setMonth] = useState(currentMonth())
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ai-usage', month],
    queryFn: () => platformAdminApi.getAiUsage(month),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'ai-usage'] })
  const totalUsed = (data ?? []).reduce((s, r) => s + (r.usedTokens ?? 0), 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
        <Coins size={18} className="text-indigo-600" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Token AI theo công ty</h3>
          <p className="text-xs text-slate-500">
            Tổng đã tiêu trong tháng: <span className="font-bold">{fmt(totalUsed)}</span> token
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-indigo-600" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">Chưa có dữ liệu tiêu thụ.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Công ty</th>
                <th className="px-4 py-3 text-right font-medium">Đã tiêu</th>
                <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Lượt gọi</th>
                <th className="px-4 py-3 text-left font-medium">Mức dùng</th>
                <th className="px-4 py-3 text-right font-medium">Ngân sách/tháng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data!.map((row) => {
                const pct = row.usagePercent
                return (
                  <tr key={row.organizationId}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{row.organizationName}</p>
                      <p className="text-xs text-slate-500">{row.organizationCode}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(row.usedTokens)}</td>
                    <td className="hidden px-4 py-3 text-right text-slate-500 sm:table-cell">
                      {fmt(row.callCount)}
                    </td>
                    <td className="px-4 py-3">
                      {pct === null ? (
                        <span className="text-xs text-slate-400">Chưa cấp ngân sách</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                              )}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold">{pct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <BudgetInput row={row} onSaved={refresh} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
