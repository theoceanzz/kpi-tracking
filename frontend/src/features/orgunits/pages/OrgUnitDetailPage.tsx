import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { orgUnitApi } from '../api/orgUnitApi'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { 
  Building2, Users, Mail, Phone, MapPin, 
  ChevronRight, ArrowLeft, Globe,
  Target, Activity
} from 'lucide-react'
import { getInitials, formatDateTime } from '@/lib/utils'
import StatusBadge from '@/components/common/StatusBadge'

export default function OrgUnitDetailPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId || 'current'

  const { data: unit, isLoading: loadingUnit } = useQuery({
    queryKey: ['org-units', id],
    queryFn: () => orgUnitApi.getById(orgId, id!),
    enabled: !!id && !!orgId
  })

  const { data: usersData, isLoading: loadingUsers } = useUsers({
    orgUnitId: id,
    page: 0,
    size: 100
  })

  // Get subtree to show child units
  const { data: subtree, isLoading: loadingSubtree } = useQuery({
    queryKey: ['org-units', id, 'subtree'],
    queryFn: () => orgUnitApi.getSubtree(orgId, id!),
    enabled: !!id && !!orgId
  })

  const isLoading = loadingUnit || loadingUsers || loadingSubtree

  if (isLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  if (!unit) return <div className="p-8"><EmptyState title="Không tìm thấy đơn vị" description="Đơn vị bạn đang tìm kiếm không tồn tại hoặc đã bị xóa." /></div>

  const members = usersData?.content || []
  const childUnits = (subtree?.[0]?.children || [])

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Breadcrumbs / Back */}
      <div className="flex items-center gap-4">
        <Link to="/org-units" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={20} className="text-slate-500" />
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
           <Link to="/org-units" className="hover:text-indigo-600 transition-colors">Đơn vị</Link>
           <ChevronRight size={14} />
           <span className="text-slate-900 dark:text-white truncate max-w-[200px]">{unit.name}</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="p-8 md:p-10 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[32px] bg-indigo-600 flex items-center justify-center text-white text-3xl md:text-5xl font-black shadow-2xl shadow-indigo-600/20 shrink-0">
               {unit.logoUrl ? <img src={unit.logoUrl} alt={unit.name} className="w-full h-full object-cover rounded-[32px]" /> : getInitials(unit.name)}
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                  {unit.type || 'Đơn vị'}
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                  {unit.name}
                </h1>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-500">
                <div className="flex items-center gap-2"><Mail size={16} className="text-slate-400" /> {unit.email || 'N/A'}</div>
                <div className="flex items-center gap-2"><Phone size={16} className="text-slate-400" /> {unit.phone || 'N/A'}</div>
                <div className="flex items-center gap-2"><MapPin size={16} className="text-slate-400" /> {unit.address || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Summary Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 px-10 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryStat icon={<Users size={18} />} label="Thành viên" value={members.length} />
          <SummaryStat icon={<Building2 size={18} />} label="Đơn vị trực thuộc" value={childUnits.length} />
          <SummaryStat icon={<Target size={18} />} label="KPI Đang chạy" value={0} /> {/* Placeholder */}
          <SummaryStat icon={<Activity size={18} />} label="Tỉ lệ hoàn thành" value="0%" /> {/* Placeholder */}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content: Members */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Users size={20} className="text-indigo-600" /> Nhân sự trong đơn vị
              </h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{members.length}</span>
            </div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {members.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500 font-medium">Chưa có nhân sự nào trong đơn vị này.</div>
              ) : (
                members.map((m, idx) => (
                  <div key={m.id} className="p-5 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${idx * 40}ms` }}>
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-[14px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-600 shrink-0 border border-slate-200/50 dark:border-slate-700">
                        {getInitials(m.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{m.fullName}</p>
                        <p className="text-xs text-slate-500 font-medium">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <StatusBadge status={m.status} />
                       <Link to={`/users?search=${m.email}`} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                          <ChevronRight size={18} />
                       </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Sidebar: Child Units + Metadata */}
        <div className="space-y-6">
          
          {/* Child Units */}
          <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Building2 size={18} className="text-indigo-600" />
              <h3 className="font-black text-sm">Đơn vị cấp dưới</h3>
            </div>
            <div className="p-2 space-y-1">
              {childUnits.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500 italic">Không có đơn vị con</p>
              ) : (
                childUnits.map(unit => (
                  <Link 
                    key={unit.id} 
                    to={`/org-units/${unit.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center text-xs font-black">
                        {getInitials(unit.name)}
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">{unit.name}</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-600" />
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Org Info */}
          <section className="bg-slate-900 dark:bg-black rounded-[28px] p-6 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <Globe size={18} className="text-indigo-400" />
                <h3 className="text-sm font-black uppercase tracking-wider">Thông tin Hệ thống</h3>
              </div>
              
              <div className="space-y-4">
                 <InfoRow label="Cấp độ Hierarchy" value={unit.type || 'N/A'} />
                 <InfoRow label="Ngày tạo" value={unit.createdAt ? formatDateTime(unit.createdAt).split(' ')[0]! : 'N/A'} />
                 <InfoRow label="Lần cuối cập nhật" value={unit.updatedAt ? formatDateTime(unit.updatedAt).split(' ')[0]! : 'N/A'} />
              </div>

              <div className="pt-4">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Đường dẫn tổ chức</p>
                    <p className="text-[11px] font-mono opacity-60 break-all">{unit.path ?? '—'}</p>
                 </div>
              </div>
            </div>
          </section>

        </div>

      </div>

    </div>
  )
}

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm border border-slate-100 dark:border-slate-700/50">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-lg font-black text-slate-900 dark:text-white leading-none mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  )
}
