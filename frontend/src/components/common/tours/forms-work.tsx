import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { runTourAction, tourFact } from './actions'
import type { TourStep } from './registry'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Bài đi qua các hộp tạo mới của "Công việc" và "Tài liệu" — nối sau bài của trang (`next`).
 * Mở bằng `useTourModal`; nút Tạo / Tải lên gọi `blockedByTour()` nên không tạo gì thật.
 */

export const TASK_FORM: TourKey = 'tasks+form'
export const TASK_LIST_FORM: TourKey = 'tasks+listForm'
export const TASK_LIST_SETTINGS: TourKey = 'tasks+listSettings'
export const TASK_LIST_IMPORT: TourKey = 'tasks+listImport'
export const DOCS_CREATE: TourKey = 'documents+create'
export const DOCS_EMAIL: TourKey = 'documents+email'

const { t, s, intro, modal } = tourKit('tourForms')

const formsWorkTours = perLanguage((): Record<TourKey, TourDef> => {
  const task = modal('tasks.form')
  const listForm = modal('tasks.listForm')
  const settings = modal('tasks.listSettings')
  const importForm = modal('tasks.listImport')
  /**
   * Hai bài này cần MỘT danh sách đang mở (hộp thuộc về danh sách). Đứng ở trang Công việc chung thì bước đầu tự mở danh
   * sách đầu tiên mình xem được (Nhập Excel: mình sửa được) — `tasks.list.ensure`. Không có danh sách nào thì chỉ còn một
   * bước giải thích, thay vì mọi bước tự bỏ qua và bấm vào không thấy gì.
   */
  const hasList = (kind: 'settings' | 'import') => () => tourFact(kind === 'settings' ? 'tasks.hasList' : 'tasks.hasEditableList')
  const needs = (kind: 'settings' | 'import', st: TourStep): TourStep => ({ ...st, requires: hasList(kind) })
  const noList = (kind: 'settings' | 'import', id: string): TourStep => ({ ...intro(id), requires: () => !hasList(kind)() })
  const ensure = (kind: 'settings' | 'import', close: () => Promise<void>) => async () => {
    await close()
    await runTourAction('tasks.list.ensure', kind)
  }
  /** Bước ở một tab của hộp Cài đặt danh sách: mở hộp đúng tab đó. */
  const tab = (id: string, name: string) =>
    needs('settings', s(id, tourTarget(`task.list.settings.${name}`), 'right', { prepare: () => runTourAction('tasks.listSettings.tab', name) }))
  const menu = modal('docs.newMenu')
  const online = modal('docs.online')
  const upload = modal('docs.upload')
  const folder = modal('docs.folder')
  const email = modal('docs.email')

  return {
    // Bản 2: KPI không còn bắt buộc, thêm nhiều người thực hiện + danh sách; nối sang bài tạo danh sách.
    [TASK_FORM]: {
      version: 2,
      title: t('taskForm.title'),
      next: TASK_LIST_FORM,
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

    // Hộp "Tạo danh sách": tên + màu, mô tả, chọn mẫu (trống / có sẵn / của tổ chức).
    [TASK_LIST_FORM]: {
      title: t('taskListForm.title'),
      next: TASK_LIST_SETTINGS,
      cleanup: listForm.close,
      steps: [
        listForm.opener('taskListForm.add', tourTarget('tasks.lists.create'), 'right'),
        listForm.step('taskListForm.form', tourTarget('task.list.form'), 'right'),
        listForm.step('taskListForm.name', tourTarget('task.list.form.name'), 'bottom'),
        listForm.step('taskListForm.template', tourTarget('task.list.form.template'), 'top'),
        listForm.step('taskListForm.submit', tourTarget('task.list.form.submit'), 'top'),
      ],
    },

    // Hộp "Cài đặt danh sách" của một danh sách (tự mở danh sách nếu đang ở trang chung). Bước chỉ xem: không bấm Lưu / Thêm gì cả.
    [TASK_LIST_SETTINGS]: {
      title: t('taskListSettings.title'),
      // Bản 2: tự mở danh sách khi đang ở trang chung, bước giải thích khi chưa có danh sách nào.
      version: 2,
      next: TASK_LIST_IMPORT,
      cleanup: settings.close,
      steps: [
        noList('settings', 'taskListSettings.needList'),
        needs('settings', settings.opener('taskListSettings.open', tourTarget('tasks.list.menu'), 'bottom', { prepare: ensure('settings', settings.close) })),
        needs('settings', settings.step('taskListSettings.tabs', tourTarget('task.list.settings.tabs'), 'bottom')),
        tab('taskListSettings.general', 'general'),
        tab('taskListSettings.members', 'members'),
        tab('taskListSettings.sections', 'sections'),
        tab('taskListSettings.fields', 'fields'),
        tab('taskListSettings.automations', 'automations'),
      ],
    },

    // Hộp "Nhập Excel" của danh sách: tải mẫu → thả tệp → xem trước → tạo. Không tải tệp nào lên.
    [TASK_LIST_IMPORT]: {
      title: t('taskListImport.title'),
      version: 2,
      cleanup: importForm.close,
      steps: [
        noList('import', 'taskListImport.needList'),
        needs('import', importForm.opener('taskListImport.open', tourTarget('tasks.list.menu'), 'bottom', { prepare: ensure('import', importForm.close) })),
        needs('import', importForm.step('taskListImport.form', tourTarget('task.list.import'), 'right')),
        needs('import', importForm.step('taskListImport.template', tourTarget('task.list.import.template'), 'top')),
        needs('import', importForm.step('taskListImport.drop', tourTarget('task.list.import.drop'), 'bottom')),
      ],
    },

    // Bốn lối tạo trong menu "Mới": tài liệu soạn trực tuyến, tải tệp lên, thư mục.
    [DOCS_CREATE]: {
      title: t('docsCreate.title'),
      next: DOCS_EMAIL,
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

    // Gửi tài liệu qua email (link công khai) — hộp mở với tài liệu đầu tiên mình quản lý; nút Gửi bị chặn khi đang học.
    [DOCS_EMAIL]: {
      title: t('docsEmail.title'),
      cleanup: email.close,
      steps: [
        email.step('docsEmail.to', tourTarget('docEmail.form.to'), 'right'),
        email.step('docsEmail.message', tourTarget('docEmail.form.message'), 'right'),
        email.step('docsEmail.attachment', tourTarget('docEmail.form.attachment'), 'top'),
        email.step('docsEmail.submit', tourTarget('docEmail.form.submit'), 'top'),
      ],
    },
  }
})

export default formsWorkTours
