import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { formatDateTime, formatNumber, downloadFile, cn } from '@/lib/utils'
import { 
  ArrowLeft, Target, CheckCircle2, Calendar, User, FileText, 
  MessageSquare, Trophy, History, Download, Eye, File, Star,
  ShieldCheck, LayoutDashboard, Pencil, Plus, Clock
} from 'lucide-react'
import { useState } from 'react'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeAttachment, setActiveAttachment] = useState<any | null>(null)

  const { data: submission, isLoading } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => submissionApi.getById(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="p-8"><LoadingSkeleton type="form" rows={8} /></div>
  
  if (!submission) return (
    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-[30px] flex items-center justify-center mb-6">
        <FileText className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Không tìm thấy bài nộp</h2>
      <p className="text-slate-500 mb-8">Dữ liệu bài nộp này có thể đã bị xóa hoặc không tồn tại.</p>
      <button 
        type="button" 
        onClick={() => navigate('/submissions')} 
        className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
      >
        QUAY LẠI DANH SÁCH
      </button>
    </div>
  )

  const achievement = submission.targetValue 
    ? Math.round((submission.actualValue / submission.targetValue) * 100) 
    : null

  const getAchievementColor = (val: number): 'emerald' | 'amber' | 'rose' | 'slate' => {
    if (val >= 100) return 'emerald'
    if (val >= 70) return 'amber'
    return 'rose'
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header with Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <button 
            type="button"
            onClick={() => navigate(-1)}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all group shadow-sm active:scale-90"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <StatusBadge status={submission.status} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {submission.kpiCriteriaName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {submission.status === 'DRAFT' && (
            <Link 
              to={`/submissions/edit/${submission.id}`}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Pencil size={16} /> CHỈNH SỬA
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Content (Left) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricBox 
              icon={CheckCircle2} 
              label="Thực tế" 
              value={formatNumber(submission.actualValue)} 
              unit={submission.unit}
              color="indigo"
            />
            <MetricBox 
              icon={Target} 
              label="Mục tiêu" 
              value={submission.targetValue != null ? formatNumber(submission.targetValue) : '—'} 
              unit={submission.unit}
              color="slate"
            />
            <MetricBox 
              icon={Trophy} 
              label="Tỷ lệ đạt" 
              value={achievement != null ? `${achievement}%` : '—'} 
              color={achievement != null ? getAchievementColor(achievement) : 'slate'}
              isBoldValue
            />
          </div>

          {/* Auto Score Banner */}
          {submission.autoScore != null && (
            <div className="relative group p-1 rounded-[32px] bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 shadow-2xl shadow-indigo-500/20 overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
               <div className="relative bg-black/5 dark:bg-black/20 p-8 md:p-10 rounded-[31px] flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-3">
                     <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-[0.2em]">
                        <Star size={12} className="fill-current text-amber-300" /> Hệ thống tính điểm
                     </div>
                     <h3 className="text-3xl font-black text-white">Điểm hệ thống: {formatNumber(submission.autoScore)}</h3>
                     <p className="text-indigo-100/70 text-sm font-medium max-w-md leading-relaxed">
                        Kết quả được tự động hóa dựa trên Trọng số của KPI ({submission.weight || 0}%) và Tỷ lệ hoàn thành thực tế.
                     </p>
                  </div>
                  <div className="flex items-center gap-6 bg-white/10 backdrop-blur-2xl p-6 rounded-[28px] border border-white/10 shadow-inner group-hover:scale-105 transition-transform duration-500">
                     <div className="text-center">
                        <p className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.3em] mb-1 opacity-60">SCORE</p>
                        <p className="text-6xl font-black text-white leading-none">{formatNumber(submission.autoScore)}</p>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* Attachments & Evidence */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Bằng chứng thực hiện</h3>
              </div>
              <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-full text-[11px] font-black text-slate-500 uppercase tracking-widest border border-slate-100 dark:border-slate-700">
                {submission.attachments?.length || 0} FILE ĐÍNH KÈM
              </div>
            </div>

            {submission.attachments?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {submission.attachments.map((file: any) => {
                  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.fileName)
                  return (
                    <div 
                      key={file.id} 
                      className="group relative bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all cursor-pointer aspect-square"
                      onClick={() => setActiveAttachment(file)}
                    >
                      {isImage ? (
                        <div className="w-full h-full">
                          <img 
                            src={file.fileUrl} 
                            alt={file.fileName} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                          />
                          <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <span className="w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"><Eye size={20} /></span>
                            <button 
                              type="button" 
                              onClick={(e) => { e.stopPropagation(); downloadFile(file.fileUrl, file.fileName) }} 
                              className="w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"
                            >
                              <Download size={20} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 space-y-3">
                           <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                              <File className="w-8 h-8 text-indigo-500" />
                           </div>
                           <p className="text-[11px] font-black text-slate-500 text-center truncate w-full uppercase tracking-tighter">{file.fileName}</p>
                           
                           <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <span className="w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"><Eye size={20} /></span>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); downloadFile(file.fileUrl, file.fileName) }} 
                                className="w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"
                              >
                                <Download size={20} />
                              </button>
                           </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-800/30 rounded-[32px] border-2 border-dashed border-slate-100 dark:border-slate-800">
                <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl shadow-sm mb-4">
                  <FileText size={32} className="text-slate-200" />
                </div>
                <p className="text-slate-400 font-bold text-sm">Không có tài liệu chứng minh được đính kèm</p>
              </div>
            )}
          </div>

          {/* Notes & Reviews */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
               <div className="flex items-center gap-3 text-slate-900 dark:text-white mb-2">
                 <MessageSquare className="w-5 h-5 text-indigo-500" />
                 <h4 className="font-black text-sm uppercase tracking-widest">Nội dung giải trình</h4>
               </div>
               <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap min-h-[100px]">
                 {submission.note || "Người nộp không để lại ghi chú giải trình."}
               </p>
            </div>

            <div className={cn(
              "rounded-[32px] p-8 border shadow-sm space-y-4 transition-all",
              submission.status === 'APPROVED' ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30" : 
              submission.status === 'REJECTED' ? "bg-rose-50/50 border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/30" :
              "bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800"
            )}>
               <div className="flex items-center gap-3 mb-2">
                 <History className={cn("w-5 h-5", 
                   submission.status === 'APPROVED' ? "text-emerald-500" : 
                   submission.status === 'REJECTED' ? "text-rose-500" : "text-slate-400"
                 )} />
                 <h4 className="font-black text-sm uppercase tracking-widest text-slate-900 dark:text-white">Phản hồi từ quản lý</h4>
               </div>
               <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed italic min-h-[100px]">
                 {submission.reviewNote ? `"${submission.reviewNote}"` : "Chưa có phản hồi hoặc nhận xét từ người phê duyệt."}
               </p>
            </div>
          </div>
        </div>

        {/* Info Sidebar (Right) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm p-8 space-y-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-indigo-600" /> Thông tin phê duyệt
            </h3>
            
            <div className="space-y-6">
              <SidebarItem label="Người nộp" value={submission.submittedByName} icon={User} color="indigo" />
              <SidebarItem label="Thời gian nộp" value={formatDateTime(submission.createdAt)} icon={Calendar} color="indigo" />
              
              <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2" />
              
              {submission.reviewedByName ? (
                <>
                  <SidebarItem label="Người phê duyệt" value={submission.reviewedByName} icon={ShieldCheck} color="emerald" />
                  <SidebarItem label="Thời gian duyệt" value={formatDateTime(submission.reviewedAt || '')} icon={Calendar} color="emerald" />
                </>
              ) : submission.status === 'PENDING' ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
                    <Clock size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Đang chờ xử lý</span>
                  </div>
                  <p className="text-xs font-medium text-amber-600/80 mt-1">Bài nộp đang đợi quản lý trực tiếp xem xét và phê duyệt.</p>
                </div>
              ) : null}

              {submission.kpiPeriod && (
                <div className="pt-2">
                   <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Chu kỳ báo cáo</p>
                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-300">{submission.kpiPeriod.name}</p>
                    <p className="text-[10px] font-medium text-indigo-400 mt-1">
                      {formatDateTime(submission.periodStart || '').split(' ')[0]} - {formatDateTime(submission.periodEnd || '').split(' ')[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 dark:bg-white rounded-[32px] p-8 text-white dark:text-slate-900 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 dark:bg-black/5 rounded-full blur-3xl transition-all duration-1000 group-hover:scale-150" />
             <div className="relative z-10 space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-white/10 dark:bg-slate-100 flex items-center justify-center shadow-lg">
                   <LayoutDashboard size={24} className="text-white dark:text-indigo-600" />
                </div>
                <div>
                   <h4 className="text-2xl font-black tracking-tight">Hành động nhanh</h4>
                   <p className="text-xs font-medium opacity-60 mt-1">Lựa chọn các tác vụ tiếp theo cho kết quả KPI này.</p>
                </div>
                <div className="space-y-3">
                   <Link 
                    to="/submissions/new"
                    className="w-full flex items-center justify-center gap-2 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all active:scale-95 shadow-xl"
                   >
                     <Plus size={16} /> Báo cáo mới
                   </Link>
                   <Link 
                    to="/my-kpi"
                    className="w-full flex items-center justify-center gap-2 py-4 bg-white/10 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/20 dark:hover:bg-slate-200 transition-all active:scale-95 border border-white/10 dark:border-slate-200"
                   >
                     QUAY LẠI MỤC TIÊU
                   </Link>
                </div>
             </div>
          </div>
        </div>
      </div>

      <MediaPreviewModal 
        isOpen={!!activeAttachment} 
        onClose={() => setActiveAttachment(null)} 
        url={activeAttachment?.fileUrl || ''} 
        fileName={activeAttachment?.fileName || ''}
        contentType={activeAttachment?.contentType}
      />
    </div>
  )
}

function MetricBox({ icon: Icon, label, value, unit, color, isBoldValue }: { icon: any; label: string; value: string; unit?: string | null; color: string; isBoldValue?: boolean }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30",
    emerald: "text-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30",
    amber: "text-amber-600 bg-amber-50/50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30",
    rose: "text-rose-600 bg-rose-50/50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30",
    slate: "text-slate-600 bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800",
  }
  return (
    <div className={cn("p-8 rounded-[32px] border shadow-sm relative group overflow-hidden transition-all hover:shadow-lg", colors[color])}>
      <Icon className="absolute top-4 right-4 w-12 h-12 opacity-5 group-hover:scale-110 transition-transform duration-500" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-3">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-3xl font-black tracking-tight", isBoldValue ? "text-slate-900 dark:text-white" : "text-current")}>{value}</span>
        {unit && <span className="text-xs font-bold opacity-60">{unit}</span>}
      </div>
    </div>
  )
}

function SidebarItem({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  const iconColors: Record<string, string> = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600",
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600",
  }
  return (
    <div className="flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", iconColors[color])}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{value}</p>
      </div>
    </div>
  )
}
