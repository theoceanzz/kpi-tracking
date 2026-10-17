import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle, Download, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import FileDropzone from '@/components/common/FileDropzone'
import { getApiErrorMessage } from '@/lib/apiError'
import { toastUploadError } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { formatDate } from '@/i18n/format'
import { listApi } from '../api/listApi'
import { useRefreshTasks } from '../hooks/useTasks'
import type { TaskImportPreview } from '../types'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'

const MAX_SIZE = 5 * 1024 * 1024

/**
 * Nhập việc từ Excel vào một danh sách: tải mẫu → chọn tệp → xem trước (dòng lỗi tô đỏ, ghi lý do) → tạo các dòng hợp lệ.
 * Người thực hiện ghi bằng email; nhóm chưa có thì máy chủ tạo; nhãn chưa có thì tạo. Việc nhập vào không gắn KPI.
 */
export default function TaskImportDialog({ listId, open, onClose }: { listId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation('tasks')
  const refresh = useRefreshTasks()
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<TaskImportPreview | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setFiles([])
    setPreview(null)
  }
  const close = () => {
    reset()
    onClose()
  }

  const read = (file: File) => {
    setBusy(true)
    listApi.importPreview(listId, file)
      .then(setPreview)
      .catch((e) => toastUploadError(e, () => read(file)))
      .finally(() => setBusy(false))
  }

  const commit = () => {
    if (blockedByTour() || !preview) return
    const rows = preview.rows.filter((r) => !r.errors?.length)
    setBusy(true)
    listApi.importCommit(listId, rows).then((res) => {
      refresh()
      if (res.failed.length) toast.warning(t('import.partial', { created: res.created, failed: res.failed.length }))
      else toast.success(t('import.done', { count: res.created }))
      close()
    }).catch((e) => toast.error(getApiErrorMessage(e))).finally(() => setBusy(false))
  }

  return (
    <Dialog {...tourAnchor('task.list.import')} open={open} onClose={close} size="xl" title={t('import.title')} description={t('import.description')}
      footer={<DialogFooter
        destructive={<Button {...tourAnchor('task.list.import.template')} variant="ghost" onClick={() => listApi.importTemplate().catch((e) => toast.error(getApiErrorMessage(e)))}>
          <Download /> {t('import.template')}
        </Button>}
        secondary={preview
          ? <Button variant="outline" onClick={reset}>{t('import.chooseAnother')}</Button>
          : <Button variant="outline" onClick={close}>{t('detail.close')}</Button>}
        primary={preview && (
          <Button disabled={busy || preview.validCount === 0} onClick={commit}>
            {busy && <Loader2 className="animate-spin" />} {t('import.commit', { count: preview.validCount })}
          </Button>
        )}
      />}>
      {!preview ? (
        <div className="space-y-3">
          <FileDropzone data-tour="task.list.import.drop" files={files} maxFiles={1} maxSize={MAX_SIZE}
            accept={{ 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }}
            label={t('import.drop')} hint={t('import.hint')}
            onRemove={() => setFiles([])}
            onFilesSelected={(fs) => { setFiles(fs.slice(0, 1)); if (fs[0]) read(fs[0]) }} />
          {busy && <p className="flex items-center gap-2 text-sm text-[var(--color-subtle-foreground)]"><Loader2 size={14} className="animate-spin" /> {t('import.reading')}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            {t('import.summary', { valid: preview.validCount, errors: preview.errorCount })}
          </p>
          <div className="max-h-[50vh] overflow-auto rounded-card border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--color-muted)] text-xs text-[var(--color-subtle-foreground)]">
                <tr>
                  <th className="px-2 py-1.5 text-left">#</th>
                  <th className="px-2 py-1.5 text-left">{t('import.col.title')}</th>
                  <th className="px-2 py-1.5 text-left">{t('import.col.assignees')}</th>
                  <th className="px-2 py-1.5 text-left">{t('import.col.start')}</th>
                  <th className="px-2 py-1.5 text-left">{t('import.col.due')}</th>
                  <th className="px-2 py-1.5 text-left">{t('import.col.section')}</th>
                  <th className="px-2 py-1.5 text-left">{t('import.col.tags')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => {
                  const bad = !!r.errors?.length
                  return (
                    <tr key={r.rowNumber ?? i} className={cn('border-t border-[var(--color-border)] align-top', bad && 'bg-[var(--color-error-bg)]')}>
                      <td className="px-2 py-1.5 text-xs text-[var(--color-subtle-foreground)]">{r.rowNumber}</td>
                      <td className="px-2 py-1.5">
                        <span className="block">{r.title || '-'}</span>
                        {bad && (
                          <span className="mt-0.5 flex items-start gap-1 text-xs text-[var(--color-error)]">
                            <AlertCircle size={12} className="mt-0.5 shrink-0" /> {r.errors!.join('; ')}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs">{r.assigneeEmails || '-'}</td>
                      <td className="px-2 py-1.5 text-xs">{r.startDate ? formatDate(r.startDate) : '-'}</td>
                      <td className="px-2 py-1.5 text-xs">{r.dueDate ? formatDate(r.dueDate) : '-'}</td>
                      <td className="px-2 py-1.5 text-xs">{r.section || '-'}</td>
                      <td className="px-2 py-1.5 text-xs">{r.tags || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  )
}
