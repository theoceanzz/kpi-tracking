import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import {
  kpiCriteriaSteps,
  kpiPendingSteps,
  kpiAdjustmentsSteps,
  orgUnitSubmissionsSteps,
} from './inherited'

/**
 * Hướng dẫn cho "Quản lý hiệu suất" — dòng sidebar và năm mục bên trong.
 *
 * Bốn mục đầu đã có nội dung từ hồi chúng còn là bốn dòng sidebar riêng. Viết mới ở đây
 * là cấp trang và mục "Đánh giá kỳ" — mục duy nhất của trang chưa từng có hướng dẫn, mà
 * lại là mục khó nhất vì nó động tới chuỗi duyệt theo cấp và cơ chế khoá.
 */

const note = (text: string) => (
  <p className="text-[11px] bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-700 dark:text-indigo-300 font-bold italic">
    💡 {text}
  </p>
)

const warn = (text: string) => (
  <p className="text-[11px] bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg text-amber-700 dark:text-amber-400 font-bold italic border-l-4 border-amber-400">
    ⚠️ {text}
  </p>
)

const performanceTours: Record<TourKey, TourDef> = {
  /* ══════════ Cấp trang ══════════ */
  'performance': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: '📈 Vòng đời một chỉ tiêu',
        content: (
          <div className="space-y-2">
            <p>
              Cụm <strong>Chỉ tiêu</strong> là phần đặt và duyệt: thiết lập chỉ tiêu, phê duyệt chỉ tiêu
              cấp dưới gửi lên, và xử lý yêu cầu điều chỉnh giữa chừng.
            </p>
            <p>
              Cụm <strong>Đánh giá</strong> là phần chấm điểm: theo từng đợt, rồi tổng hợp thành kết quả
              cả kỳ.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-card-kpi-criteria',
        title: '1️⃣ Đầu kỳ: đặt và chốt chỉ tiêu',
        content: (
          <div className="space-y-2">
            <p>
              Giao chỉ tiêu cho người và đơn vị, rồi duyệt những chỉ tiêu cấp dưới tự đề xuất. Xong bước
              này thì cả kỳ mới có thứ để đo.
            </p>
            {warn('Chỉ tiêu chưa được duyệt thì không tính vào kết quả. Đầu kỳ nên soát hàng chờ duyệt cho sạch.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-submissions-org-unit',
        title: '2️⃣ Cuối đợt: chấm điểm',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Đánh giá đợt</strong> là chấm từng bài nộp của một đợt. <strong>Đánh giá kỳ</strong>{' '}
              gom nhiều đợt lại thành kết quả tổng hợp và xếp loại.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-settings-nav',
        title: '🔢 Số đỏ là việc đang chờ bạn',
        content: (
          <p>
            Con số đỏ trên thẻ và trên tab là số việc trong hàng chờ của riêng bạn. Không có số nghĩa là
            đang sạch.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Chỉ tiêu ══════════ */
  'performance/kpi-criteria': { steps: kpiCriteriaSteps },
  'performance/kpi-criteria-pending': { steps: kpiPendingSteps },
  'performance/kpi-adjustments-pending': { steps: kpiAdjustmentsSteps },

  /* ══════════ Cụm Đánh giá ══════════ */
  'performance/submissions-org-unit': { steps: orgUnitSubmissionsSteps },

  'performance/cycle-evaluation': {
    steps: [
      {
        target: '#tour-cycleeval-toolbar',
        title: '🎯 Chọn kỳ và đơn vị trước',
        content: (
          <div className="space-y-2">
            <p>
              Chưa chọn <strong>kỳ</strong> và <strong>đơn vị</strong> thì cả màn hình trống. Hai bộ chọn
              này quyết định mọi con số bên dưới; ô tìm kiếm bên trái lọc trong danh sách đã chọn.
            </p>
            {note('Đánh giá đợt chấm từng lần nộp. Màn này gom các đợt trong một kỳ lại thành kết quả tổng hợp và xếp loại chính thức.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycleeval-header',
        title: '📊 Dãy chỉ số và xếp loại đơn vị',
        content: (
          <div className="space-y-2">
            <p>
              Các ô chỉ số là điểm trung bình của cả đơn vị trong kỳ. Khối <strong>Xếp loại đơn vị</strong>
              bên cạnh là kết quả cuối cùng cấp trên đọc — ghi rõ "tạm tính" hay "đã chốt".
            </p>
            {note('TB xếp loại và TB định tính là đầu vào để xếp loại cả đơn vị theo tiêu chuẩn đặt ở "Thiết lập công cụ › Xếp loại đơn vị".')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycleeval-table',
        title: '👤 Ba cột điểm, ba người chấm',
        content: (
          <div className="space-y-2">
            <ul className="text-[11px] space-y-1.5 list-disc pl-4 text-slate-500 font-medium">
              <li><strong className="text-slate-900 dark:text-white">Nhân viên tự đánh giá:</strong> điểm họ tự chấm.</li>
              <li><strong className="text-slate-900 dark:text-white">Cán bộ QLTT đánh giá:</strong> điểm bạn cho.</li>
              <li><strong className="text-slate-900 dark:text-white">Điểm chốt:</strong> kết quả được ghi nhận cho kỳ.</li>
            </ul>
            {note('Để hai cột đầu lệch nhau nhiều mà không có nhận xét là nguồn khiếu nại phổ biến nhất. Ghi lý do vào ô nhận xét.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-cycleeval-chain',
        title: '🔒 Khoá theo cấp',
        content: (
          <div className="space-y-2">
            <p>
              Dải này là chuỗi duyệt: trưởng đơn vị → các cấp trên → giám đốc. Cấp dưới chốt xong thì kết
              quả bị <strong>khoá</strong>, cấp trên mới duyệt tiếp. Bấm vào một cấp để nhảy thẳng sang
              đơn vị đó.
            </p>
            {warn('Dòng bị khoá ghi rõ đơn vị nào đã khoá nó. Muốn sửa thì phải chọn đúng đơn vị đó rồi mở khoá — không sửa vòng qua được.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycleeval-actions',
        title: '📤 Xuất, gửi, và chốt',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Xuất Excel</strong> lấy nguyên bảng ra tệp. <strong>Gửi đánh giá</strong> email kết
              quả cho từng nhân viên. <strong>Chốt đánh giá phòng ban</strong> khoá kỳ lại và chụp luôn
              xếp loại đơn vị.
            </p>
            {warn('Mở khoá để sửa là ghi đè lên thứ cấp dưới đã ký. Chỉ làm khi thực sự có sai sót, và nên báo lại cho họ.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },
}

export default performanceTours
