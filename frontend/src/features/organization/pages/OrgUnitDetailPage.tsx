import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  ChevronRight,
  Layers,
  Edit2,
  UserCheck,
  Clock,
} from 'lucide-react'
import { useOrgUnit, useOrgUnitSubtree, useOrgHierarchyLevels } from '../hooks/useOrganizationStructure'
import { useOrgUnitMembers } from '../hooks/useUserRoles'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { MemberManagement } from '../components/MemberManagement'
import { SubUnitList } from '../components/SubUnitList'
import { OrgUnitDrawer, DrawerState } from '../components/OrgUnitDrawer'
import { formatPhoneNumber } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'

export default function OrgUnitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  
  const [drawerState, setDrawerState] = useState<DrawerState>({
    isOpen: false,
    mode: 'edit',
    parentNode: null,
    currentNode: null
  })

  const backToStructure = () => navigate('/org-structure')

  const { data: unit, isLoading, error } = useOrgUnit(orgId, id)
  const { data: subtree = [] } = useOrgUnitSubtree(orgId, id)
  const { data: hierarchyLevels = [] } = useOrgHierarchyLevels(orgId)
  const { data: members = [] } = useOrgUnitMembers(id)

  const memberCount = new Set(members.map(m => m.userId)).size

  const levelsMap = hierarchyLevels.reduce((acc, level) => {
    acc[level.levelOrder] = level.unitTypeName
    return acc
  }, {} as Record<number, string>)

  const subUnits = subtree[0]?.children || []

  const handleEditUnit = () => {
    if (!unit) return
    setDrawerState({
      isOpen: true,
      mode: 'edit',
      parentNode: null,
      currentNode: unit
    })
  }

  if (isLoading) return <div className="mx-auto max-w-[1200px]"><LoadingSkeleton type="form" rows={6} /></div>

  if (error || !unit) {
    return (
      <div className="mx-auto max-w-[1200px] rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState
          icon={Building2}
          title="Không tìm thấy đơn vị"
          description="Đơn vị này có thể đã bị xoá hoặc bạn không có quyền xem."
          action={<Button variant="outline" onClick={backToStructure}><ArrowLeft aria-hidden="true" /> Về cơ cấu tổ chức</Button>}
        />
      </div>
    )
  }

  const isActive = unit.status === 'ACTIVE' || memberCount > 0
  const address = [unit.address, unit.districtName, unit.provinceName].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* Header: quay lại + tên + trạng thái; hành động ở góc phải — cùng khuôn với mọi trang chi tiết (P8) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Quay lại" className="shrink-0"><ArrowLeft aria-hidden="true" /></Button>
          <div className="min-w-0">
            <nav aria-label="Đường dẫn" className="mb-1 flex items-center gap-1 text-caption">
              <button type="button" onClick={backToStructure} className="hover:text-[var(--color-foreground)] hover:underline">Cơ cấu tổ chức</button>
              <ChevronRight size={12} aria-hidden="true" />
              <span className="truncate text-[var(--color-foreground)]">{unit.name}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title truncate" title={unit.name}>{unit.name}</h1>
              <Badge variant={isActive ? 'success' : 'secondary'}>{isActive ? 'Hoạt động' : 'Tạm dừng'}</Badge>
              <Badge variant="outline">{unit.type}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {levelsMap[unit.level] ? `${levelsMap[unit.level]} · ` : ''}cấp {unit.level}
              {unit.code && <> · mã <span className="font-mono">{unit.code}</span></>}
              {' · '}<span className="tabular-nums">{memberCount} thành viên</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={backToStructure}><Layers aria-hidden="true" /> Sơ đồ tổ chức</Button>
          <Button onClick={handleEditUnit}><Edit2 aria-hidden="true" /> Chỉnh sửa</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {/* Thông tin hành chính */}
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
                {unit.logoUrl
                  ? <img src={unit.logoUrl} alt={unit.name} className="h-full w-full object-cover" />
                  : <Building2 size={28} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-section-title">Thông tin hành chính</h2>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="flex items-center gap-1.5 text-eyebrow"><Mail size={12} aria-hidden="true" /> Email</dt>
                    <dd className="mt-0.5 break-all text-[var(--color-foreground)]">{unit.email || <span className="text-[var(--color-subtle-foreground)]">Chưa cập nhật</span>}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-eyebrow"><Phone size={12} aria-hidden="true" /> Điện thoại</dt>
                    <dd className="mt-0.5 tabular-nums text-[var(--color-foreground)]">{formatPhoneNumber(unit.phone) || <span className="text-[var(--color-subtle-foreground)]">Chưa cập nhật</span>}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="flex items-center gap-1.5 text-eyebrow"><MapPin size={12} aria-hidden="true" /> Địa chỉ</dt>
                    <dd className="mt-0.5 text-[var(--color-foreground)]">{address || <span className="text-[var(--color-subtle-foreground)]">Chưa cập nhật</span>}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <MemberManagement orgUnitId={id || ''} />

          <SubUnitList units={subUnits} />
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-eyebrow">Lịch sử</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]"><Clock size={13} aria-hidden="true" /> Tạo lúc</dt>
                <dd className="text-right tabular-nums text-[var(--color-foreground)]">{format(new Date(unit.createdAt), 'HH:mm dd/MM/yyyy', { locale: vi })}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]"><Calendar size={13} aria-hidden="true" /> Cập nhật</dt>
                <dd className="text-right tabular-nums text-[var(--color-foreground)]">{format(new Date(unit.updatedAt), 'HH:mm dd/MM/yyyy', { locale: vi })}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]"><UserCheck size={13} aria-hidden="true" /> Thành viên</dt>
                <dd className="text-right tabular-nums text-[var(--color-foreground)]">{memberCount}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="flex items-center gap-1.5 text-eyebrow"><ShieldCheck size={13} aria-hidden="true" /> Ghi nhật ký</h2>
            <p className="mt-2 text-caption leading-relaxed">
              Mọi thay đổi nhân sự và cấu hình của đơn vị được ghi lại kèm người thực hiện và thời điểm.
            </p>
          </section>
        </aside>
      </div>

      {orgId && (
        <OrgUnitDrawer
          orgId={orgId}
          drawerState={drawerState}
          onClose={() => setDrawerState(prev => ({ ...prev, isOpen: false }))}
          hierarchyLevels={levelsMap}
        />
      )}
    </div>
  )
}
