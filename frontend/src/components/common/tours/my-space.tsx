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
        target: '#tour-my-rewards-balance',
        title: '🎁 Điểm thưởng của bạn',
        content: (
          <div className="space-y-2">
            <p>
              Thẻ này là số dư điểm hiện có. Điểm tới từ ba nguồn: quản lý trao tay, chương trình tự động,
              và điểm danh hằng ngày.
            </p>
            {note('Bảng tin phía trên là hoạt động thưởng của cả tổ chức — xem người khác được ghi nhận vì việc gì.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-my-rewards-checkin',
        title: '📅 Thẻ điểm danh nằm ngoài tab',
        content: (
          <div className="space-y-2">
            <p>
              Thẻ điểm danh đặt ngay dưới số dư, <strong>trên</strong> hàng tab — cố ý như vậy: nếu nó nằm
              trong một tab thì hôm nào bạn không mở đúng tab đó là mất chuỗi.
            </p>
            {warn('Chuỗi ngày liên tiếp bị đứt là mất luôn phần thưởng chuỗi, phải gây lại từ đầu.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-local-tabs',
        title: '🗂️ Bốn tab: tiêu, xem, khoe, nhận',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Cửa hàng quà</strong> để đổi điểm, <strong>Lịch sử điểm</strong> để xem điểm đến và
              đi từ đâu, <strong>Chứng nhận</strong> để tải giấy khen, <strong>Quà đã đổi</strong> để theo
              dõi món đang chờ nhận.
            </p>
            {note('Con số trên mỗi tab là số bản ghi đang có trong tab đó.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'my-space/my-rewards#shop': {
    title: 'Cửa hàng quà',
    steps: [
      {
        target: '#tour-gift-shop-grid',
        title: '🛍️ Đổi điểm lấy quà',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi thẻ hiện giá theo điểm và số lượng còn lại. Món chưa đủ điểm ghi rõ bạn còn{' '}
              <strong>thiếu bao nhiêu</strong>, khỏi phải nhẩm.
            </p>
            {note('Hết hàng và thiếu điểm là hai chuyện khác nhau: hết hàng thì chờ cũng vô ích, thiếu điểm thì tích thêm là đổi được.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-gift-shop-grid',
        title: '⚠️ Điểm trừ ngay lúc bấm',
        content: (
          <div className="space-y-2">
            <p>
              Bấm đổi là điểm bị trừ ngay, trước khi quà được giao. Yêu cầu chuyển sang tab{' '}
              <strong>Quà đã đổi</strong> chờ người phụ trách xác nhận.
            </p>
            {warn('Không có nút hoàn lại. Cân nhắc trước khi bấm, nhất là với món giá cao.')}
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
        target: '#tour-my-rewards-history',
        title: '🧾 Điểm đến và đi từ đâu',
        content: (
          <div className="space-y-2">
            <p>
              Từng dòng ghi rõ lý do, người trao và thời điểm. Đây là chỗ đối chiếu khi bạn thấy số dư
              không khớp với những gì mình nhớ.
            </p>
            {note('Danh sách chia trang khi dài — dùng thanh phân trang ở cuối để lùi về các tháng trước.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-rewards#certificates': {
    title: 'Chứng nhận',
    steps: [
      {
        target: '#tour-my-certificates-grid',
        title: '🏅 Giấy khen của bạn',
        content: (
          <div className="space-y-2">
            <p>
              Không phải lần thưởng nào cũng có giấy khen — chỉ những lần cấp trên chọn kèm chứng nhận mới
              hiện ở đây, để bạn tải về hoặc in ra.
            </p>
            {note('Công ty chưa dựng mẫu riêng thì màn hình in vẫn có sẵn vài thiết kế để chọn.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-rewards#redemptions': {
    title: 'Quà đã đổi',
    steps: [
      {
        target: '#tour-my-rewards-redemptions',
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
        target: '#tour-my-wallet-balance',
        title: '💰 Đây là tiền, không phải điểm',
        content: (
          <div className="space-y-2">
            <p>
              Ví giữ số dư tiền thật của bạn: nạp vào bằng chuyển khoản, và đổi được sang điểm thưởng theo
              tỉ giá tổ chức đặt.
            </p>
            {warn('Chiều đổi chỉ có một: tiền ra điểm được, điểm về lại tiền thì không.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-my-wallet-topup',
        title: '➕ Nạp tiền ở đâu cũng được',
        content: (
          <p>
            Nút <strong>Nạp tiền</strong> ở góc trên luôn có mặt, không phụ thuộc bạn đang mở tab nào. Bấm
            là hiện mã QR chuyển khoản kèm nội dung cần ghi.
          </p>
        ),
        placement: 'bottom',
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
        target: '#tour-my-wallet-convert',
        title: '🔁 Quy đổi theo tỉ giá hiện hành',
        content: (
          <div className="space-y-2">
            <p>
              Nhập số tiền muốn đổi, hệ thống hiện ngay số điểm nhận được. Tỉ giá do tổ chức đặt và có thể
              thay đổi — số điểm tính theo tỉ giá tại đúng thời điểm bạn bấm đổi.
            </p>
            {warn('Đổi xong thì không quay lại được. Đổi vừa đủ cho món quà định lấy, đừng đổi hết một lần.')}
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
        target: '#tour-my-wallet-topups',
        title: '🏦 Nạp bằng chuyển khoản',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi lệnh nạp có nội dung chuyển khoản riêng và một khoảng thời gian hiệu lực. Chuyển đúng nội
              dung thì hệ thống tự khớp và cộng tiền, thường trong vài phút.
            </p>
            {warn('Ghi sai nội dung chuyển khoản thì lệnh không tự khớp được, phải nhờ người quản trị đối soát tay.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-my-wallet-topups',
        title: '⏳ Mã QR có hạn',
        content: (
          <p>
            Đơn quá hạn thì tự huỷ — tạo đơn mới rồi chuyển lại. Đừng chuyển theo mã QR cũ đã hết hạn, tiền
            sẽ rơi vào diện chờ đối soát tay.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-cash-wallet#history': {
    title: 'Lịch sử ví',
    steps: [
      {
        target: '#tour-my-wallet-history',
        title: '🧾 Mọi biến động số dư',
        content: (
          <div className="space-y-2">
            <p>Nạp, đổi sang điểm và các điều chỉnh khác, kèm thời điểm và lý do.</p>
            {note('Đây là sổ gốc khi có khiếu nại: số dư hiện tại luôn bằng tổng các dòng ở đây.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'my-space/my-conduct': {
    steps: [
      {
        target: '#tour-my-conduct-target',
        title: '🤝 Tự chấm hạnh kiểm',
        content: (
          <div className="space-y-2">
            <p>
              Chọn <strong>một đợt</strong> hoặc <strong>cả kỳ</strong> để mở phiếu. Chưa chọn thì chưa có
              phiếu nào hiện ra.
            </p>
            {note('Các ô số liệu trên card cho biết điểm bạn tự chấm, điểm quản lý đã cho, thang điểm, và bộ tiêu chí đang áp cho kỳ này.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-conduct-sheet',
        title: '📝 Dẫn chứng quan trọng hơn điểm',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi tiêu chí có ô điểm và ô <strong>dẫn chứng</strong>. Quản lý chấm dựa trên dẫn chứng bạn
              nêu, nên bỏ trống ô này là tự bỏ mất phần lập luận của mình.
            </p>
            {note('Cột trọng số cho biết tiêu chí nào nặng ký nhất — dồn dẫn chứng vào những tiêu chí đó trước.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-conduct-sheet-actions',
        title: '💾 Lưu và xuất',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Lưu tự đánh giá</strong> ghi phần của bạn. <strong>Xuất Excel</strong> lấy nguyên
              phiếu ra tệp để lưu hoặc in.
            </p>
            {warn('Đơn vị đã chốt đánh giá kỳ thì phiếu chuyển sang chỉ xem — lúc đó phải nhờ quản lý mở khoá ở mục Đánh giá kỳ.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },
}

export default mySpaceTours
