import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'
import { DOCS_CREATE, TASK_FORM } from './forms-work'

/**
 * Hướng dẫn cho hai dòng sidebar "Công việc" và "Tài liệu" — trước đây chưa có bài nào.
 * Cả hai trang tự báo `useTourScope` để bài tự chạy lần đầu.
 */

const { s, intro } = tourKit('tourWork')

const workTours = perLanguage((): Record<TourKey, TourDef> => ({
  // Bản 2: nối thêm bài đi qua hộp tạo việc / hộp tạo tài liệu (xem `forms-work.tsx`).
  tasks: {
    version: 2,
    next: TASK_FORM,
    steps: [
      intro('tasks.intro'),
      s('tasks.views', tourTarget('tasks.views'), 'right'),
      s('tasks.create', tourTarget('tasks.create'), 'left'),
      s('tasks.mode', tourTarget('tasks.mode'), 'bottom'),
      s('tasks.group', tourTarget('tasks.group'), 'bottom'),
      s('tasks.sort', tourTarget('tasks.sort'), 'bottom'),
      s('tasks.filter', tourTarget('tasks.filter'), 'bottom'),
      s('tasks.search', tourTarget('tasks.search'), 'bottom'),
      s('tasks.quickAdd', tourTarget('tasks.quick-add'), 'top'),
    ],
  },

  documents: {
    version: 2,
    next: DOCS_CREATE,
    steps: [
      intro('docs.intro'),
      s('docs.new', tourTarget('docs.new'), 'left'),
      s('docs.nav', tourTarget('docs.nav'), 'right'),
      s('docs.mine', tourTarget('docs.nav.mine'), 'right'),
      s('docs.unit', tourTarget('docs.nav.unit'), 'right'),
      s('docs.company', tourTarget('docs.nav.company'), 'right'),
      s('docs.requests', tourTarget('docs.nav.requests'), 'right'),
      s('docs.trash', tourTarget('docs.nav.trash'), 'right'),
      s('docs.main', tourTarget('docs.main'), 'top'),
    ],
  },
}))

export default workTours
