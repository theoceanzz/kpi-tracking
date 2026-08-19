import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '../hooks/useOrganization'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useForm, useFieldArray } from 'react-hook-form'
import {  Edit3, ShieldCheck,
  Calendar, Hash, Layers, Trash2,
  Info, ArrowUp, ArrowDown, Plus, Target, GitBranch, SlidersHorizontal, LayoutGrid, Gift, Wallet, Building2
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatDateTime, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'

/**
 * Hai khối của trang Công ty, tách thành component riêng để trang "Thiết lập công ty"
 * gắn chúng vào hai mục khác nhau của menu bên trong trang. Nội dung giữ nguyên như
 * khi còn nằm chung trong CompanyPage.
 */

/* ========== THÔNG TIN CÔNG TY ========== */
export function CompanyInfoSection() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading } = useOrganization(orgId)
  const updateMutation = useUpdateOrganization(orgId)
  const { refreshUser } = useAuth()

  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [infoFormData, setInfoFormData] = useState({ name: '', code: '' })

  const handleStartEditInfo = () => {
    if (org) {
      setInfoFormData({ name: org.name, code: org.code })
      setIsEditingInfo(true)
    }
  }

  const handleSaveInfo = () => {
    updateMutation.mutate({ name: infoFormData.name, code: infoFormData.code }, {
      onSuccess: () => {
        setIsEditingInfo(false)
        refreshUser()
        toast.success('Cập nhật thông tin doanh nghiệp thành công')
      },
      onError: () => toast.error('Không thể cập nhật thông tin')
    })
  }

  if (isLoading) return <LoadingSkeleton rows={6} />

  return (
    // Cùng khuôn thẻ với mục "Cấp bậc": hai mục này giờ là hai tab ngang hàng trong
    // cùng một trang, nên phải trông như anh em. Banner tím tràn viền trước đây là
    // header của cả trang — giữ lại thì một tab là biển quảng cáo, tab kia là bảng dữ liệu.
    <section id="tour-company-hero" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Hồ sơ doanh nghiệp</h3>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Định danh và tính năng đang bật</p>
          </div>
        </div>

        {isEditingInfo ? (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setIsEditingInfo(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Hủy
            </button>
            <button
              onClick={handleSaveInfo}
              disabled={updateMutation.isPending}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
            >
              Lưu
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEditInfo}
            className="w-9 h-9 shrink-0 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center"
            title="Chỉnh sửa thông tin"
          >
            <Edit3 size={16} />
          </button>
        )}
      </div>

      <div className="p-8 space-y-8">
        {/* Khối định danh */}
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/20">
            {org?.name?.charAt(0)}
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            {isEditingInfo ? (
              <div className="space-y-3 max-w-md">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên doanh nghiệp</label>
                  <input
                    value={infoFormData.name}
                    onChange={e => setInfoFormData({ ...infoFormData, name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-sm font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                    placeholder="Tên doanh nghiệp"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã doanh nghiệp</label>
                  <input
                    value={infoFormData.code}
                    onChange={e => setInfoFormData({ ...infoFormData, code: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                    placeholder="Mã DN"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                  {org?.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                  <InfoStat icon={Hash} label="Mã DN" value={org?.code || 'N/A'} />
                  <InfoStat icon={Calendar} label="Thành lập" value={(org?.createdAt ? formatDateTime(org.createdAt).split(' ')[0] : 'N/A') || 'N/A'} />
                  <InfoStat
                    icon={ShieldCheck}
                    label="Trạng thái"
                    value={org?.status === 'Active' ? 'Hoạt động' : (org?.status || 'Hoạt động')}
                    valueColor="text-emerald-600 dark:text-emerald-400"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cờ tính năng — tách bằng đường kẻ vì đây là trạng thái BẬT/TẮT, khác loại
            với thông tin định danh ở trên. Bấm để sang trang bật/tắt tương ứng. */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tính năng</h4>
            <Link
              to="/settings/tools?section=modules"
              className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Bật / tắt →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <FeatureChip icon={SlidersHorizontal} label="KPI hành vi" enabled={org?.enableQualitative} />
            <FeatureChip icon={LayoutGrid} label="BSC" enabled={org?.enableBsc} />
            <FeatureChip icon={Target} label="OKR" enabled={org?.enableOkr} />
            <FeatureChip icon={GitBranch} label="Waterfall" enabled={org?.enableWaterfall} />
            <FeatureChip icon={Gift} label="Thưởng điểm" enabled={org?.enableReward} />
            <FeatureChip icon={Wallet} label="Ví tiền" enabled={org?.enableCashWallet} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ========== CẤP BẬC ========== */
export function CompanyHierarchySection() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading } = useOrganization(orgId)
  const updateMutation = useUpdateOrganization(orgId)
  const { refreshUser } = useAuth()

  const [isEditingHierarchy, setIsEditingHierarchy] = useState(false)

  const { register, control, handleSubmit, reset } = useForm({
    defaultValues: {
      hierarchyLevels: [] as { id?: string; unitTypeName: string; managerRoleLabel: string }[]
    }
  })

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "hierarchyLevels"
  })

  useEffect(() => {
    if (org?.hierarchyLevels) {
      reset({
        hierarchyLevels: org.hierarchyLevels.map(l => ({
          id: l.id,
          unitTypeName: l.unitTypeName,
          managerRoleLabel: l.managerRoleLabel || ''
        }))
      })
    }
  }, [org, reset])

  const onSaveHierarchy = (data: any) => {
    if (data.hierarchyLevels.length < 2) {
      toast.error('Cơ cấu tổ chức phải có ít nhất 2 cấp.')
      return
    }
    updateMutation.mutate({ hierarchyLevels: data.hierarchyLevels }, {
      onSuccess: () => {
        setIsEditingHierarchy(false)
        refreshUser()
        toast.success('Cập nhật cơ cấu tổ chức thành công')
      },
      onError: (error: any) => {
        const msg = error?.response?.data?.message || 'Có lỗi xảy ra'
        toast.error(msg)
      }
    })
  }

  if (isLoading) return <LoadingSkeleton rows={8} />

  return (
    <section id="tour-company-hierarchy" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
       <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Cấu trúc Cấp bậc</h3>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Sơ đồ phân cấp quản lý</p>
            </div>
          </div>
          {!isEditingHierarchy && (
            <button
              onClick={() => setIsEditingHierarchy(true)}
              className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center group"
            >
              <Edit3 size={16} />
            </button>
          )}
       </div>

       <div className="p-8 relative">
         {isEditingHierarchy ? (
           // Cùng bề ngang với chế độ xem, để bấm "sửa" không làm cả khối nhảy rộng ra.
           <form onSubmit={handleSubmit(onSaveHierarchy)} className="max-w-2xl space-y-6">
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl text-amber-700 dark:text-amber-400 text-[11px] font-medium leading-relaxed">
                <Info size={16} className="shrink-0 mt-0.5" />
                Việc thay đổi cấu trúc ảnh hưởng đến danh mục đơn vị hiện có.
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="relative animate-in slide-in-from-right-2 duration-300">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-600/20 shrink-0">
                          {index + 1}
                        </div>
                        {index < fields.length - 1 && <div className="w-0.5 h-full bg-slate-100 dark:bg-slate-800 my-1" />}
                      </div>

                      <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all group-hover:border-indigo-300 dark:group-hover:border-indigo-800">
                         <input type="hidden" {...register(`hierarchyLevels.${index}.id` as const)} />
                         <div className="flex flex-col sm:flex-row items-center gap-4">
                           <div className="flex-1 w-full space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn vị</label>
                             <input
                               {...register(`hierarchyLevels.${index}.unitTypeName` as const, { required: true })}
                               className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-sm font-bold text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                               placeholder="VD: Chi nhánh"
                              />
                           </div>
                           <div className="flex-1 w-full space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Chức danh quản lý</label>
                             <input
                               {...register(`hierarchyLevels.${index}.managerRoleLabel` as const)}
                               className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                               placeholder="VD: Giám đốc"
                              />
                           </div>
                         </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                         <button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 disabled:opacity-20"><ArrowUp size={14} /></button>
                         <button type="button" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 disabled:opacity-20"><ArrowDown size={14} /></button>
                         {fields.length > 2 && (
                           <button type="button" onClick={() => remove(index)} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors"><Trash2 size={14} /></button>
                         )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => append({ unitTypeName: '', managerRoleLabel: '' })}
                className="w-full py-4 flex items-center justify-center gap-2 border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-600 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all"
              >
                <Plus size={16} /> Thêm cấp bậc
              </button>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsEditingHierarchy(false); reset() }} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Hủy</button>
                <button type="submit" className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg hover:bg-indigo-700 transition-all">Lưu</button>
              </div>
           </form>
         ) : (
           // Danh sách cấp bậc là một cái thang: mỗi bậc chỉ có tên đơn vị và chức danh.
           // Ràng bề ngang lại thay vì để tràn 1500px — trước đó mỗi bậc là một thẻ cao
           // 170px với chức danh nằm cách tên cả nghìn pixel, đọc thành ba khối rời rạc
           // thay vì một thang liền mạch.
           <div className="max-w-2xl relative">
              <div className="absolute left-[15px] top-5 bottom-5 w-px bg-slate-200 dark:bg-slate-800" />
              {org?.hierarchyLevels?.map((level, idx) => (
                <div key={level.id} className="relative pl-12 py-1.5 group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center z-10">
                    <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black shadow-sm shadow-indigo-600/30">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-800 transition-all">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{level.unitTypeName}</span>
                    <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <ShieldCheck size={12} className="text-indigo-500 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {level.managerRoleLabel || (idx === (org.hierarchyLevels?.length || 0) - 1 ? 'Nhân viên' : 'Chưa đặt')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
           </div>
         )}
       </div>
    </section>
  )
}

function InfoStat({ icon: Icon, label, value, valueColor = 'text-slate-900 dark:text-white' }: { icon: any; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
      <div className="w-8 h-8 shrink-0 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700">
        <Icon size={14} />
      </div>
      <div className="flex flex-col text-left min-w-0">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <span className={cn('text-[13px] font-bold truncate', valueColor)}>{value}</span>
      </div>
    </div>
  )
}

// Cờ tính năng là trạng thái BẬT/TẮT, không phải thông tin như InfoStat — nên dùng dạng
// viên thuốc có chấm sáng, để mắt phân biệt ngay hai khối trong thẻ.
function FeatureChip({ icon: Icon, label, enabled }: { icon: any; label: string; enabled?: boolean }) {
  return (
    <div
      title={`${label}: ${enabled ? 'Đang bật' : 'Đang tắt'}`}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors',
        enabled
          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/40'
          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
      )}
    >
      <Icon size={13} className={enabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'} />
      <span className={cn(
        'text-[10px] font-black uppercase tracking-widest whitespace-nowrap',
        enabled ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-600'
      )}>
        {label}
      </span>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0',
        enabled ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-slate-300 dark:bg-slate-700'
      )} />
    </div>
  )
}
