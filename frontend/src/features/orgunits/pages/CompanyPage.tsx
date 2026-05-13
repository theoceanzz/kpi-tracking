import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '../hooks/useOrganization'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useForm, useFieldArray } from 'react-hook-form'
import {  Edit3, ShieldCheck, 
  Calendar, Hash, Layers, Trash2,
  Info, ArrowUp, ArrowDown, Plus, Target, Sparkles, ChevronUp, RotateCcw, GitBranch
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatDateTime, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import PageTour from '@/components/common/PageTour'
import { companySteps } from '@/components/common/tourSteps'

export default function CompanyPage() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  
  const { data: org, isLoading: loadingOrg } = useOrganization(orgId)
  const updateMutation = useUpdateOrganization(orgId)
  const { refreshUser } = useAuth()

  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [infoFormData, setInfoFormData] = useState({ name: '', code: '' })
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

  if (loadingOrg) return <div className="p-8 max-w-7xl mx-auto"><LoadingSkeleton rows={10} /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4 md:px-0">
      <PageTour pageKey="company" steps={companySteps} />
      
      {/* Refined Hero Section with Vibrant Gradient */}
      <section id="tour-company-hero" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 border border-white/10 shadow-2xl shadow-indigo-500/20">
        {/* Subtle Ambient Background */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px] -ml-20 -mb-20" />
        
        <div className="relative z-10 p-8 md:p-10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
              <div className="relative group shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
                <div className="relative w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white text-3xl font-black shadow-xl border border-white/20">
                  {org?.name?.charAt(0)}
                </div>
              </div>
              
              <div className="space-y-3">
                {isEditingInfo ? (
                  <div className="space-y-4 max-w-md">
                    <input 
                      value={infoFormData.name}
                      onChange={e => setInfoFormData({ ...infoFormData, name: e.target.value })}
                      className="text-3xl font-bold bg-white/5 border-b border-indigo-500/50 text-white focus:outline-none w-full py-1 px-3 rounded-t-lg"
                      placeholder="Tên doanh nghiệp"
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                        <Hash size={14} className="text-slate-400" />
                        <input 
                          value={infoFormData.code}
                          onChange={e => setInfoFormData({ ...infoFormData, code: e.target.value })}
                          className="bg-transparent text-xs font-medium focus:outline-none w-24 text-slate-300"
                          placeholder="Mã DN"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider border border-white/10 mb-1">
                        Hệ thống
                      </div>
                      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                        {org?.name}
                      </h1>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-5">
                      <HeroStat icon={Hash} label="Mã DN" value={org?.code || 'N/A'} valueColor="text-white" />
                      <HeroStat icon={Calendar} label="Thành lập" value={(org?.createdAt ? formatDateTime(org.createdAt).split(' ')[0] : 'N/A') || 'N/A'} valueColor="text-white" />
                      <HeroStat icon={ShieldCheck} label="Trạng thái" value={org?.status === 'Active' ? 'Hoạt động' : (org?.status || 'Hoạt động')} valueColor="text-emerald-400" />
                      <HeroStat icon={Target} label="OKR" value={org?.enableOkr ? 'Đang bật' : 'Đang tắt'} valueColor={org?.enableOkr ? "text-amber-400" : "text-white/40"} />
                      <HeroStat icon={GitBranch} label="Waterfall" value={org?.enableWaterfall ? 'Đang bật' : 'Đang tắt'} valueColor={org?.enableWaterfall ? "text-cyan-400" : "text-white/40"} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 self-center lg:self-auto">
              {isEditingInfo ? (
                <>
                  <button 
                    onClick={() => setIsEditingInfo(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/5 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/10 border border-white/10 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={handleSaveInfo}
                    disabled={updateMutation.isPending}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Lưu
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleStartEditInfo}
                  className="px-6 py-3 bg-white text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wider shadow-xl transition-all hover:bg-slate-100 active:scale-95 flex items-center gap-2"
                >
                  <Edit3 size={14} /> 
                  <span>Chỉnh sửa</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {org && <div id="tour-company-scoring" className="h-full"><ScoringConfigSection org={org} /></div>}

        {/* Professional Hierarchy Section */}
        <section id="tour-company-hierarchy" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4 duration-700 delay-150">
           {/* ... existing hierarchy code ... */}
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

           <div className="p-8 flex-1 relative">
             {isEditingHierarchy ? (
               <form onSubmit={handleSubmit(onSaveHierarchy)} className="space-y-6">
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
               <div className="space-y-0 relative">
                  <div className="absolute left-[15px] top-6 bottom-6 w-px bg-slate-100 dark:bg-slate-800" />
                  {org?.hierarchyLevels?.map((level, idx) => (
                    <div key={level.id} className="relative pl-12 pb-8 last:pb-0 group">
                      <div className="absolute left-0 top-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 flex items-center justify-center z-10 shadow-sm transition-transform">
                        <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white text-[9px] font-black">
                          {idx + 1}
                        </div>
                      </div>
                      <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                        <div className="flex justify-between items-center">
                          <div className="space-y-0.5">
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cấp bậc</h4>
                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{level.unitTypeName}</p>
                            <div className="flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-fit">
                              <ShieldCheck size={12} className="text-indigo-500" />
                              <span className="text-[10px] font-medium text-slate-500">
                                {level.managerRoleLabel || (idx === (org.hierarchyLevels?.length || 0) - 1 ? 'Nhân viên' : 'N/A')}
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-300 dark:text-slate-700">
                            <ChevronUp className="rotate-90" size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
             )}
           </div>
        </section>

        {org && <OkrConfigSection org={org} />}
        {org && <WaterfallConfigSection org={org} />}
      </div>
    </div>
  )
}

function HeroStat({ icon: Icon, label, value, valueColor = "text-white/90" }: { icon: any; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white border border-white/10 transition-colors">
        <Icon size={14} />
      </div>
      <div className="flex flex-col text-left">
        <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">{label}</span>
        <span className={cn("text-[12px] font-bold", valueColor)}>{value}</span>
      </div>
    </div>
  )
}

function ScoringConfigSection({ org }: { org: any }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)
  const [maxScore, setMaxScore] = useState(org?.evaluationMaxScore || 100)

  const { register, control, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      evaluationLevels: (org?.evaluationLevels || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        threshold: l.threshold,
        color: l.color || '#10b981'
      }))
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "evaluationLevels"
  })

  const watchedLevels = watch("evaluationLevels")

  useEffect(() => {
    if (org?.evaluationLevels) {
      reset({
        evaluationLevels: org.evaluationLevels.map((l: any) => ({
          id: l.id,
          name: l.name,
          threshold: l.threshold,
          color: l.color || '#10b981'
        }))
      })
      setMaxScore(org.evaluationMaxScore || 100)
    }
  }, [org, reset])

  const handleSave = (data: any) => {
    // Validation
    if (maxScore <= 0) {
      toast.error('Thang điểm tối đa phải lớn hơn 0')
      return
    }

    const invalidLevel = data.evaluationLevels.find((l: any) => l.threshold > maxScore)
    if (invalidLevel) {
      toast.error(`Điểm mức "${invalidLevel.name}" không được vượt quá Thang điểm tối đa (${maxScore})`)
      return
    }

    updateMutation.mutate({ 
      evaluationMaxScore: maxScore,
      evaluationLevels: data.evaluationLevels.map((l: any) => ({
        name: l.name,
        threshold: Number(l.threshold),
        color: l.color
      }))
    }, {
      onSuccess: () => {
        setIsEditing(false)
        toast.success('Cập nhật thang điểm thành công')
      },
      onError: () => toast.error('Không thể cập nhật thang điểm')
    })
  }

  const handleResetToDefault = () => {
    const defaultLevels = [
      { name: 'XUẤT SẮC', threshold: 90, color: '#10b981' },
      { name: 'TỐT', threshold: 80, color: '#3b82f6' },
      { name: 'KHÁ', threshold: 70, color: '#f59e0b' },
      { name: 'TRUNG BÌNH', threshold: 50, color: '#6366f1' },
      { name: 'YẾU', threshold: 0, color: '#ef4444' },
    ]
    
    updateMutation.mutate({
      evaluationMaxScore: 100,
      evaluationLevels: defaultLevels
    }, {
      onSuccess: () => {
        setIsEditing(false)
        toast.success('Đã đặt lại về thang điểm mặc định thành công')
      },
      onError: () => toast.error('Không thể đặt lại thang điểm')
    })
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full animate-in slide-in-from-left-4 duration-700 delay-75">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Target size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Thang điểm</h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Tiêu chuẩn xếp loại</p>
                </div>
            </div>
            {!isEditing && (
              <div className="flex items-center gap-2">
                <button 
                    onClick={handleResetToDefault}
                    className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center group"
                    title="Đặt lại về mặc định"
                >
                    <RotateCcw size={16} />
                </button>
                <button 
                    onClick={() => setIsEditing(true)}
                    className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center group"
                >
                    <Edit3 size={16} />
                </button>
              </div>
            )}
        </div>

        <div className="p-8 space-y-8">
            <div className="relative p-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-700 text-white overflow-hidden shadow-xl shadow-indigo-500/10">
               <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
               <div className="flex justify-between items-center relative z-10">
                 <div className="space-y-0.5">
                   <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Hệ số tối đa</p>
                   <h4 className="text-xl font-black">Thang {maxScore} điểm</h4>
                 </div>
                 <div className="flex items-center">
                   {isEditing ? (
                     <input 
                        type="number"
                        value={maxScore}
                        onChange={e => setMaxScore(Number(e.target.value))}
                        className="w-20 bg-white/10 border border-white/10 rounded-lg py-2 px-2 text-center text-sm font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                     />
                   ) : (
                     <div className="px-4 py-2 bg-white/10 rounded-lg text-sm font-black border border-white/10">
                        {maxScore}
                     </div>
                   )}
                 </div>
               </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Các mức xếp loại</h4>
                  {isEditing && (
                    <button 
                      type="button"
                      onClick={() => append({ name: 'MỨC MỚI', threshold: 0, color: '#3b82f6' })}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Plus size={14} /> Thêm mức
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="group relative bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
                      <div className="flex items-center gap-4">
                        {isEditing ? (
                          <>
                            <div className="flex-1 space-y-1">
                               <label className="text-[9px] font-bold text-slate-400 uppercase">Tên mức</label>
                               <input 
                                 {...register(`evaluationLevels.${index}.name` as const)}
                                 className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-indigo-500"
                               />
                            </div>
                            <div className="w-24 space-y-1">
                               <label className="text-[9px] font-bold text-slate-400 uppercase">Điểm ≥</label>
                               <input 
                                 type="number"
                                 {...register(`evaluationLevels.${index}.threshold` as const)}
                                 className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-indigo-500"
                               />
                            </div>
                            <div className="w-16 space-y-1">
                               <label className="text-[9px] font-bold text-slate-400 uppercase">Màu</label>
                               <input 
                                 type="color"
                                 {...register(`evaluationLevels.${index}.color` as const)}
                                 className="w-full h-8 bg-transparent border-none outline-none cursor-pointer p-0"
                               />
                            </div>
                            <button 
                              type="button" 
                              onClick={() => remove(index)}
                              className="mt-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: watchedLevels[index]?.color || '#cbd5e1' }}>
                              <Sparkles size={18} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">{watchedLevels[index]?.name}</p>
                              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Xếp loại cho điểm ≥ {watchedLevels[index]?.threshold}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-black text-slate-900 dark:text-white">{watchedLevels[index]?.threshold}</span>
                              <span className="text-[10px] font-bold text-slate-400 ml-1">đ</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditing(false);
                    reset();
                  }} 
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="button" 
                  onClick={handleSubmit(handleSave)}
                  disabled={updateMutation.isPending}
                  className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Lưu cấu hình
                </button>
              </div>
            )}
        </div>
    </section>
  )
}

function OkrConfigSection({ org }: { org: any }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [enabled, setEnabled] = useState(org?.enableOkr || false)

  useEffect(() => {
    setEnabled(org?.enableOkr || false)
  }, [org])

  const handleToggle = () => {
    const newValue = !enabled
    setEnabled(newValue)
    updateMutation.mutate({ enableOkr: newValue }, {
      onSuccess: () => {
        toast.success(`Đã ${newValue ? 'bật' : 'tắt'} tính năng OKR`)
      },
      onError: () => {
        setEnabled(!newValue)
        toast.error('Không thể cập nhật cấu hình OKR')
      }
    })
  }

  return (
    <section id="tour-company-okr" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4 duration-700 delay-300">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <Target size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Cấu hình OKR</h3>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Mục tiêu & Kết quả then chốt</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={updateMutation.isPending}
          className={cn(
            "w-12 h-6 rounded-full relative transition-all duration-300",
            enabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
          )}
        >
          <div className={cn(
            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm",
            enabled ? "left-7" : "left-1"
          )} />
        </button>
      </div>

      <div className="p-8 space-y-6">
        <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30 flex items-start gap-3">
          <Info size={18} className="text-violet-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs text-violet-800 dark:text-violet-300 font-bold">Mô hình OKR & KPI kết hợp</p>
            <p className="text-[11px] text-violet-700/70 dark:text-violet-400/70 font-medium leading-relaxed">
              Khi bật tính năng này, bạn có thể thiết lập các Mục tiêu chiến lược (Objectives) và các Kết quả then chốt (Key Results). 
              KPI sẽ được liên kết trực tiếp với các Kết quả then chốt để đo lường tiến độ thực hiện mục tiêu.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-violet-600 shadow-sm font-black text-xs">1</div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Objective (Định tính)</p>
              <p className="text-[10px] text-slate-400 font-medium">Xác định các mục tiêu chiến lược của tổ chức.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-violet-600 shadow-sm font-black text-xs">2</div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Key Result (Định lượng)</p>
              <p className="text-[10px] text-slate-400 font-medium">Các chỉ số then chốt để đo lường việc hoàn thành Objective.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-violet-600 shadow-sm font-black text-xs">3</div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">KPI (Vận hành)</p>
              <p className="text-[10px] text-slate-400 font-medium">Liên kết KPI vào Key Result để theo dõi tự động hàng ngày.</p>
            </div>
          </div>
        </div>

        {enabled && (
           <Link 
            to="/okr" 
            className="w-full py-3 flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-slate-900/10 dark:shadow-white/5"
           >
             Đi đến quản lý OKR
           </Link>
        )}
      </div>
    </section>
  )
}

function WaterfallConfigSection({ org }: { org: any }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [enabled, setEnabled] = useState(org?.enableWaterfall || false)

  useEffect(() => {
    setEnabled(org?.enableWaterfall || false)
  }, [org])

  const handleToggle = () => {
    const newValue = !enabled
    setEnabled(newValue)
    updateMutation.mutate({ enableWaterfall: newValue }, {
      onSuccess: () => {
        toast.success(`Đã ${newValue ? 'bật' : 'tắt'} tính năng KPI Thác nước`)
      },
      onError: () => {
        setEnabled(!newValue)
        toast.error('Không thể cập nhật cấu hình Waterfall')
      }
    })
  }

  return (
    <section id="tour-company-waterfall" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4 duration-700 delay-500">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <GitBranch size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">KPI Thác nước</h3>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Phân rã & Cộng dồn chỉ tiêu</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={updateMutation.isPending}
          className={cn(
            "w-12 h-6 rounded-full relative transition-all duration-300",
            enabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
          )}
        >
          <div className={cn(
            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm",
            enabled ? "left-7" : "left-1"
          )} />
        </button>
      </div>

      <div className="p-8 space-y-6">
        <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-900/30 flex items-start gap-3">
          <Info size={18} className="text-cyan-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs text-cyan-800 dark:text-cyan-300 font-bold">Mô hình phân rã mục tiêu (Waterfall)</p>
            <p className="text-[11px] text-cyan-700/70 dark:text-cyan-400/70 font-medium leading-relaxed">
              Cho phép Trưởng đơn vị giao lại (Delegate) một phần hoặc toàn bộ chỉ tiêu của mình cho cấp dưới. 
              Kết quả của nhân viên sẽ tự động được cộng dồn (Roll-up) lên kết quả của cấp quản lý.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-cyan-600 shadow-sm font-black text-xs">1</div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Giao xuống (Delegate)</p>
              <p className="text-[10px] text-slate-400 font-medium">Trưởng đơn vị chia nhỏ 1 tỷ doanh số cho 3 nhân viên.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-cyan-600 shadow-sm font-black text-xs">2</div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Thực hiện (Staff)</p>
              <p className="text-[10px] text-slate-400 font-medium">Nhân viên nộp báo cáo kết quả thực hiện phần việc được giao.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-cyan-600 shadow-sm font-black text-xs">3</div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Cộng dồn (Roll-up)</p>
              <p className="text-[10px] text-slate-400 font-medium">Hệ thống tự tổng hợp kết quả nhân viên cho Trưởng đơn vị.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
