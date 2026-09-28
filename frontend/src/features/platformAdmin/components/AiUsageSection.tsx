import { LocaleDateInput } from '@/components/ui/date-input'
import { intlLocale } from '@/i18n/format'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Coins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import NumberInput from '@/components/common/NumberInput'
import { platformAdminApi, type OrgAiUsage } from '../api/platformAdminApi'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString(intlLocale())

/** YYYY-MM của tháng hiện tại. */
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function BudgetInput({ row, onSaved }: { row: OrgAiUsage; onSaved: () => void }) {
  const { t } = useTranslation('platformAdmin')
  const [value, setValue] = useState(row.monthlyLimit ?? 0)
  const mutation = useMutation({
    mutationFn: (limit: number) => platformAdminApi.updateAiBudget(row.organizationId, limit),
    onSuccess: () => {
      toast.success(t('AiUsageSection.updatedTheBudgetFor', { organizationName: row.organizationName }))
      onSaved()
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, t('AiUsageSection.couldNotUpdateTheBudget'))),
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
  const { t } = useTranslation('platformAdmin')
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
          <h3 className="text-section-title">{t('AiUsageSection.aiTokensByCompany')}</h3>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {t('AiUsageSection.totalUsedThisMonth')} <span className="font-semibold">{fmt(totalUsed)}</span> token
          </p>
        </div>
        <LocaleDateInput
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
        <p className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">{t('AiUsageSection.noUsageDataYet')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t('AiUsageSection.company')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('AiUsageSection.used')}</th>
                <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">{t('AiUsageSection.calls')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('AiUsageSection.usage')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('AiUsageSection.budgetMonth')}</th>
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
                        <span className="text-xs text-[var(--color-subtle-foreground)]">{t('AiUsageSection.noBudgetAllocated')}</span>
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
