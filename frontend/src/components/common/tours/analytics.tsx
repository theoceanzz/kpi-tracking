import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'

/**
 * Hướng dẫn cho "Phân tích" — dòng sidebar và sáu góc nhìn bên trong.
 *
 * Trang này trước đó có đúng một bước giới thiệu lưới thẻ, còn sáu góc nhìn thì không
 * cái nào có hướng dẫn — trong khi đây lại là phần khách hàng hay hỏi "số này lấy ở
 * đâu ra" nhất.
 *
 * Sáu góc nhìn dựng theo cùng một khuôn — tiêu đề + nút Thêm biểu đồ, rồi lưới widget (hàng
 * ô chỉ số là ô đầu lưới) — nên chúng dùng CHUNG một bộ neo: `#tour-analytics-metrics`,
 * `#tour-analytics-customize`, `#tour-analytics-widgets`. Không còn bộ lọc cấp trang: đơn vị và
 * khoảng thời gian nằm trong bảng cấu hình của từng ô.
 * Dùng chung được vì mỗi lúc chỉ có đúng một mục được vẽ ra, không bao giờ hai mục cùng
 * tồn tại để đụng id. Hai mục So sánh các đơn vị và Hạng mục BSC có thêm neo riêng.
 */

const note = (text: string) => (
  <p className="text-xs bg-[var(--color-primary-soft)] p-2 rounded-control text-[var(--color-primary)] font-medium italic">
    💡 {text}
  </p>
)

const warn = (text: string) => (
  <p className="text-xs bg-[var(--color-warning-bg)] p-2 rounded-control text-[var(--color-warning)] font-medium italic border-l-4 border-[var(--color-warning-border)]">
    ⚠️ {text}
  </p>
)

const analyticsTours: Record<TourKey, TourDef> = {
  /* ══════════ Cấp trang ══════════ */
  'analytics': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: '🔭 Ba cụm, ba tầm nhìn',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Của tôi</strong> là kết quả của riêng bạn. <strong>Đơn vị</strong> là đơn vị bạn phụ
              trách, và so sánh đơn vị đó với các đơn vị khác trong công ty.
            </p>
            <p>
              <strong>Toàn tổ chức</strong> nhìn từ trên xuống theo từng hạng mục của bộ tiêu chí.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-settings-nav',
        title: '🔀 Thấy OKR hay thấy KPI',
        content: (
          <div className="space-y-2">
            <p>
              Hai cụm đầu đổi theo cấu hình tổ chức: <strong>bật OKR</strong> thì xem theo mục tiêu
              và kết quả then chốt; <strong>tắt OKR</strong> thì xem theo chỉ tiêu KPI.
            </p>
            <p className="text-caption">
              Không phải hai bộ thẻ song song — mỗi lúc chỉ một cặp hiện ra, nên bạn sẽ không thấy đủ cả
              bốn thẻ.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-settings-nav',
        title: '📅 Mọi con số đều theo kỳ',
        content: (
          <div className="space-y-2">
            <p>
              Trong mỗi góc nhìn đều có bộ chọn đợt hoặc kỳ. Số liệu chỉ có nghĩa khi bạn biết nó thuộc
              khoảng thời gian nào.
            </p>
            {warn('Thấy biểu đồ trống? Kiểm tra bộ chọn đợt trước khi kết luận là không có dữ liệu — thường là đang đứng ở một đợt chưa ai nộp gì.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Kết quả — bản OKR ══════════ */
  'analytics/my-objectives': {
    steps: [
      {
        target: '#tour-analytics-widgets',
        title: '🗓️ Mỗi ô tự chọn khoảng thời gian',
        content: (
          <div className="space-y-2">
            <p>
              Dưới tiêu đề mỗi ô có dòng chip cho biết ô đang theo <strong>khoảng thời gian nào</strong>.
              Bấm vào đó để mở bảng cấu hình: chọn theo đợt, theo kỳ, hoặc khoảng ngày tự do cho riêng ô ấy.
            </p>
            {note('Chip tô đậm là ô đã đặt khoảng riêng; chip nhạt là đang theo mặc định.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-metrics',
        title: '🎯 Mục tiêu của bạn đang tới đâu',
        content: (
          <div className="space-y-2">
            <p>
              Dãy ô này tóm tắt toàn bộ mục tiêu bạn đang nắm. Tiến độ của một mục tiêu là tổng hợp từ
              các kết quả then chốt bên dưới nó, không nhập tay.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: '📈 Xu hướng quan trọng hơn con số hôm nay',
        content: (
          <div className="space-y-2">
            <p>
              Biểu đồ xu hướng cho biết bạn đang tăng tốc hay chững lại. Đạt 60% ở giữa kỳ mà đường đi
              ngang thì đáng lo hơn là 40% mà đang dốc lên.
            </p>
            {note('Bảng "Chi tiết mục tiêu" bên dưới nối mục tiêu với các chỉ tiêu cụ thể đang đẩy nó đi.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-customize',
        title: '🧱 Màn hình này sắp xếp lại được',
        content: (
          <div className="space-y-2">
            <p>
              Rê chuột lên một ô rồi nắm cụm chấm để kéo đổi vị trí, kéo mép để đổi cỡ; bấm{' '}
              <strong>Thêm biểu đồ</strong> để lấy thêm từ thư viện. Mọi thay đổi tự lưu.
            </p>
            {note('Bố cục nhớ riêng cho tài khoản của bạn, không ảnh hưởng tới ai khác. Lỡ tay thì có nút đặt lại mặc định.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'analytics/subordinate': {
    steps: [
      {
        target: '#tour-analytics-metrics',
        title: '👥 Mục tiêu của cả đơn vị',
        content: (
          <div className="space-y-2">
            <p>
              Năm ô: tiến độ tổng quan, hiệu suất tổng quan, số mục tiêu đã hoàn thành, số mục tiêu đang
              ở diện rủi ro, và tổng nhân sự thuộc phạm vi bạn quản lý.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-metrics',
        title: '🚨 Nhìn vào ô rủi ro trước',
        content: (
          <div className="space-y-2">
            <p>
              Ô <strong>Mục tiêu rủi ro</strong> đã lọc sẵn phần tiến độ thấp và sắp hết hạn — đó là thứ
              đáng xem đầu tiên mỗi tuần.
            </p>
            {warn('Mục tiêu vào diện rủi ro thường không tự thoát ra. Xử lý lúc còn nửa kỳ thì kịp; để tới cuối kỳ thì chỉ còn cách giải thích.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: '🧑‍🤝‍🧑 Xuống tới từng người',
        content: (
          <p>
            Khối <strong>Nhân sự &amp; vai trò theo đơn vị</strong> cho biết ai đang gánh mục tiêu nào, để
            nhận ra người quá tải và người chưa được giao gì. Khối{' '}
            <strong>Hiệu suất &amp; Tiến độ đơn vị</strong> so các đơn vị con với nhau.
          </p>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-widgets',
        title: '⏱️ Đổi kỳ ngay trên từng ô',
        content: (
          <p>
            Mỗi ô tính theo khoảng thời gian ghi ở dòng chip dưới tiêu đề — bấm chip để đổi. So sánh hai
            kỳ thì đổi khoảng rồi đọc lại cùng một ô, đừng so ô của kỳ này với ô của kỳ khác.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Kết quả — bản KPI ══════════ */
  'analytics/my': {
    steps: [
      {
        target: '#tour-analytics-metrics',
        title: '📊 Kết quả của riêng bạn',
        content: (
          <div className="space-y-2">
            <p>
              Năm ô tóm tắt: chỉ tiêu đang đảm nhiệm, tiến độ, điểm số và tình trạng bài nộp qua các đợt
              đã chấm.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: '🥧 Ba khối trả lời ba câu hỏi',
        content: (
          <div className="space-y-2">
            <ul className="text-xs space-y-1.5 list-disc pl-4 text-[var(--color-muted-foreground)] font-medium">
              <li><strong className="text-[var(--color-foreground)]">Phân bổ trạng thái KPI:</strong> việc của tôi đang đọng ở khâu nào.</li>
              <li><strong className="text-[var(--color-foreground)]">Trạng thái bài nộp:</strong> tôi có đang trễ bài nào không.</li>
              <li><strong className="text-[var(--color-foreground)]">Xu hướng điểm số:</strong> tôi đang tiến bộ hay đi xuống qua các đợt.</li>
            </ul>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-widgets',
        title: '🧾 Đối chiếu trước khi thắc mắc',
        content: (
          <div className="space-y-2">
            <p>
              Bảng <strong>Lịch sử đánh giá</strong> ghi lại điểm và nhận xét của từng đợt. Thấy điểm không
              như mong đợi thì xem ở đây trước khi hỏi quản lý — thường lý do đã nằm sẵn trong nhận xét.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-widgets',
        title: '🗓️ Mỗi ô một khoảng thời gian',
        content: (
          <p>
            Đợt, kỳ hoặc khoảng ngày của từng ô ghi ở dòng chip dưới tiêu đề — bấm vào để đổi cho riêng ô
            đó. Muốn xem lại một đợt cũ thì mở đúng ô muốn xem.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'analytics/summary': {
    steps: [
      {
        target: '#tour-analytics-metrics',
        title: '🏛️ Bức tranh của đơn vị bạn',
        content: (
          <div className="space-y-2">
            <p>
              Tổng hợp KPI của đơn vị bạn phụ trách: tiến độ chung, tỉ lệ trễ hạn, xếp hạng nhân sự và các
              điểm rủi ro — tất cả theo khoảng thời gian đang lọc.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: '⚠️ Hai loại rủi ro, đừng nhầm',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Rủi ro đơn vị</strong> là cả phòng ban đang chậm so với kế hoạch.{' '}
              <strong>Rủi ro thành viên</strong> là một vài cá nhân kéo tụt phần còn lại.
            </p>
            {note('Cách xử lý khác hẳn nhau: cái đầu là vấn đề mục tiêu đặt quá cao hoặc thiếu nguồn lực, cái sau là chuyện của từng người.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-customize',
        title: '🧱 Tự chọn biểu đồ muốn xem',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Thêm biểu đồ</strong> lấy thêm từ thư viện; trên ô thì nắm cụm chấm để kéo thả, kéo
              mép để đổi cỡ, menu góc phải để cấu hình, ghim hoặc xoá.
            </p>
            {note('Bố cục nhớ riêng cho tài khoản bạn, không ảnh hưởng tới người khác. Lỡ tay thì có nút đặt lại mặc định trong thư viện.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-widgets',
        title: '🗓️ Đơn vị và khoảng thời gian nằm ở từng ô',
        content: (
          <p>
            Dòng chip dưới tiêu đề mỗi ô ghi ô đó đang xem <strong>đơn vị nào</strong>, <strong>khoảng
            thời gian nào</strong>. Bấm vào để đổi cho riêng ô đó — không có bộ lọc chung cho cả trang.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Toàn tổ chức ══════════ */
  'analytics/drilldown': {
    steps: [
      {
        target: '#tour-drilldown-tree',
        title: '🌳 Cây đơn vị bên trái',
        content: (
          <div className="space-y-2">
            <p>
              Bắt đầu ở cấp cao nhất rồi bấm vào một đơn vị để đi xuống cấp dưới của nó — cứ thế tới tận
              từng nhân sự.
            </p>
            {note('Trên màn hình hẹp, cây nằm sau nút "Chọn đơn vị" ở đầu phần nội dung.')}
          </div>
        ),
        placement: 'right',
      },
      {
        target: '#tour-drilldown-banner',
        title: '📍 Bạn đang đứng ở đâu',
        content: (
          <p>
            Dải màu ghi tên đơn vị đang chọn, cấp của nó, số nhân sự và tổng số KPI. Đây là mốc để biết
            mọi con số bên dưới đang nói về phạm vi nào.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-drilldown-members',
        title: '🔲 Phân bố quan trọng hơn trung bình',
        content: (
          <div className="space-y-2">
            <p>
              Bảng thành viên và ma trận xếp loại cho thấy nhân sự phân bố ra sao giữa các hạng. Một đơn vị
              điểm trung bình đẹp nhưng dồn hết vào hạng giữa là chuyện khác hẳn với đơn vị có cả người
              xuất sắc lẫn người yếu.
            </p>
            {warn('Đừng xếp hạng đơn vị chỉ bằng một con số trung bình — hình dạng của phân bố mới nói lên điều cần xử lý.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-drilldown-members',
        title: '📋 Mang số liệu ra khỏi màn hình',
        content: (
          <p>
            Rê chuột lên ô, mở menu ở góc phải và chọn <strong>Sao chép ảnh</strong>: chụp lại đúng ô đang
            xem để dán thẳng vào email hay slide họp, khỏi phải chụp màn hình rồi cắt.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'analytics/bsc': {
    steps: [
      {
        target: '#tour-analytics-metrics',
        title: '🧭 Sức khoẻ BSC của đợt',
        content: (
          <div className="space-y-2">
            <p>
              Bốn con số của thẻ điểm trong đợt: <strong>mức đạt BSC</strong> so với mục tiêu 100%, số{' '}
              <strong>thẻ điểm đơn vị</strong> đang áp dụng, bao nhiêu đơn vị <strong>qua hạng mục chặn</strong>,
              và <strong>độ phủ phân rã</strong> — chỉ tiêu đã giao xuống đơn vị đủ hay thiếu.
            </p>
            {warn('Ô báo "chưa tính kết quả" nghĩa là đợt đó chưa bấm Tính lại ở tab Kết quả đợt của thẻ điểm. Số ở đây đọc kết quả đã tính, không tự bịa.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-bsc-balance',
        title: '🏢 Mức đạt của từng đơn vị',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi đơn vị một chấm mức đạt, vạch đứng là mục tiêu 100%. Chấm <strong>đỏ</strong> là đơn vị không
              qua cửa chặn dù tổng điểm có thể vẫn cao. Chuyển sang "Theo cây" trong bảng cấu hình để xem
              đúng thứ tự công ty → phòng → team kèm trạng thái thẻ.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-widgets',
        title: '🎯 Chỉ tiêu, xu hướng và phân rã',
        content: (
          <div className="space-y-2">
            <p>
              Ô <strong>Mức đạt từng chỉ tiêu</strong> đặt thực tế cạnh mục tiêu và sàn của từng dòng trên thẻ điểm;{' '}
              <strong>Xu hướng</strong> vẽ mức đạt qua các đợt, tách được theo 4 lĩnh vực;{' '}
              <strong>Độ phủ phân rã</strong> cho biết chỉ tiêu nào đã giao xuống đơn vị đủ, thiếu hay vượt.
            </p>
            {note('Mỗi ô tự chọn đơn vị và đợt trong bảng cấu hình. Ô "một đợt" lấy đợt muộn nhất có kết quả trong khoảng bạn chọn.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-metrics',
        title: '🔧 Sửa thẻ điểm ở đâu',
        content: (
          <p>
            Ở đây chỉ xem kết quả. Muốn thêm bớt chỉ tiêu, đổi trọng số, phân rã xuống đơn vị hay tính lại
            kết quả đợt thì sang "Thiết lập công cụ › Quản lý BSC".
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },
}

export default analyticsTours
