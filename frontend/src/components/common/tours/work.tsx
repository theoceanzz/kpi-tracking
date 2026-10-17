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
  // Bản 3: danh sách, chọn nhiều, lưu chế độ xem, xuất Excel; Gantt + Thống kê.
  // Bản 4: dòng việc (menu chuột phải, sửa tên tại chỗ), cột hiển thị, Ctrl+K, cú pháp thêm nhanh, nhóm của tôi, lịch tuần.
  // Bản 5: bố cục theo đúng Lark (docs/TASKS_LARK_REFERENCE.md) — Hoạt động, ô "Đang làm ▾", Tuỳ chỉnh, menu ··· (chọn nhiều,
  // xuất Excel) thay cho các nút rời.
  tasks: {
    version: 5,
    next: TASK_FORM,
    steps: [
      intro('tasks.intro'),
      s('tasks.views', tourTarget('tasks.views'), 'right'),
      s('tasks.activity', tourTarget('tasks.activity'), 'right'),
      s('tasks.lists', tourTarget('tasks.lists'), 'right'),
      s('tasks.mode', tourTarget('tasks.mode'), 'bottom'),
      s('tasks.create', tourTarget('tasks.create'), 'bottom'),
      s('tasks.status', tourTarget('tasks.status'), 'bottom'),
      s('tasks.filter', tourTarget('tasks.filter'), 'bottom'),
      s('tasks.sort', tourTarget('tasks.sort'), 'bottom'),
      s('tasks.group', tourTarget('tasks.group'), 'bottom'),
      s('tasks.columns', tourTarget('tasks.columns'), 'left'),
      s('tasks.saveView', tourTarget('tasks.saveView'), 'bottom'),
      s('tasks.more', tourTarget('tasks.more'), 'left'),
      s('tasks.row', tourTarget('tasks.row'), 'bottom'),
      s('tasks.quickAdd', tourTarget('tasks.quick-add'), 'top'),
    ],
  },

  // Bản 3: bố cục theo Lark (docs/DOCUMENTS_LARK_REFERENCE.md) — thẻ "Mới" đầu trang, ô Tìm kiếm trên thanh bên,
  // Dung lượng | Thùng rác ở đáy thanh bên.
  documents: {
    version: 3,
    next: DOCS_CREATE,
    steps: [
      intro('docs.intro'),
      s('docs.new', tourTarget('docs.new'), 'bottom'),
      s('docs.nav', tourTarget('docs.nav'), 'right'),
      s('docs.mine', tourTarget('docs.nav.mine'), 'right'),
      s('docs.unit', tourTarget('docs.nav.unit'), 'right'),
      s('docs.company', tourTarget('docs.nav.company'), 'right'),
      s('docs.requests', tourTarget('docs.nav.requests'), 'right'),
      s('docs.storage', tourTarget('docs.nav.storage'), 'right'),
      s('docs.trash', tourTarget('docs.nav.trash'), 'right'),
      s('docs.main', tourTarget('docs.main'), 'top'),
    ],
  },
}))

export default workTours
