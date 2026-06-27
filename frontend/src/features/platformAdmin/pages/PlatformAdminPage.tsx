import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { platformAdminApi } from '../api/platformAdminApi'
import type { OrganizationAdminItem } from '../api/platformAdminApi'
import {
  Building2, Users, Target, FileText, Bot, TrendingUp,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  PENDING: 'Chờ duyệt',
  SUSPENDED: 'Tạm khóa',
  ARCHIVED: 'Đã lưu trữ',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm">
      <div className={cn('p-3 rounded-lg', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value.toLocaleString('vi-VN')}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function AiToggle({ org, onToggle }: { org: OrganizationAdminItem; onToggle: (id: string, val: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(org.id, !org.enableAi)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
        org.enableAi ? 'bg-indigo-500' : 'bg-gray-300'
      )}
      role="switch"
      aria-checked={org.enableAi}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
          org.enableAi ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  )
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
    onError: () => toast.error('Cập nhật thất bại'),
  })

  const stats = statsRes?.data?.data
  const orgsPage = orgsRes?.data?.data

  const handleToggleAi = (id: string, val: boolean) => {
    featureMutation.mutate({ id, enableAi: val })
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản trị nền tảng</h1>
        <p className="text-sm text-gray-500 mt-1">Thống kê toàn hệ thống và quản lý các công ty</p>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            label="Tổng công ty"
            value={stats.totalOrgs}
            sub={`Đang hoạt động: ${stats.orgsByStatus?.ACTIVE ?? 0}`}
            icon={Building2}
            color="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            label="Tổng người dùng"
            value={stats.totalUsers}
            sub={`Mới tháng này: +${stats.newUsersThisMonth}`}
            icon={Users}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="Tổng KPI"
            value={stats.totalKpiCriteria}
            icon={Target}
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Nộp KPI tháng này"
            value={stats.totalSubmissionsThisMonth}
            icon={FileText}
            color="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="Công ty bật AI"
            value={stats.orgsWithAiEnabled}
            sub={`Tổng: ${stats.totalOrgs}`}
            icon={Bot}
            color="bg-violet-50 text-violet-600"
          />
          <StatCard
            label="Hội thoại AI"
            value={stats.totalAiConversations}
            icon={TrendingUp}
            color="bg-pink-50 text-pink-600"
          />
          <StatCard
            label="Tin nhắn AI"
            value={stats.totalAiMessages}
            icon={Bot}
            color="bg-cyan-50 text-cyan-600"
          />
          {stats.orgsByStatus?.PENDING != null && stats.orgsByStatus.PENDING > 0 && (
            <StatCard
              label="Chờ phê duyệt"
              value={stats.orgsByStatus.PENDING}
              icon={Building2}
              color="bg-amber-50 text-amber-600"
            />
          )}
        </div>
      ) : null}

      {/* Organizations table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Danh sách công ty</h2>
          <span className="text-sm text-gray-400">{orgsPage?.totalElements ?? 0} công ty</span>
        </div>

        {loadingOrgs ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="px-5 py-3 text-left font-medium">Tên công ty</th>
                  <th className="px-5 py-3 text-left font-medium">Mã</th>
                  <th className="px-5 py-3 text-left font-medium">Trạng thái</th>
                  <th className="px-5 py-3 text-right font-medium">Người dùng</th>
                  <th className="px-5 py-3 text-center font-medium">AI</th>
                  <th className="px-5 py-3 text-center font-medium">OKR</th>
                  <th className="px-5 py-3 text-center font-medium">Thác nước</th>
                  <th className="px-5 py-3 text-left font-medium">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orgsPage?.content.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{org.name}</td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{org.code}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[org.status] ?? 'bg-gray-100 text-gray-600')}>
                        {STATUS_LABELS[org.status] ?? org.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-600">{org.userCount}</td>
                    <td className="px-5 py-3.5 flex justify-center">
                      <AiToggle org={org} onToggle={handleToggleAi} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', org.enableOkr ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400')}>
                        {org.enableOkr ? 'Bật' : 'Tắt'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', org.enableWaterfall ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-400')}>
                        {org.enableWaterfall ? 'Bật' : 'Tắt'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {new Date(org.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {orgsPage && orgsPage.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Trang {page + 1} / {orgsPage.totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={orgsPage.last}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
