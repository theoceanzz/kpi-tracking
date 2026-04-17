import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { submissionSchema, type SubmissionFormData } from '../schemas/submissionSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import FileDropzone from '@/components/common/FileDropzone'
import { toast } from 'sonner'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatNumber } from '@/lib/utils'
import { 
  Loader2, FileText, Target, Activity, Calendar, 
  MessageSquare, Paperclip, ChevronLeft, Send, Sparkles, Lightbulb
} from 'lucide-react'

export default function NewSubmissionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedKpiId = searchParams.get('kpiId') ?? ''
  const qc = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const { data: myKpiData } = useMyKpi(0, 100)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { kpiCriteriaId: preselectedKpiId },
  })

  // Watch the selected KPI to show tips
  const selectedKpiId = watch('kpiCriteriaId')
  const selectedKpi = myKpiData?.content?.find(k => k.id === selectedKpiId)

  const createMutation = useMutation({
    mutationFn: async (data: SubmissionFormData) => {
      // Format dates to ISO-8601 for the backend (Instant)
      const formattedData = {
        ...data,
        periodStart: data.periodStart ? new Date(data.periodStart).toISOString() : undefined,
        periodEnd: data.periodEnd ? new Date(data.periodEnd).toISOString() : undefined,
      }
      
      const sub = await submissionApi.create(formattedData as any)
      if (files.length > 0) {
        await submissionApi.uploadAttachments(sub.id, files)
      }
      return sub
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['my-kpi-progress'] })
      toast.success('Gửi báo cáo thành công!')
      navigate('/submissions')
    },
    onError: () => toast.error('Nộp báo cáo thất bại'),
  })

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Top Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-4">
          <button 
            type="button" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Quay lại
          </button>
          
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest mb-3">
              <FileText size={14} /> Nộp kết quả
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              Báo cáo Chỉ tiêu KPI
            </h1>
            <p className="text-slate-500 font-medium max-w-lg mt-2">
              Khai báo trung thực kết quả bạn đã đạt được. Thông tin này sẽ được xét duyệt bởi quản lý trực tiếp.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form Area */}
        <div className="lg:col-span-8">
          <form 
            onSubmit={handleSubmit((data) => createMutation.mutate(data))} 
            className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            {/* Form Section 1: Core Selection */}
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 space-y-6">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                <Target size={20} />
                <h3 className="text-lg font-black">Thông tin Chỉ tiêu</h3>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Lựa chọn KPI cần báo cáo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select 
                    {...register('kpiCriteriaId')} 
                    className="w-full pl-4 pr-10 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 appearance-none transition-all cursor-pointer"
                  >
                    <option value="" disabled>-- Hãy chọn một KPI bạn đã được giao --</option>
                    {myKpiData?.content?.filter(k => k.status === 'APPROVED').map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} {k.targetValue != null ? `(Mục tiêu: ${formatNumber(k.targetValue)} ${k.unit ?? ''})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                    <ChevronLeft size={16} className="-rotate-90" />
                  </div>
                </div>
                {errors.kpiCriteriaId && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.kpiCriteriaId.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Trị số thực tế đã đạt <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                    <Activity size={18} />
                  </div>
                  <input 
                    {...register('actualValue', { valueAsNumber: true })} 
                    type="number" 
                    step="any" 
                    className="w-full pl-11 pr-16 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 border-l-4 border-l-indigo-500 text-base font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all placeholder:font-normal placeholder:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                    placeholder="Nhập giá trị bằng số..." 
                  />
                  {selectedKpi?.unit && (
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-indigo-500">
                      {selectedKpi.unit}
                    </div>
                  )}
                </div>
                {errors.actualValue && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.actualValue.message}</p>}
              </div>
            </div>

            {/* Form Section 2: Details */}
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 space-y-6 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">
                <Calendar size={20} />
                <h3 className="text-lg font-black">Chu kỳ Ghi nhận</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Từ ngày</label>
                  <input 
                    {...register('periodStart')} 
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Đến ngày</label>
                  <input 
                    {...register('periodEnd')} 
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" 
                  />
                </div>
              </div>
            </div>

            {/* Form Section 3: Evidence */}
            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <MessageSquare size={16} className="text-indigo-500" /> Báo cáo giải trình/Ghi chú
                </label>
                <textarea 
                  {...register('note')} 
                  rows={4} 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none transition-all" 
                  placeholder="Mô tả cụ thể cách thức bạn đạt được kết quả này, nguyên nhân vượt hoặc không đạt chỉ tiêu..." 
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <Paperclip size={16} className="text-indigo-500" /> Tài liệu Chứng minh (Minh chứng)
                </label>
                <div className="bg-white dark:bg-slate-900 rounded-xl">
                  <FileDropzone
                    onFilesSelected={(acc) => setFiles(prev => [...prev, ...acc])}
                    files={files}
                    onRemove={(idx) => setFiles(files.filter((_, j) => j !== idx))}
                  />
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-6 sm:p-8 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col-reverse sm:flex-row gap-3">
              <button 
                type="button" 
                onClick={() => navigate(-1)} 
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={createMutation.isPending} 
                className="w-full sm:flex-1 px-6 py-3.5 rounded-xl text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 md:text-base group"
              >
                {createMutation.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                )}
                Gửi Báo cáo cho Quản lý
              </button>
            </div>
          </form>
        </div>

        {/* Right Info Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          
          {selectedKpi ? (
            <div className="bg-indigo-600 rounded-[28px] p-6 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-600/20 h-full flex flex-col">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Target size={120} />
              </div>
              
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white mb-6 shadow-inner">
                  <Sparkles size={24} />
                </div>
                
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">Đang thiết lập báo cáo cho</h4>
                <p className="text-2xl font-black leading-tight mb-6">{selectedKpi.name}</p>
                
                <div className="mt-auto space-y-4">
                  <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <p className="text-xs font-bold text-indigo-200 mb-1">Mục tiêu tối thiểu</p>
                    <p className="text-3xl font-black">
                      {selectedKpi.targetValue != null ? formatNumber(selectedKpi.targetValue) : 'Không có'}
                      <span className="text-base font-bold ml-1 text-indigo-200">{selectedKpi.unit ?? ''}</span>
                    </p>
                  </div>
                  
                  <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <p className="text-xs font-bold text-indigo-200 mb-1">Trọng số KPI</p>
                    <p className="text-lg font-black">{selectedKpi.weight != null ? `${selectedKpi.weight}%` : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[28px] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center mb-4">
                <Lightbulb size={28} />
              </div>
              <h4 className="font-black text-slate-900 dark:text-white mb-2">Mẹo nộp báo cáo</h4>
              <p className="text-sm text-slate-500 leading-relaxed max-w-[250px]">
                Hãy chọn một KPI để xem chi tiết mục tiêu cần đạt. Đừng quên đính kèm hình ảnh hoặc tài liệu để làm minh chứng.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
