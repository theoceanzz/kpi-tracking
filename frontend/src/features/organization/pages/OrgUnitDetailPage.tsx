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
  Edit2
} from 'lucide-react'
import { useOrgUnit, useOrgUnitSubtree, useOrgHierarchyLevels } from '../hooks/useOrganizationStructure'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { MemberManagement } from '../components/MemberManagement'
import { SubUnitList } from '../components/SubUnitList'
import { OrgUnitDrawer, DrawerState } from '../components/OrgUnitDrawer'

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

  // Custom navigation handler to match user's preference
  const backToStructure = () => navigate('/org-structure')

  const { data: unit, isLoading, error } = useOrgUnit(orgId, id)
  const { data: subtree = [] } = useOrgUnitSubtree(orgId, id)
  const { data: hierarchyLevels = [] } = useOrgHierarchyLevels(orgId)

  // Map hierarchy levels to Record<number, string> for the drawer
  const levelsMap = hierarchyLevels.reduce((acc, level) => {
    acc[level.levelOrder] = level.unitTypeName
    return acc
  }, {} as Record<number, string>)

  // Subtree is a list where the first element is the unit itself
  // We want the children of the unit itself
  const subUnits = subtree[0]?.children || []

  const handleEditUnit = () => {
    if (!unit) return
    setDrawerState({
      isOpen: true,
      mode: 'edit',
      parentNode: null, // Edit mode handles parent logic internally or doesn't need it
      currentNode: unit
    })
  }

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Đang tải thông tin đơn vị...</p>
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl shadow-sm border max-w-2xl mx-auto mt-12">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Không tìm thấy thông tin</h2>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">Đơn vị tổ chức này không tồn tại hoặc bạn không có quyền truy cập.</p>
        <button 
          onClick={backToStructure}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-200"
        >
          Quay lại danh sách
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 px-4 md:px-0">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white hover:bg-gray-50 border border-gray-100 rounded-2xl transition-all text-gray-400 hover:text-blue-600 hover:scale-105 active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={backToStructure}>
                Cấu trúc tổ chức
              </span>
              <ChevronRight className="w-3 h-3 mx-2 text-gray-300" />
              <span className="text-blue-600 truncate max-w-[200px] md:max-w-none">{unit.name}</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 leading-none">Thông tin chi tiết</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={handleEditUnit}
            className="px-6 py-3 bg-white text-blue-600 border border-blue-100 rounded-2xl hover:bg-blue-50 font-bold transition-all shadow-sm flex items-center justify-center group"
          >
            <Edit2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            Chỉnh sửa
          </button>
          <button 
            onClick={backToStructure}
            className="px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-2xl hover:bg-gray-50 font-bold transition-all shadow-sm flex items-center justify-center"
          >
            <Layers className="w-4 h-4 mr-2 text-blue-500" />
            Trở về sơ đồ
          </button>
        </div>
      </div>

      {/* Hero Header Section */}
      <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-white overflow-hidden">
        <div className="h-40 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative">
          <div className="absolute top-6 right-8 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
             <p className="text-white text-xs font-bold flex items-center">
               <Globe className="w-3.5 h-3.5 mr-2" />
               Hệ thống quản trị nội bộ
             </p>
          </div>
          <div className="absolute -bottom-16 left-10 p-1.5 bg-white rounded-3xl shadow-2xl border border-gray-50">
            <div className="w-32 h-32 rounded-[1.25rem] bg-gray-50 flex items-center justify-center overflow-hidden">
              {unit.logoUrl ? (
                <img src={unit.logoUrl} alt={unit.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center">
                  <Building2 className="w-12 h-12 text-blue-200" />
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="pt-20 pb-10 px-10 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">{unit.name}</h1>
              <div className="flex items-center px-4 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black rounded-full uppercase tracking-[0.2em] ring-1 ring-blue-700/10">
                {unit.type}
              </div>
            </div>
            <p className="text-gray-500 flex items-center font-medium">
              <ShieldCheck className="w-4 h-4 mr-2 text-green-500" />
              Thành phần cấp {unit.level} • 
              <span className={`ml-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${unit.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {unit.status === 'active' ? 'HOẠT ĐỘNG' : 'TẠM NGƯNG'}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Contact & Bio */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[2rem] shadow-sm border p-10">
            <h2 className="text-xl font-black text-gray-900 mb-10 flex items-center">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full mr-3" />
              Thông tin hành chính
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="group flex items-start space-x-5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                    <Mail className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Email liên hệ</p>
                    <p className="text-gray-900 font-extrabold text-lg break-all">{unit.email || 'Chưa cập nhật'}</p>
                  </div>
                </div>

                <div className="group flex items-start space-x-5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                    <Phone className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Số điện thoại</p>
                    <p className="text-gray-900 font-extrabold text-lg">{unit.phone || 'Chưa cập nhật'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="group flex items-start space-x-5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                    <MapPin className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Trụ sở / Địa chỉ</p>
                    <p className="text-gray-900 font-extrabold text-lg leading-snug">
                      {unit.address ? `${unit.address}, ` : ''}
                      {unit.districtName ? `${unit.districtName}, ` : ''}
                      {unit.provinceName || 'Chưa cập nhật'}
                    </p>
                  </div>
                </div>

                <div className="group flex items-start space-x-5">
                   <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                    <Building2 className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Loại thành phần</p>
                    <p className="text-gray-900 font-extrabold text-lg">{unit.type}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <MemberManagement orgUnitId={id || ''} />

          <SubUnitList units={subUnits} />
        </div>

        {/* Sidebar info */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-[2rem] shadow-sm border p-8">
            <h3 className="text-xs font-black text-gray-900 mb-6 uppercase tracking-[0.2em] border-b pb-4 border-gray-50 flex items-center justify-between">
              Nhật ký hệ thống
              <Calendar className="w-4 h-4 text-blue-600" />
            </h3>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter mb-0.5">Thời điểm khởi tạo</p>
                  <p className="text-gray-900 font-extrabold text-sm">
                    {format(new Date(unit.createdAt), 'dd/MM/yyyy', { locale: vi })}
                  </p>
                  <p className="text-[10px] text-gray-500 font-medium">Lúc {format(new Date(unit.createdAt), 'HH:mm')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-2 h-2 rounded-full bg-gray-200 mt-2 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter mb-0.5">Cập nhật gần nhất</p>
                  <p className="text-gray-900 font-extrabold text-sm">
                    {format(new Date(unit.updatedAt), 'dd/MM/yyyy', { locale: vi })}
                  </p>
                  <p className="text-[10px] text-gray-500 font-medium">Lúc {format(new Date(unit.updatedAt), 'HH:mm')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-[2.25rem] p-1 shadow-xl">
            <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-blue-300" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Chế độ bảo mật</h3>
              </div>
              <p className="text-sm text-blue-100 leading-relaxed font-medium">
                Dữ liệu thuộc quyền quản trị của **Director**. Các thao tác thêm, gán vai trò nhân sự sẽ được ghi lại trong nhật ký bảo mật của tổ chức.
              </p>
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-[10px] text-blue-300 font-black uppercase tracking-widest text-center">Bảo mật đa lớp định danh</p>
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
          maxDepth={5} 
          hierarchyLevels={levelsMap} 
        />
      )}
    </div>
  )
}
