import type { Step } from 'react-joyride'
import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'

/**
 * Hướng dẫn cho "Tổng quan".
 *
 * Trang này không có mục con theo `?section=`; thay vào đó nó chọn bố cục theo quyền và theo
 * `?view=`. Bốn vai trò đó được đặt vào chỗ của `sectionId` — nhờ vậy mỗi vai có bài riêng và
 * được đánh dấu đã-xem riêng, mà không cần thêm khái niệm mới nào vào mô hình khoá. Chính
 * component dashboard báo lên nó đang vẽ bảng nào (`useTourScope('dashboard', 'director')`).
 *
 * Cả bốn bài dùng chung bộ bước: trang chủ giờ chỉ là một lưới widget, khác nhau ở việc vai
 * nào thấy thêm widget cấp đơn vị. Phần khác biệt nằm ở bước mở đầu.
 */

const note = (text: string) => (
  <p className="text-[11px] bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-700 dark:text-indigo-300 font-bold italic">
    💡 {text}
  </p>
)

/** Bước mở đầu riêng cho từng vai — nói rõ phạm vi dữ liệu vai đó nhìn thấy. */
const intro = (title: string, body: React.ReactNode): Step => ({
  target: 'body',
  title,
  content: <div className="space-y-2">{body}</div>,
  placement: 'center',
})

/** Ba bước chung: lưới widget → nút tuỳ chỉnh → thư viện widget. */
const commonSteps: Step[] = [
  {
    target: '#tour-dashboard-grid',
    title: '🧩 Trang chủ là lưới widget của bạn',
    content: (
      <div className="space-y-2">
        <p>
          Mỗi ô ở đây là <strong>đúng biểu đồ và đúng số liệu</strong> bên trang Phân tích &amp; Thống kê,
          không phải một bản dựng lại — nên con số hai nơi luôn khớp nhau.
        </p>
        <p className="text-[11px] text-slate-500">
          Bố cục được lưu theo từng người và từng vai trò, nên bạn sắp thế nào thì lần sau mở ra vẫn thế.
        </p>
      </div>
    ),
    placement: 'top',
  },
  {
    target: '#tour-dashboard-customize',
    title: '⚙️ Tuỳ chỉnh ngay trên thanh tiêu đề',
    content: (
      <div className="space-y-2">
        <p>
          Bấm <strong>Tuỳ chỉnh</strong> để vào chế độ chỉnh sửa: kéo-thả đổi chỗ, kéo cạnh đổi kích thước,
          hoặc dùng các nút mũi tên ngay trên mỗi ô nếu bạn không dùng chuột.
        </p>
        {note('Nhớ bấm Lưu — thoát bằng Huỷ sẽ bỏ hết thay đổi trong lượt chỉnh sửa đó.')}
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-dashboard-customize',
    title: '➕ Thêm và bớt nội dung',
    content: (
      <div className="space-y-2">
        <p>
          Trong chế độ chỉnh sửa, <strong>Thêm biểu đồ</strong> mở thư viện widget: bấm một thẻ để thêm,
          bấm lại để gỡ. <strong>Ẩn/Hiện</strong> giữ widget lại nhưng tạm cất khỏi lưới.
        </p>
        <p className="text-[11px] text-slate-500">
          Chưa biết bắt đầu từ đâu thì chọn một <strong>bố cục gợi ý</strong> ngay đầu thư viện, rồi sửa dần.
          Lỡ tay vẫn còn nút Hoàn tác trong thông báo hiện ra.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]

const dashboardTours: Record<TourKey, TourDef> = {
  'dashboard/director': {
    title: 'Tổng quan (Giám đốc)',
    steps: [
      intro('📊 Bảng dành cho giám đốc', (
        <>
          <p>
            Bạn thấy được cả widget cấp đơn vị (xu hướng KPI, hiệu suất từng đơn vị, rủi ro, xếp hạng)
            lẫn widget cá nhân của chính bạn.
          </p>
          {note('Muốn đi sâu hơn một ô nào đó? Mở mục Phân tích — cùng dữ liệu, thêm bộ lọc thời gian và đợt.')}
        </>
      )),
      ...commonSteps,
    ],
  },

  'dashboard/head': {
    title: 'Tổng quan (Trưởng đơn vị)',
    steps: [
      intro('👥 Bảng dành cho trưởng đơn vị', (
        <>
          <p>
            Widget cấp đơn vị ở đây bám theo phạm vi bạn quản: tiến độ của phòng, ai đang trễ hạn,
            và bảng xếp hạng nhân sự thuộc quyền bạn.
          </p>
          {note('Bài nộp và chỉ tiêu chờ duyệt nằm ở mục Quản lý hiệu suất trên thanh bên.')}
        </>
      )),
      ...commonSteps,
    ],
  },

  'dashboard/deputy': {
    title: 'Tổng quan (Phó đơn vị)',
    steps: [
      intro('🤝 Bảng dành cho phó đơn vị', (
        <>
          <p>
            Phó vừa quản một mảng vừa là người có KPI riêng, nên bố cục mặc định gồm cả một widget
            cấp đơn vị và một widget cá nhân.
          </p>
          {note('Muốn xem riêng kết quả của chính bạn? Dùng công tắc "Dashboard cá nhân" ở đầu trang.')}
        </>
      )),
      ...commonSteps,
    ],
  },

  'dashboard/staff': {
    title: 'Tổng quan (Cá nhân)',
    steps: [
      intro('⭐ Bảng dành cho bạn', (
        <>
          <p>
            Trang chủ hiện KPI bạn đang đảm nhiệm: xu hướng theo thời gian và bảng chi tiết từng
            chỉ tiêu — bấm vào một dòng để xem toàn bộ bài nộp và điểm của nó.
          </p>
          {note('Nộp báo cáo và xem đánh giá của bạn nằm ở mục "Của tôi" trên thanh bên.')}
        </>
      )),
      ...commonSteps,
    ],
  },
}

export default dashboardTours
