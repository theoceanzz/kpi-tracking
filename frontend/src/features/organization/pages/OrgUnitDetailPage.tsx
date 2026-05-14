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
  Globe,
  Layers,
  Edit2,
  Activity,
  UserCheck,
  Target,
  Clock,
  Sparkles
} from 'lucide-react'
import { useOrgUnit, useOrgUnitSubtree, useOrgHierarchyLevels } from '../hooks/useOrganizationStructure'
import { useOrgUnitMembers } from '../hooks/useUserRoles'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { MemberManagement } from '../components/MemberManagement'
import { SubUnitList } from '../components/SubUnitList'
import { OrgUnitDrawer, DrawerState } from '../components/OrgUnitDrawer'
import { cn, formatPhoneNumber } from '@/lib/utils'

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

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[500px] animate-in fade-in duration-700">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          <Building2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 w-6 h-6" />
        </div>
        <p className="mt-6 text-gray-500 font-black uppercase tracking-widest text-xs animate-pulse">Đang truy xuất thông tin...</p>
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div className="p-12 text-center bg-white rounded-[3rem] shadow-2xl border border-red-50 max-w-2xl mx-auto mt-20 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
          <Building2 size={48} />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Dữ liệu không khả dụng</h2>
        <p className="text-gray-500 mb-10 max-w-sm mx-auto text-lg leading-relaxed">
          Đơn vị này đã bị xóa hoặc bạn không có quyền truy cập thông tin cấp cao này.
        </p>
        <button 
          onClick={backToStructure}
          className="px-10 py-4 bg-gray-900 text-white rounded-2xl hover:bg-black font-black transition-all shadow-xl shadow-gray-200 flex items-center justify-center mx-auto gap-2"
        >
          <ArrowLeft size={20} />
          Trở về cấu trúc chính
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 px-4 md:px-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Dynamic Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => navigate(-1)}
            className="group p-4 bg-white hover:bg-gray-900 border border-gray-100 rounded-[1.25rem] transition-all text-gray-400 hover:text-white hover:scale-110 active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <nav className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">
              <span className="hover:text-blue-600 transition-colors flex items-center gap-1.5" onClick={backToStructure}>
                <Layers size={10} /> Cấu trúc tổ chức
              </span>
              <ChevronRight className="w-3 h-3 mx-2 text-gray-300" />
              <span className="text-blue-600 truncate max-w-[200px]">{unit.name}</span>
            </nav>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none">Thông tin chi tiết</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleEditUnit}
            className="flex-1 md:flex-none px-8 py-4 bg-white text-blue-600 border border-blue-100 rounded-2xl hover:bg-blue-600 hover:text-white font-black transition-all shadow-sm flex items-center justify-center gap-2 group"
          >
            <Edit2 size={18} className="group-hover:rotate-12 transition-transform" />
            Chỉnh sửa
          </button>
          <button 
            onClick={backToStructure}
            className="flex-1 md:flex-none px-8 py-4 bg-gray-900 text-white rounded-2xl hover:bg-black font-black transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2 group"
          >
            <Layers size={18} className="text-blue-400 group-hover:scale-110 transition-transform" />
            Sơ đồ tổ chức
          </button>
        </div>
      </div>

      {/* Premium Hero Section */}
      <div className="relative bg-white rounded-[3rem] shadow-2xl shadow-blue-900/5 border border-white overflow-hidden group/hero">
        <div className="h-56 bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 relative overflow-hidden">
          {/* Abstract patterns */}
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-40" />
          <div className="absolute top-6 right-8 flex items-center gap-3">
             <div className="px-5 py-2.5 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl">
               <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                 <Globe size={14} className="text-blue-300 animate-pulse" />
                 Global Governance System
               </p>
             </div>
          </div>
          
          {/* Logo container */}
          <div className="absolute -bottom-16 left-12 p-2 bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 transition-transform duration-500 group-hover/hero:scale-105">
            <div className="w-40 h-40 rounded-[2rem] bg-gray-50 flex items-center justify-center overflow-hidden">
              {unit.logoUrl ? (
                <img src={unit.logoUrl} alt={unit.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Building2 size={48} className="text-blue-200" />
                  <span className="text-[10px] font-black text-blue-100 uppercase tracking-widest">Office</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="pt-24 pb-12 px-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-5xl font-black text-gray-900 tracking-tighter leading-tight">{unit.name}</h2>
                <div className="flex items-center px-5 py-2 bg-blue-50 text-blue-700 text-[11px] font-black rounded-2xl uppercase tracking-[0.2em] border border-blue-100">
                  <Target size={14} className="mr-2" />
                  {unit.type}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-6 text-gray-500">
                <div className="flex items-center gap-2 font-bold text-sm bg-gray-50 px-4 py-2 rounded-xl">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  Cấu trúc phân cấp: <span className="text-gray-900">Level {unit.level}</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-sm bg-gray-50 px-4 py-2 rounded-xl">
                  <Activity size={18} className={
                    unit.status === 'ACTIVE' || memberCount > 0 ? 'text-emerald-500' : 'text-rose-500'
                  } />
                  Trạng thái: 
                  <span className={cn(
                    "font-black uppercase tracking-widest text-[10px]",
                    unit.status === 'ACTIVE' || memberCount > 0 ? 'text-emerald-600' : 'text-rose-600'
                  )}>
                    {unit.status === 'ACTIVE' || memberCount > 0 ? 'Hoạt động' : 'Tạm dừng'}
                  </span>
                </div>
                {unit.code && (
                  <div className="flex items-center gap-2 font-bold text-sm bg-gray-50 px-4 py-2 rounded-xl border border-dashed border-gray-200">
                    <span className="text-gray-400 uppercase text-[10px] tracking-widest">Mã định danh:</span>
                    <span className="text-indigo-600 font-mono">{unit.code}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-8 border-l border-gray-100 pl-10 hidden lg:flex">
               <div className="text-center">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Thành viên</p>
                 <div className="flex items-center justify-center gap-1.5 text-2xl font-black text-gray-900">
                    <UserCheck size={20} className="text-blue-500" />
                    <span>{memberCount}</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Content: Administrative Info & Members */}
        <div className="lg:col-span-8 space-y-10">
          <div className="bg-white rounded-[3rem] shadow-xl shadow-gray-200/40 border border-gray-100 p-12 relative overflow-hidden group/admin">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-0 group-hover/admin:opacity-100 transition-opacity duration-1000" />
            
            <h3 className="text-2xl font-black text-gray-900 mb-12 flex items-center gap-4">
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
              Thông tin hành chính
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
              <div className="space-y-10">
                <div className="group flex items-start gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:shadow-xl group-hover:shadow-blue-200 transition-all duration-500">
                    <Mail size={24} className="text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Hộp thư điện tử</p>
                    <p className="text-gray-900 font-black text-xl break-all leading-tight">{unit.email || 'Chưa cập nhật'}</p>
                  </div>
                </div>

                <div className="group flex items-start gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:shadow-xl group-hover:shadow-indigo-200 transition-all duration-500">
                    <Phone size={24} className="text-indigo-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Hotline nội bộ</p>
                    <p className="text-gray-900 font-black text-xl leading-tight">{formatPhoneNumber(unit.phone) || 'Chưa cập nhật'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-10">
                <div className="group flex items-start gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600 group-hover:shadow-xl group-hover:shadow-violet-200 transition-all duration-500">
                    <MapPin size={24} className="text-violet-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Vị trí thực tế</p>
                    <p className="text-gray-900 font-black text-lg leading-relaxed">
                      {unit.address ? `${unit.address}, ` : ''}
                      {unit.districtName ? `${unit.districtName}, ` : ''}
                      {unit.provinceName || 'Chưa cập nhật'}
                    </p>
                  </div>
                </div>

                <div className="group flex items-start gap-6">
                   <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:shadow-xl group-hover:shadow-blue-200 transition-all duration-500">
                    <Activity size={24} className="text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Quy mô quản trị</p>
                    <p className="text-gray-900 font-black text-xl leading-tight">Thành phần cấp {unit.level}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="animate-in slide-in-from-bottom-8 duration-700 delay-200">
            <MemberManagement orgUnitId={id || ''} />
          </div>

          <div className="animate-in slide-in-from-bottom-8 duration-700 delay-300">
            <SubUnitList units={subUnits} />
          </div>
        </div>

        {/* Sidebar: System Logs & Security */}
        <div className="lg:col-span-4 space-y-10">
          <div className="bg-white rounded-[3rem] shadow-xl shadow-gray-200/40 border border-gray-100 p-10 group/logs">
            <h3 className="text-sm font-black text-gray-900 mb-8 uppercase tracking-[0.3em] border-b pb-6 border-gray-50 flex items-center justify-between">
              Hệ thống quản trị
              <Calendar size={18} className="text-blue-600 transition-transform group-hover/logs:rotate-12" />
            </h3>
            
            <div className="space-y-10 relative">
              <div className="absolute left-1 top-2 bottom-2 w-0.5 bg-gray-50" />
              
              {[
                { label: 'Thời điểm khởi tạo', date: unit.createdAt, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Cập nhật gần nhất', date: unit.updatedAt, icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-50' }
              ].map((log, i) => (
                <div key={i} className="flex items-start gap-6 relative z-10">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm", log.bg)}>
                    <log.icon size={18} className={log.color} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{log.label}</p>
                    <p className="text-gray-900 font-black text-base">
                      {format(new Date(log.date), 'dd/MM/yyyy', { locale: vi })}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold bg-gray-50 inline-block px-2 py-0.5 rounded-md mt-1 italic">
                      Lúc {format(new Date(log.date), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Premium Security Card */}
          <div className="bg-gradient-to-br from-gray-900 via-indigo-950 to-black rounded-[3rem] p-1.5 shadow-2xl shadow-indigo-900/20 group/security">
            <div className="bg-white/5 backdrop-blur-3xl rounded-[2.85rem] p-10 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl transition-transform duration-1000 group-hover/security:scale-150" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-[1.25rem] bg-white/10 flex items-center justify-center border border-white/20 group-hover/security:rotate-6 transition-transform">
                  <ShieldCheck size={28} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-widest">An ninh dữ liệu</h3>
                  <p className="text-[10px] text-blue-300/60 font-bold uppercase tracking-tighter">Secured by KPI Systems</p>
                </div>
              </div>
              
              <p className="text-sm text-blue-100/80 leading-relaxed font-medium">
                Dữ liệu thành viên và cấu trúc phòng ban được bảo vệ đa lớp. Mọi thao tác thay đổi nhân sự hoặc định cấu hình sẽ được ghi lại trong nhật ký an ninh hệ thống dưới quyền quản trị viên cấp cao nhất.
              </p>
              
              <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-center">
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                   <span className="text-[10px] text-blue-400 font-black uppercase tracking-[0.3em]">Hệ thống bảo mật trực tuyến</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
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
