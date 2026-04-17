import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { 
  ArrowLeft, 
  Target, 
  CheckCircle2, 
  Calendar, 
  User, 
  FileText, 
  MessageSquare,
  Trophy,
  History,
  Download,
  Eye,
  File
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

  if (isLoading) return <LoadingSkeleton type="form" rows={6} />
  if (!submission) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
        <FileText className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-slate-500">Không tìm thấy bài nộp nào.</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-indigo-500 font-medium hover:underline">Quay lại</button>
    </div>
  )

  const achievement = submission.targetValue 
    ? Math.round((submission.actualValue / submission.targetValue) * 100) 
    : null

  const getAchievementColor = (val: number) => {
    if (val >= 100) return 'text-emerald-500'
    if (val >= 70) return 'text-amber-500'
    return 'text-rose-500'
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 mr-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500 transition-transform group-hover:-translate-x-1" />
        </button>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{submission.kpiCriteriaName}</h1>
            <StatusBadge status={submission.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Chi tiết báo cáo kết quả KPI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-12 h-12 text-indigo-500" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Giá trị thực tế</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{formatNumber(submission.actualValue)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Target className="w-12 h-12 text-indigo-500" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mục tiêu đề ra</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {submission.targetValue != null ? formatNumber(submission.targetValue) : '—'}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Trophy className="w-12 h-12 text-indigo-500" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tỷ lệ đạt được</p>
              <div className="flex items-baseline gap-1">
                {achievement != null ? (
                  <span className={`text-3xl font-black ${getAchievementColor(achievement)}`}>
                    {achievement}%
                  </span>
                ) : (
                  <span className="text-3xl font-black text-slate-400">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Feedback Section (If available) */}
          {(submission.note || submission.reviewNote) && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-6 text-slate-900 dark:text-white">
                <MessageSquare className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold">Đánh giá & Ghi chú</h3>
              </div>
              
              <div className="space-y-6">
                {submission.note && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 transition-all hover:border-indigo-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Người nộp ghi chú</p>
                    <p className="text-slate-700 dark:text-slate-300 ml-1 leading-relaxed">{submission.note}</p>
                  </div>
                )}
                
                {submission.reviewNote && (
                  <div className={`p-5 rounded-2xl border ${submission.status === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-800/30' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-800/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                       <History className={`w-4 h-4 ${submission.status === 'APPROVED' ? 'text-emerald-500' : 'text-rose-500'}`} />
                       <p className={`text-xs font-bold uppercase tracking-wider ${submission.status === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600'}`}>Phản hồi từ quản lý</p>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 ml-6 leading-relaxed italic">"{submission.reviewNote}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Proof Evidence Gallery */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold">Bằng chứng xác thực</h3>
              </div>
              <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-full">
                {submission.attachments?.length || 0} tệp tin
              </span>
            </div>

            {submission.attachments?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {submission.attachments.map((file) => {
                  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.fileName)
                  return (
                    <div 
                      key={file.id} 
                      className="group relative bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all cursor-pointer aspect-square"
                      onClick={() => setActiveAttachment(file)}
                    >
                      {isImage ? (
                        <div className="w-full h-full relative">
                          <img 
                            src={file.fileUrl} 
                            alt={file.fileName} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <span className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"><Eye size={18} /></span>
                            <a href={file.fileUrl} download onClick={(e) => e.stopPropagation()} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"><Download size={18} /></a>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4">
                          <div className="p-3 bg-white dark:bg-slate-700 rounded-xl shadow-sm mb-2 group-hover:scale-110 transition-transform">
                            <File className="w-8 h-8 text-indigo-500" />
                          </div>
                          <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 text-center truncate w-full px-2">{file.fileName}</p>
                          <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <a 
                               href={file.fileUrl} 
                               download 
                               onClick={(e) => e.stopPropagation()}
                               className="w-full flex items-center justify-center gap-1 py-1.5 bg-indigo-500 text-white text-[10px] font-bold rounded-lg shadow-lg shadow-indigo-500/30"
                             >
                               <Download size={10} /> Tải xuống
                             </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/20">
                <FileText className="w-10 h-10 text-slate-200 dark:text-slate-700 mb-3" />
                <p className="text-slate-400 text-sm">Không có bằng chứng được đính kèm</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info Area */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6">Thông tin nộp</h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Họ và tên</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{submission.submittedByName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <Calendar className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ngày nộp</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatDateTime(submission.createdAt)}</p>
                </div>
              </div>

              {(submission.periodStart || submission.periodEnd) && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <History className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Kỳ báo cáo</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {submission.periodStart ? formatDateTime(submission.periodStart) : '...'} 
                      <span className="mx-1 text-slate-400">→</span>
                      {submission.periodEnd ? formatDateTime(submission.periodEnd) : '...'}
                    </p>
                  </div>
                </div>
              )}

              {submission.reviewedByName && (
                <div className="pt-4 border-t border-slate-50 dark:border-slate-800 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Người duyệt</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{submission.reviewedByName}</p>
                    </div>
                  </div>
                  {submission.reviewedAt && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <Calendar className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ngày duyệt</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatDateTime(submission.reviewedAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20">
             <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-indigo-100" />
                <p className="font-bold text-sm">Gợi ý cho bạn</p>
             </div>
             <p className="text-xs text-indigo-100 leading-relaxed mb-4">
                Hãy tiếp tục duy trì tiến độ công việc để đạt hiệu quả cao nhất cho chỉ tiêu này.
             </p>
             <button 
               onClick={() => navigate('/submissions/new')}
               className="w-full py-2 bg-white/20 backdrop-blur-md rounded-xl text-white text-xs font-black shadow-lg hover:bg-white/30 transition-all uppercase tracking-widest"
             >
                Nộp thêm báo cáo
             </button>
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
