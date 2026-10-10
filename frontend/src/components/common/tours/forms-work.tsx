import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Bài đi qua các hộp tạo mới của "Công việc" và "Tài liệu" — nối sau bài của trang (`next`).
 * Mở bằng `useTourModal`; nút Tạo / Tải lên gọi `blockedByTour()` nên không tạo gì thật.
 */

export const TASK_FORM: TourKey = 'tasks+form'
export const DOCS_CREATE: TourKey = 'documents+create'

const { t, modal } = tourKit('tourForms')

const formsWorkTours = perLanguage((): Record<TourKey, TourDef> => {
  const task = modal('tasks.form')
  const menu = modal('docs.newMenu')
  const online = modal('docs.online')
  const upload = modal('docs.upload')
  const folder = modal('docs.folder')

  return {
    [TASK_FORM]: {
      title: t('taskForm.title'),
      cleanup: task.close,
      steps: [
        task.opener('taskForm.add', tourTarget('tasks.create'), 'left'),
        task.step('taskForm.form', tourTarget('task.form'), 'right'),
        task.step('taskForm.name', tourTarget('task.form.title'), 'bottom'),
        task.step('taskForm.owner', tourTarget('task.form.owner'), 'bottom'),
        task.step('taskForm.kpi', tourTarget('task.form.kpi'), 'bottom'),
        task.step('taskForm.due', tourTarget('task.form.due'), 'bottom'),
        task.step('taskForm.priority', tourTarget('task.form.priority'), 'bottom'),
        task.step('taskForm.more', tourTarget('task.form.more'), 'top'),
        task.step('taskForm.submit', tourTarget('task.form.submit'), 'top'),
      ],
    },

    // Bốn lối tạo trong menu "Mới": tài liệu soạn trực tuyến, tải tệp lên, thư mục.
    [DOCS_CREATE]: {
      title: t('docsCreate.title'),
      cleanup: async () => {
        await menu.close()
        await online.close()
      },
      steps: [
        menu.step('docsCreate.menu', tourTarget('docs.new.menu'), 'left'),
        online.step('docsCreate.onlineTitle', tourTarget('online.form.title'), 'right'),
        online.step('docsCreate.onlineScope', tourTarget('online.form.scope'), 'right'),
        online.step('docsCreate.onlineSubmit', tourTarget('online.form.submit'), 'top'),
        upload.step('docsCreate.uploadDrop', tourTarget('upload.form.drop'), 'right'),
        upload.step('docsCreate.uploadTitle', tourTarget('upload.form.title'), 'right'),
        upload.step('docsCreate.uploadMeta', tourTarget('upload.form.meta'), 'right'),
        upload.step('docsCreate.uploadDescription', tourTarget('upload.form.description'), 'right'),
        upload.step('docsCreate.uploadAi', tourTarget('upload.form.ai'), 'right'),
        upload.step('docsCreate.uploadSubmit', tourTarget('upload.form.submit'), 'top'),
        folder.step('docsCreate.folderName', tourTarget('folder.form.name'), 'right'),
        folder.step('docsCreate.folderScope', tourTarget('folder.form.scope'), 'right'),
        folder.step('docsCreate.folderSubmit', tourTarget('folder.form.submit'), 'top'),
      ],
    },
  }
})

export default formsWorkTours
