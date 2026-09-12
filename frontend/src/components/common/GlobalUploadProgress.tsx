import { useUploadStore } from '@/store/uploadStore'
import { X, CheckCircle2, AlertCircle, Loader2, FileUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function GlobalUploadProgress() {
  const { tasks, removeTask } = useUploadStore()

  if (tasks.length === 0) return null

  // bottom-24 chứ không phải bottom-6: chừa chỗ cho nút chatbot AI ở góc phải dưới,
  // thẻ tiến trình xếp chồng phía trên nút đó thay vì đè lên.
  return (
    <div className="fixed bottom-24 right-6 z-[9999] w-80 space-y-3 pointer-events-none">
      {tasks.map((task) => (
        <div 
          key={task.id}
          className={cn(
            "pointer-events-auto bg-[var(--color-card)] border rounded-card p-4 shadow-2xl animate-in slide-in-from-right-8 duration-500",
            task.status === 'error' ? "border-[var(--color-error-border)]" : "border-[var(--color-border)]"
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              "w-10 h-10 rounded-card flex items-center justify-center shrink-0",
              task.status === 'uploading' ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" :
              task.status === 'completed' ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" :
              "bg-[var(--color-error-bg)] text-[var(--color-error)]"
            )}>
              {task.status === 'uploading' ? <Loader2 size={20} className="animate-spin" /> :
               task.status === 'completed' ? <CheckCircle2 size={20} /> :
               <AlertCircle size={20} />}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-foreground)] truncate uppercase tracking-tight">
                {task.status === 'uploading' ? 'Đang tải lên...' : 
                 task.status === 'completed' ? 'Tải lên hoàn tất' : 
                 'Lỗi tải lên'}
              </p>
              <p className="text-caption truncate mt-0.5">
                {task.fileName}
              </p>
            </div>

            <button 
              onClick={() => removeTask(task.id)}
              className="p-1.5 hover:bg-[var(--color-muted)] rounded-control text-[var(--color-subtle-foreground)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2">
            <div className="h-1.5 w-full bg-[var(--color-muted)] rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500 ease-out rounded-full",
                  task.status === 'error' ? "bg-[var(--color-error-solid)]" : "bg-[var(--color-primary)]"
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-eyebrow">
                {task.status === 'uploading' ? `${task.progress}%` : ''}
              </span>
              {task.status === 'uploading' && (
                <div className="text-eyebrow flex items-center gap-1 text-[var(--color-primary)]">
                  <FileUp size={10} /> Đang xử lý
                </div>
              )}
            </div>
            {/* Lý do máy chủ từ chối. KHÔNG truncate: thông điệp bị cắt cụt thì cũng bằng không có,
                mà đây lại đúng là chỗ duy nhất người dùng biết được mình phải sửa gì. */}
            {task.status === 'error' && task.message && (
              <p className="text-xs font-medium leading-relaxed text-[var(--color-error)]">
                {task.message}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
