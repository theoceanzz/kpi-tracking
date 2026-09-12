import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Coins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import NumberInput from '@/components/common/NumberInput'
import { platformAdminApi, type OrgAiUsage } from '../api/platformAdminApi'
import { Button } from '@/components/ui/button'

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN')

/** YYYY-MM của tháng hiện tại. */
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function BudgetInput({ row, onSaved }: { row: OrgAiUsage; onSaved: () => void }) {
  const [value, setValue] = useState(row.monthlyLimit ?? 0)
  const mutation = useMutation({
    mutationFn: (limit: number) => platformAdminApi.updateAiBudget(row.organizationId, limit),
    onSuccess: () => {
      toast.success(`Đã cập nhật ngân sách cho ${row.organizationName}`)
      onSaved()
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, 'Không cập nhật được ngân sách')),
  })

  const dirty = value !== (row.monthlyLimit ?? 0)

  return (
    <div className="flex items-center justify-end gap-2">
      <NumberInput
        value={value}
        onChange={setValue}
        disabled={mutation.isPending}
        className="w-32 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-right text-sm outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
      />
      <Button size="sm" type="button" onClick={() => mutation.mutate(value)} disabled={!dirty || mutation.isPending}>
        {mutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
      </Button>
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
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-5">
        <Coins size={18} className="text-[var(--color-primary)]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-section-title">Token AI theo công ty</h3>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Tổng đã tiêu trong tháng: <span className="font-semibold">{fmt(totalUsed)}</span> token
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-[var(--color-primary)]" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">Chưa có dữ liệu tiêu thụ.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Công ty</th>
                <th className="px-4 py-3 text-right font-medium">Đã tiêu</th>
                <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Lượt gọi</th>
                <th className="px-4 py-3 text-left font-medium">Mức dùng</th>
                <th className="px-4 py-3 text-right font-medium">Ngân sách/tháng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data!.map((row) => {
                const pct = row.usagePercent
                return (
                  <tr key={row.organizationId}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--color-foreground)]">{row.organizationName}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">{row.organizationCode}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(row.usedTokens)}</td>
                    <td className="hidden px-4 py-3 text-right text-[var(--color-muted-foreground)] sm:table-cell">
                      {fmt(row.callCount)}
                    </td>
                    <td className="px-4 py-3">
                      {pct === null ? (
                        <span className="text-xs text-[var(--color-subtle-foreground)]">Chưa cấp ngân sách</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-border)]">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                pct >= 90 ? 'bg-[var(--color-error-solid)]' : pct >= 70 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-success-solid)]'
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
