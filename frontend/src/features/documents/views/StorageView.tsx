import { useTranslation } from 'react-i18next'
import { Archive, Building2, History, Layers, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatNumber } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { useStorageStats } from '../hooks/useDocuments'
import type { DocumentScope } from '../types'
import { formatBytes } from '../utils'

const SCOPE_ICON: Record<DocumentScope, typeof User> = { PERSONAL: User, UNIT: Layers, COMPANY: Building2 }

/** Thanh tỉ lệ dùng / hạn mức. ≥ 90% đỏ, ≥ 70% vàng. */
function UsageBar({ used, quota, label }: { used: number; quota: number; label: string }) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
  const tone = pct >= 90 ? 'bg-[var(--color-error)]' : pct >= 70 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-primary)]'
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/**
 * Dung lượng thư viện tài liệu cho quản trị (docs/DOCUMENTS_DESIGN.md §16.5): mỗi phạm vi dùng bao nhiêu, đơn vị nào /
 * ai dùng nhiều nhất so với hạn mức, thùng rác và phiên bản cũ chiếm bao nhiêu. Kho cá nhân chỉ hiện số lượng và dung
 * lượng theo người — không tên, không nội dung tài liệu.
 */
export default function StorageView() {
  const { t } = useTranslation('documents')
  const { data, isLoading } = useStorageStats(true)
  if (isLoading || !data) return <LoadingSkeleton type="table" rows={6} />

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.scopes.map(s => {
          const Icon = SCOPE_ICON[s.scope]
          return (
            <div key={s.scope} className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-foreground)]">
                <Icon size={15} className="text-[var(--color-muted-foreground)]" aria-hidden="true" /> {t(`scope.${s.scope}`)}
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-foreground)]">
                {formatBytes(s.bytes)}
                {s.quota != null && <span className="text-sm font-normal text-[var(--color-muted-foreground)]"> / {formatBytes(s.quota)}</span>}
              </p>
              <p className="text-caption">{t('storage.docsAndChunks', { count: s.count, chunks: formatNumber(s.chunks) })}</p>
              {s.quota != null && <div className="mt-2"><UsageBar used={s.bytes} quota={s.quota} label={t(`scope.${s.scope}`)} /></div>}
              {s.scope === 'UNIT' && <p className="mt-1 text-caption">{t('storage.perUnitQuota', { quota: formatBytes(data.unitQuota) })}</p>}
              {s.scope === 'PERSONAL' && <p className="mt-1 text-caption">{t('storage.perPersonQuota', { quota: formatBytes(data.personalQuota) })}</p>}
            </div>
          )
        })}
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm font-medium text-[var(--color-foreground)]">{t('storage.aiChunks')}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-foreground)]">
            {formatNumber(data.orgChunks)}<span className="text-sm font-normal text-[var(--color-muted-foreground)]"> / {formatNumber(data.orgChunkQuota)}</span>
          </p>
          <div className="mt-2"><UsageBar used={data.orgChunks} quota={data.orgChunkQuota} label={t('storage.aiChunks')} /></div>
        </div>
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-foreground)]"><Archive size={15} aria-hidden="true" /> {t('storage.trash')}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-foreground)]">{formatBytes(data.trash.bytes)}</p>
          <p className="text-caption">{t('storage.trashHint', { count: data.trash.count, days: data.trashRetentionDays })}</p>
        </div>
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-foreground)]"><History size={15} aria-hidden="true" /> {t('storage.versions')}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-foreground)]">{formatBytes(data.versions.bytes)}</p>
          <p className="text-caption">{t('storage.versionsHint', { count: data.versions.count })}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-foreground)]">{t('storage.topUnits')}</h2>
        {data.topUnits.length === 0 ? <p className="p-4 text-caption">{t('storage.none')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th scope="col" className="px-4 py-2.5 text-eyebrow">{t('table.unit')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{t('storage.docs')}</th>
                  <th scope="col" className="w-56 px-3 py-2.5 text-eyebrow">{t('storage.usedOfQuota')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{t('storage.chunks')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.topUnits.map(u => (
                  <tr key={u.unitId}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[var(--color-foreground)]">{u.name ?? t('badge.orphan')}</p>
                      {u.path && <p className="text-caption">{u.path}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(u.count)}</td>
                    <td className="px-3 py-2.5">
                      <p className="mb-1 text-xs tabular-nums">{formatBytes(u.bytes)} / {formatBytes(data.unitQuota)}</p>
                      <UsageBar used={u.bytes} quota={data.unitQuota} label={u.name ?? ''} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(u.chunks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{t('storage.topOwners')}</h2>
          <p className="text-caption">{t('storage.topOwnersHint')}</p>
        </div>
        {data.topOwners.length === 0 ? <p className="p-4 text-caption">{t('storage.none')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th scope="col" className="px-4 py-2.5 text-eyebrow">{t('storage.person')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{t('storage.docs')}</th>
                  <th scope="col" className="w-56 px-3 py-2.5 text-eyebrow">{t('storage.usedOfQuota')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{t('storage.chunks')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.topOwners.map(o => (
                  <tr key={o.userId}>
                    <td className="px-4 py-2.5">
                      <p className="flex items-center gap-2 font-medium text-[var(--color-foreground)]">
                        {o.name ?? t('storage.deletedUser')}
                        {o.deactivated && <Badge variant="warning">{t('storage.deactivated')}</Badge>}
                      </p>
                      {o.email && <p className="text-caption">{o.email}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(o.count)}</td>
                    <td className="px-3 py-2.5">
                      <p className="mb-1 text-xs tabular-nums">{formatBytes(o.bytes)} / {formatBytes(data.personalQuota)}</p>
                      <UsageBar used={o.bytes} quota={data.personalQuota} label={o.name ?? ''} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(o.chunks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
