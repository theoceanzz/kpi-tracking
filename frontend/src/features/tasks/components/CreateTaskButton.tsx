import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ListPlus } from 'lucide-react'
import { useApiAllowed } from '@/hooks/useApiAllowed'
import TaskCreateDialog, { type TaskCreateDefaults } from './TaskCreateDialog'

/**
 * Nút "Tạo công việc" đặt ở chỗ khác ngoài trang Công việc (bình luận, tài liệu…): mở hộp tạo việc điền sẵn tên / mô tả và
 * nguồn (`sourceRef`) để việc trỏ ngược về chỗ sinh ra nó. Không có quyền tạo việc thì không hiện.
 */
export default function CreateTaskButton({ defaults, className, children }: {
  /** Gọi lúc bấm — lấy nội dung mới nhất (vd. đoạn đang bôi đen). */
  defaults: () => TaskCreateDefaults
  className?: string
  children?: ReactNode
}) {
  const { t } = useTranslation('tasks')
  const navigate = useNavigate()
  const allowed = useApiAllowed('POST', '/kpi-tasks')
  const [open, setOpen] = useState<TaskCreateDefaults | null>(null)
  if (!allowed) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(defaults())} className={className} title={t('source.createTask')}>
        {children ?? <><ListPlus size={14} /> {t('source.createTask')}</>}
      </button>
      {open && (
        <TaskCreateDialog open onClose={() => setOpen(null)} defaults={open}
          onCreated={(id) => toast.success(t('source.created'), {
            action: { label: t('source.openTask'), onClick: () => navigate(`/tasks?task=${encodeURIComponent(id)}`) },
          })} />
      )}
    </>
  )
}

