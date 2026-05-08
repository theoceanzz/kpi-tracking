import { useUploadStore } from '@/store/uploadStore'
import { X, CheckCircle2, AlertCircle, Loader2, FileUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function GlobalUploadProgress() {
  const { tasks, removeTask } = useUploadStore()

  if (tasks.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 space-y-3 pointer-events-none">
      {tasks.map((task) => (
        <div 
          key={task.id}
          className={cn(
            "pointer-events-auto bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-2xl animate-in slide-in-from-right-8 duration-500",
            task.status === 'error' ? "border-rose-200 dark:border-rose-900/30" : "border-slate-200 dark:border-slate-800"
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              task.status === 'uploading' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" :
              task.status === 'completed' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
              "bg-rose-50 dark:bg-rose-950/20 text-rose-600"
            )}>
              {task.status === 'uploading' ? <Loader2 size={20} className="animate-spin" /> :
               task.status === 'completed' ? <CheckCircle2 size={20} /> :
               <AlertCircle size={20} />}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">
                {task.status === 'uploading' ? 'Đang tải lên...' : 
                 task.status === 'completed' ? 'Tải lên hoàn tất' : 
                 'Lỗi tải lên'}
              </p>
              <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                {task.fileName}
              </p>
            </div>

            <button 
              onClick={() => removeTask(task.id)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2">
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500 ease-out rounded-full",
                  task.status === 'error' ? "bg-rose-500" : "bg-indigo-600"
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {task.status === 'uploading' ? `${task.progress}%` : ''}
              </span>
              {task.status === 'uploading' && (
                <div className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                  <FileUp size={10} /> Đang xử lý
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
