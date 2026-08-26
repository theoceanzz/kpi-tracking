import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import {
  myKpiSteps,
  mySubmissionsSteps,
  evaluationsSteps,
  myAdjustmentsSteps,
} from './inherited'

/**
 * Hướng dẫn cho "Của tôi" — dòng sidebar, sáu mục, và các tab của hai mục ví.
 *
 * Bốn mục công việc đã có nội dung từ hồi chúng còn là bốn dòng sidebar riêng; ở đây chỉ
 * gắn lại vào khoá ba tầng. Phần viết mới là cấp trang và hai mục ví — hai mục này trước
 * đó không có gì, dù chúng động tới điểm thưởng và tiền thật.
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

const mySpaceTours: Record<TourKey, TourDef> = {
  /* ══════════ Cấp trang ══════════ */
  'my-space': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: '👤 Mọi thứ của riêng bạn',
        content: (
          <div className="space-y-2">
            <p>
              Cụm <strong>Công việc</strong> là chỉ tiêu được giao, bài nộp đã gửi, kết quả đánh giá và
              các yêu cầu điều chỉnh bạn đã tạo.
            </p>
            <p>
              Cụm <strong>Ví</strong> tách riêng vì đó là hai số dư khác nhau: điểm thưởng và tiền thật.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-card-my-kpi',
        title: '🔁 Vòng công việc của bạn',
        content: (
          <div className="space-y-2">
            <p>
              Bốn thẻ của cụm Công việc chạy theo một vòng: nhận <strong>chỉ tiêu</strong> → nộp{' '}
              <strong>báo cáo</strong> → nhận <strong>đánh giá</strong>. Chỉ tiêu không còn phù hợp thì
              gửi <strong>đề nghị điều chỉnh</strong>.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-settings-nav',
        title: '🔴 Chấm đỏ là việc đang chờ bạn',
        content: (
          <div className="space-y-2">
            <p>Thẻ nào có chấm đỏ nghĩa là ở đó có việc chưa xong — thường là bài nộp tới hạn.</p>
            {note('Thẻ nào không thấy? Cụm Ví chỉ hiện khi tổ chức bật module thưởng hoặc ví tiền.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Công việc ══════════ */
  'my-space/my-kpi': { steps: myKpiSteps },
  'my-space/my-submissions': { steps: mySubmissionsSteps },
  'my-space/evaluations': { steps: evaluationsSteps },
  'my-space/my-adjustments': { steps: myAdjustmentsSteps },

  /* ══════════ Cụm Ví ══════════ */
  'my-space/my-rewards': {
    steps: [
      {
        target: '#tour-section-root',
        title: '🎁 Điểm thưởng của bạn',
        content: (
          <div className="space-y-2">
            <p>
              Số dư điểm hiện lên đầu màn. Điểm tới từ ba nguồn: quản lý trao tay, chương trình tự động,
              và điểm danh hằng ngày.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-section-root',
        title: '📅 Thẻ điểm danh nằm ngoài tab',
        content: (
          <div className="space-y-2">
            <p>
              Thẻ điểm danh được đặt ngay dưới số dư, <strong>trên</strong> hàng tab — cố ý như vậy: nếu
              nó nằm trong một tab thì hôm nào bạn không mở đúng tab đó là mất chuỗi.
            </p>
            {warn('Chuỗi ngày liên tiếp bị đứt là mất luôn phần thưởng chuỗi, phải gây lại từ đầu.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-local-tabs',
        title: '🗂️ Ba tab: tiêu, xem, nhận',
        content: (
          <p>
            <strong>Cửa hàng quà</strong> để đổi điểm, <strong>Lịch sử điểm</strong> để xem điểm đến và
            đi từ đâu, <strong>Quà đã đổi</strong> để theo dõi món đang chờ nhận.
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },

  'my-space/my-rewards#shop': {
    title: 'Cửa hàng quà',
    steps: [
      {
        target: '#tour-section-root',
        title: '🛍️ Đổi điểm lấy quà',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi món hiện giá theo điểm và số lượng còn lại. Món chưa đủ điểm sẽ ghi rõ bạn còn thiếu
              bao nhiêu, khỏi phải nhẩm.
            </p>
            {warn('Điểm bị trừ ngay lúc bấm đổi, trước khi quà được giao. Cân nhắc kỹ vì không có nút hoàn lại.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-rewards#history': {
    title: 'Lịch sử điểm',
    steps: [
      {
        target: '#tour-section-root',
        title: '🧾 Điểm đến và đi từ đâu',
        content: (
          <p>
            Từng dòng ghi rõ lý do và thời điểm. Đây là chỗ đối chiếu khi bạn thấy số dư không khớp với
            những gì mình nhớ.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-rewards#redemptions': {
    title: 'Quà đã đổi',
    steps: [
      {
        target: '#tour-section-root',
        title: '📦 Món đang chờ nhận',
        content: (
          <div className="space-y-2">
            <p>
              Trạng thái của từng lần đổi quà, từ lúc gửi yêu cầu tới lúc được xác nhận đã giao.
            </p>
            {note('Món nằm quá lâu ở trạng thái chờ thì nhắc người phụ trách thưởng — điểm của bạn đã bị trừ rồi.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-cash-wallet': {
    steps: [
      {
        target: '#tour-section-root',
        title: '💰 Đây là tiền, không phải điểm',
        content: (
          <div className="space-y-2">
            <p>
              Ví giữ số dư tiền thật của bạn: nạp vào bằng chuyển khoản, và đổi được sang điểm thưởng
              theo tỉ giá tổ chức đặt.
            </p>
            {warn('Chiều đổi chỉ có một: tiền ra điểm được, điểm về lại tiền thì không.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-local-tabs',
        title: '🗂️ Ba tab',
        content: (
          <p>
            <strong>Đổi sang điểm</strong> để quy đổi, <strong>Đơn nạp tiền</strong> để theo dõi lệnh nạp
            đang chờ khớp, <strong>Lịch sử ví</strong> để tra mọi biến động.
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },

  'my-space/my-cash-wallet#convert': {
    title: 'Đổi sang điểm',
    steps: [
      {
        target: '#tour-section-root',
        title: '🔁 Quy đổi theo tỉ giá hiện hành',
        content: (
          <div className="space-y-2">
            <p>Tỉ giá do tổ chức đặt và có thể thay đổi. Số điểm nhận được tính theo tỉ giá tại thời điểm bạn bấm đổi.</p>
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-cash-wallet#topups': {
    title: 'Đơn nạp tiền',
    steps: [
      {
        target: '#tour-section-root',
        title: '🏦 Nạp bằng chuyển khoản',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi lệnh nạp có nội dung chuyển khoản riêng và một khoảng thời gian hiệu lực. Chuyển đúng
              nội dung thì hệ thống tự khớp và cộng tiền.
            </p>
            {warn('Ghi sai nội dung chuyển khoản thì lệnh không tự khớp được, phải nhờ người quản trị đối soát tay.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-cash-wallet#history': {
    title: 'Lịch sử ví',
    steps: [
      {
        target: '#tour-section-root',
        title: '🧾 Mọi biến động số dư',
        content: <p>Nạp, đổi sang điểm và các điều chỉnh khác, kèm thời điểm và lý do.</p>,
        placement: 'top',
      },
    ],
  },
}

export default mySpaceTours
