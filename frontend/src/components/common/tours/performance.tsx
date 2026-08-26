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
        target: '#tour-section-root',
        title: '🏅 Nhiều đợt thành một kết quả',
        content: (
          <div className="space-y-2">
            <p>
              Đánh giá đợt chấm từng lần nộp. Màn này gom các đợt trong một <strong>kỳ</strong> lại thành
              kết quả tổng hợp và xếp loại chính thức cho từng nhân sự.
            </p>
            {note('Chưa chọn kỳ và đơn vị thì chưa có gì hiện ra — đó là hai bộ chọn đầu tiên trên màn.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-section-root',
        title: '👤 Ba cột điểm, ba người chấm',
        content: (
          <div className="space-y-2">
            <ul className="text-[11px] space-y-1.5 list-disc pl-4 text-slate-500 font-medium">
              <li><strong className="text-slate-900 dark:text-white">Tự chấm:</strong> nhân viên tự đánh giá mình.</li>
              <li><strong className="text-slate-900 dark:text-white">Quản lý chấm:</strong> điểm bạn cho.</li>
              <li><strong className="text-slate-900 dark:text-white">Điểm cuối:</strong> kết quả được chốt cho kỳ.</li>
            </ul>
            {note('Để hai cột đầu lệch nhau nhiều mà không có nhận xét là nguồn khiếu nại phổ biến nhất. Ghi lý do vào ô nhận xét.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-section-root',
        title: '🔒 Khoá theo cấp',
        content: (
          <div className="space-y-2">
            <p>
              Cấp dưới chốt xong thì kết quả bị <strong>khoá</strong>, cấp trên mới duyệt tiếp. Dòng bị
              khoá ghi rõ đơn vị nào đã khoá nó.
            </p>
            {warn('Mở khoá để sửa là ghi đè lên thứ cấp dưới đã ký. Chỉ làm khi thực sự có sai sót, và nên báo lại cho họ.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-section-root',
        title: '📊 Hai con số trung bình',
        content: (
          <p>
            <strong>TB xếp loại</strong> là hạng trung bình của đơn vị, <strong>TB định tính</strong> là
            điểm hành vi trung bình. Chúng là đầu vào để xếp loại cả đơn vị theo tiêu chuẩn đã đặt ở
            "Thiết lập công cụ › Xếp loại đơn vị".
          </p>
        ),
        placement: 'top',
      },
    ],
  },
}

export default performanceTours
