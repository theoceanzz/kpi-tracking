import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { platformAdminApi } from '../api/platformAdminApi'
import type { OrganizationAdminItem } from '../api/platformAdminApi'
import AiUsageSection from '../components/AiUsageSection'
import { Building2, Users, Target, FileText, Bot, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { StatCard } from '@/features/dashboard/widgets/shared/StatCard'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import Pagination from '@/components/common/Pagination'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  PENDING: 'Chờ duyệt',
  SUSPENDED: 'Tạm khóa',
  ARCHIVED: 'Đã lưu trữ',
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  SUSPENDED: 'destructive',
  ARCHIVED: 'secondary',
}

/** Nhãn Bật/Tắt của một tính năng. Mỗi tính năng một màu riêng để quét bảng theo cột cho nhanh. */
function FeatureBadge({ on }: { on: boolean; color?: string }) {
  return <Badge variant={on ? 'success' : 'secondary'}>{on ? 'Bật' : 'Tắt'}</Badge>
}

function AiToggle({ org, onToggle }: { org: OrganizationAdminItem; onToggle: (id: string, val: boolean) => void }) {
  return <Switch size="sm" checked={org.enableAi} onCheckedChange={v => onToggle(org.id, v)} aria-label={`${org.enableAi ? 'Tắt' : 'Bật'} AI cho ${org.name}`} />
}

export default function PlatformAdminPage() {
  const [page, setPage] = useState(0)
  const qc = useQueryClient()

  const { data: statsRes, isLoading: loadingStats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => platformAdminApi.getStats(),
  })

  const { data: orgsRes, isLoading: loadingOrgs } = useQuery({
    queryKey: ['admin', 'organizations', page],
    queryFn: () => platformAdminApi.getOrganizations(page, 20),
  })

  const featureMutation = useMutation({
    mutationFn: ({ id, enableAi }: { id: string; enableAi: boolean }) =>
      platformAdminApi.updateFeatures(id, { enableAi }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'organizations'] })
      qc.invalidateQueries({ queryKey: ['organization', variables.id] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Cập nhật thất bại')),
  })

  const stats = statsRes?.data?.data
  const orgsPage = orgsRes?.data?.data

  const handleToggleAi = (id: string, val: boolean) => {
    featureMutation.mutate({ id, enableAi: val })
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader title="Quản trị nền tảng" description="Thống kê toàn hệ thống, bật/tắt tính năng theo công ty và theo dõi ngân sách AI." />

      {/* Stats */}
      {loadingStats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-card bg-[var(--color-muted)] animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          <StatCard label="Tổng công ty" value={stats.totalOrgs} sub={`Đang hoạt động: ${stats.orgsByStatus?.ACTIVE ?? 0}`} icon={<Building2 />} color="indigo" />
          <StatCard label="Tổng người dùng" value={stats.totalUsers} sub={`Mới tháng này: +${stats.newUsersThisMonth}`} icon={<Users />} color="blue" />
          <StatCard label="Tổng KPI" value={stats.totalKpiCriteria} icon={<Target />} color="emerald" />
          <StatCard label="Nộp KPI tháng này" value={stats.totalSubmissionsThisMonth} icon={<FileText />} color="amber" />
          <StatCard label="Công ty bật AI" value={stats.orgsWithAiEnabled} sub={`Tổng: ${stats.totalOrgs}`} icon={<Bot />} color="indigo" />
          <StatCard label="Hội thoại AI" value={stats.totalAiConversations} icon={<TrendingUp />} color="purple" />
          <StatCard label="Tin nhắn AI" value={stats.totalAiMessages} icon={<Bot />} color="blue" />
          {stats.orgsByStatus?.PENDING != null && stats.orgsByStatus.PENDING > 0 && (
            <StatCard label="Chờ phê duyệt" value={stats.orgsByStatus.PENDING} icon={<Building2 />} color="amber" highlight />
          )}
        </div>
      ) : null}

      {/* Organizations table */}
      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-section-title">Danh sách công ty</h2>
          <span className="text-caption tabular-nums">{orgsPage?.totalElements ?? 0} công ty</span>
        </div>

        {loadingOrgs ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-control bg-[var(--color-muted)] animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile: card layout */}
            <div className="sm:hidden divide-y divide-[var(--color-border)]">
              {orgsPage?.content.map((org) => (
                <div key={org.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--color-foreground)] text-sm">{org.name}</p>
                      <p className="text-xs text-[var(--color-subtle-foreground)] font-mono mt-0.5">{org.code}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[org.status] ?? 'secondary'}>{STATUS_LABELS[org.status] ?? org.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between bg-[var(--color-muted)] rounded-control px-3 py-2">
                      <span className="text-[var(--color-muted-foreground)]">Người dùng</span>
                      <span className="font-semibold text-[var(--color-foreground)]">{org.userCount}</span>
                    </div>
                    <div className="flex items-center justify-between bg-[var(--color-muted)] rounded-control px-3 py-2">
                      <span className="text-[var(--color-muted-foreground)]">Ngày tạo</span>
                      <span className="font-medium text-[var(--color-muted-foreground)]">{new Date(org.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 bg-[var(--color-muted)] rounded-control px-2 py-2">
                      <span className="text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">AI</span>
                      <AiToggle org={org} onToggle={handleToggleAi} />
                    </div>
                    <div className="flex items-center justify-between bg-[var(--color-muted)] rounded-control px-2 py-2">
                      <span className="text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">OKR</span>
                      <FeatureBadge on={org.enableOkr} color="bg-[var(--color-primary-soft)] text-[var(--color-primary)]" />
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[var(--color-muted)] rounded-control px-2 py-2">
                      <span className="text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">BSC</span>
                      <FeatureBadge on={org.enableBsc} color="bg-[var(--color-primary-soft)] text-[var(--color-primary)]" />
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[var(--color-muted)] rounded-control px-2 py-2">
                      <span className="text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">Thác nước</span>
                      <FeatureBadge on={org.enableWaterfall} color="bg-[var(--color-info-bg)] text-[var(--color-info)]" />
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[var(--color-muted)] rounded-control px-2 py-2">
                      <span className="text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">KPI hành vi</span>
                      <FeatureBadge on={org.enableQualitative} color="bg-[var(--color-success-bg)] text-[var(--color-success)]" />
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[var(--color-muted)] rounded-control px-2 py-2">
                      <span className="text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">Thưởng điểm</span>
                      <FeatureBadge on={org.enableReward} color="bg-[var(--color-warning-bg)] text-[var(--color-warning)]" />
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[var(--color-muted)] rounded-control px-2 py-2">
                      <span className="text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">Ví tiền</span>
                      <FeatureBadge on={org.enableCashWallet} color="bg-[var(--color-info-bg)] text-[var(--color-info)]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Tên công ty</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Mã</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Trạng thái</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Người dùng</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-eyebrow">AI</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-eyebrow hidden md:table-cell">OKR</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-eyebrow hidden md:table-cell">BSC</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-eyebrow hidden md:table-cell">Thác nước</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-eyebrow hidden md:table-cell">KPI hành vi</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-eyebrow hidden md:table-cell">Thưởng điểm</th>
                    <th scope="col" className="px-4 py-2.5 text-center text-eyebrow hidden md:table-cell">Ví tiền</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow hidden lg:table-cell">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {orgsPage?.content.map((org) => (
                    <tr key={org.id} className="hover:bg-[var(--color-muted)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{org.name}</td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)] font-mono text-xs">{org.code}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[org.status] ?? 'secondary'}>{STATUS_LABELS[org.status] ?? org.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-muted-foreground)]">{org.userCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <AiToggle org={org} onToggle={handleToggleAi} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <FeatureBadge on={org.enableOkr} color="bg-[var(--color-primary-soft)] text-[var(--color-primary)]" />
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <FeatureBadge on={org.enableBsc} color="bg-[var(--color-primary-soft)] text-[var(--color-primary)]" />
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <FeatureBadge on={org.enableWaterfall} color="bg-[var(--color-info-bg)] text-[var(--color-info)]" />
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <FeatureBadge on={org.enableQualitative} color="bg-[var(--color-success-bg)] text-[var(--color-success)]" />
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <FeatureBadge on={org.enableReward} color="bg-[var(--color-warning-bg)] text-[var(--color-warning)]" />
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <FeatureBadge on={org.enableCashWallet} color="bg-[var(--color-info-bg)] text-[var(--color-info)]" />
                      </td>
                      <td className="px-4 py-3 text-[var(--color-subtle-foreground)] text-xs hidden lg:table-cell">
                        {new Date(org.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {orgsPage && orgsPage.totalPages > 1 && (
          <div className="border-t border-[var(--color-border)] px-5 py-3">
            <Pagination currentPage={page} totalPages={orgsPage.totalPages} totalElements={orgsPage.totalElements} size={20} onPageChange={setPage} itemLabel="công ty" />
          </div>
        )}
      </div>

      {/* Ngân sách và tiêu thụ token AI theo từng công ty */}
      <AiUsageSection />
    </div>
  )
}
