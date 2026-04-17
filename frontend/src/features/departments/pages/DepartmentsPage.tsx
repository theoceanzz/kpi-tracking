import { useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import DepartmentCard from '../components/DepartmentCard'
import DepartmentFormModal from '../components/DepartmentFormModal'
import { useDepartments } from '../hooks/useDepartments'
import { useOverviewStats } from '@/features/dashboard/hooks/useOverviewStats'
import { 
  Plus, 
  Search, 
  Users, 
  Building2, 
  ListFilter,
  ArrowUpRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DepartmentsPage() {
  const { data, isLoading: isDeptsLoading } = useDepartments()
  const { data: overviewData, isLoading: isStatsLoading } = useOverviewStats()
  const isLoading = isDeptsLoading || isStatsLoading
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  const departments = data?.content ?? []
  
  // Logic lọc tại client để tăng trải nghiệm UX mượt mà
  const filteredDepartments = departments.filter(dept => 
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) return <div className="p-8"><LoadingSkeleton rows={8} /></div>

  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-10 space-y-10 animate-in fade-in duration-700">
      
      {/* 1. Header & Quick Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest">
            <Building2 size={14} /> Tổ chức nhân sự
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Quản lý Phòng ban
          </h1>
          <p className="text-slate-500 font-medium max-w-md">
            Cấu trúc và tối ưu hóa sơ đồ tổ chức để quản lý chỉ tiêu KPI hiệu quả hơn.
          </p>
        </div>

        {/* Thống kê nhanh - Director Standard */}
        <div className="flex gap-4 sm:gap-6">
          <QuickStat 
            label="Tổng phòng" 
            value={departments.length} 
            icon={<Building2 size={20} />} 
            color="indigo" 
          />
          <QuickStat 
            label="Nhân sự" 
            value={overviewData?.totalUsers || 0} 
            icon={<Users size={20} />} 
            color="emerald" 
          />
        </div>
      </div>

      {/* 2. Toolbar: Search & Action */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-2 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Tìm kiếm tên phòng ban, mã phòng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-transparent border-none focus:ring-0 text-sm font-semibold outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto px-2">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
            <ListFilter size={18} /> Lọc
          </button>
          <button 
            onClick={() => setShowForm(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Plus size={18} /> <span className="hidden sm:inline">Tạo phòng ban</span>
          </button>
        </div>
      </div>

      {/* 3. Content Area */}
      {filteredDepartments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-dashed border-slate-300 dark:border-slate-800 p-20">
          <EmptyState 
            title={searchTerm ? "Không tìm thấy kết quả" : "Chưa có dữ liệu phòng ban"} 
            description={searchTerm ? `Không có phòng ban nào khớp với từ khóa "${searchTerm}"` : "Hãy bắt đầu xây dựng cơ cấu tổ chức bằng cách tạo phòng ban đầu tiên."} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filteredDepartments.map((dept, index) => (
            <div 
              key={dept.id} 
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <DepartmentCard department={dept} />
            </div>
          ))}
        </div>
      )}

      <DepartmentFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  )
}

/**
 * Component thống kê nhanh cho Header
 */
function QuickStat({ label, value, icon, color }: { label: string, value: number, icon: any, color: 'indigo' | 'emerald' }) {
  const colorMap = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
  }

  return (
    <div className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm min-w-[160px]">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", colorMap[color])}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-slate-900 dark:text-white">{value}</span>
          <ArrowUpRight size={14} className={cn(color === 'emerald' ? 'text-emerald-500' : 'text-indigo-500')} />
        </div>
      </div>
    </div>
  )
}