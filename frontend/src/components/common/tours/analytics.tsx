import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'

/**
 * Hướng dẫn cho "Phân tích" — dòng sidebar và sáu góc nhìn bên trong.
 *
 * Trang này trước đó có đúng một bước giới thiệu lưới thẻ, còn sáu góc nhìn thì không
 * cái nào có hướng dẫn — trong khi đây lại là phần khách hàng hay hỏi "số này lấy ở
 * đâu ra" nhất.
 *
 * Sáu góc nhìn dựng theo cùng một khuôn — thanh lọc dính đầu trang, dãy ô chỉ số, rồi
 * lưới widget — nên chúng dùng CHUNG một bộ neo: `#tour-analytics-filter`,
 * `#tour-analytics-metrics`, `#tour-analytics-customize`, `#tour-analytics-widgets`.
 * Dùng chung được vì mỗi lúc chỉ có đúng một mục được vẽ ra, không bao giờ hai mục cùng
 * tồn tại để đụng id. Hai mục lệch khuôn (Phân cấp, Hạng mục BSC) có neo riêng.
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

const analyticsTours: Record<TourKey, TourDef> = {
  /* ══════════ Cấp trang ══════════ */
  'analytics': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: '🔭 Hai cụm, hai tầm nhìn',
        content: (
          <div className="space-y-2">
            <p>
              Cụm <strong>Kết quả</strong> nhìn từ trong ra: của riêng bạn, rồi của đơn vị bạn phụ trách.
            </p>
            <p>
              Cụm <strong>Toàn tổ chức</strong> nhìn từ trên xuống: so sánh giữa các đơn vị theo từng
              cấp, và kết quả theo hạng mục của bộ tiêu chí.
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
              Cụm Kết quả đổi hẳn theo cấu hình tổ chức: <strong>bật OKR</strong> thì xem theo mục tiêu
              và kết quả then chốt; <strong>tắt OKR</strong> thì xem theo chỉ tiêu KPI.
            </p>
            <p className="text-[11px] text-slate-500">
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
        target: '#tour-analytics-filter',
        title: '🗓️ Chọn khoảng thời gian trước',
        content: (
          <div className="space-y-2">
            <p>
              Thanh lọc này dính ở đầu trang và áp cho <strong>tất cả</strong> biểu đồ bên dưới — không
              có biểu đồ nào lọc riêng. Chọn theo đợt, theo kỳ, hoặc theo khoảng ngày tự do.
            </p>
            {note('Thanh lọc dính lại khi cuộn, nên đang xem biểu đồ ở cuối trang vẫn đổi kỳ được mà không phải cuộn ngược lên.')}
          </div>
        ),
        placement: 'bottom',
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
              Bấm <strong>Tuỳ chỉnh</strong> để kéo thả đổi vị trí, đổi bề rộng, ẩn khối không dùng hoặc
              thêm biểu đồ mới từ thư viện.
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
        target: '#tour-analytics-filter',
        title: '⏱️ Đổi kỳ là đổi cả trang',
        content: (
          <p>
            Mọi con số ở trên đều tính theo khoảng thời gian chọn ở đây. So sánh hai kỳ thì đổi bộ lọc rồi
            đọc lại cùng một ô, đừng so ô của kỳ này với ô của kỳ khác.
          </p>
        ),
        placement: 'bottom',
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
            <ul className="text-[11px] space-y-1.5 list-disc pl-4 text-slate-500 font-medium">
              <li><strong className="text-slate-900 dark:text-white">Phân bổ trạng thái KPI:</strong> việc của tôi đang đọng ở khâu nào.</li>
              <li><strong className="text-slate-900 dark:text-white">Trạng thái bài nộp:</strong> tôi có đang trễ bài nào không.</li>
              <li><strong className="text-slate-900 dark:text-white">Xu hướng điểm số:</strong> tôi đang tiến bộ hay đi xuống qua các đợt.</li>
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
        target: '#tour-analytics-filter',
        title: '🗓️ Một bộ lọc cho cả trang',
        content: (
          <p>
            Đợt, kỳ hoặc khoảng ngày chọn ở đây áp cho mọi khối bên dưới. Muốn xem lại một đợt cũ thì đổi
            ở đây, không phải tìm bộ lọc riêng trong từng biểu đồ.
          </p>
        ),
        placement: 'bottom',
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
              <strong>Tuỳ chỉnh</strong> mở chế độ sửa bố cục: kéo thả sắp xếp, đổi bề rộng, ẩn khối không
              dùng, hoặc <strong>Thêm biểu đồ</strong> từ thư viện.
            </p>
            {note('Bố cục nhớ riêng cho tài khoản bạn, không ảnh hưởng tới người khác. Có cả bố cục gợi ý để bắt đầu nhanh.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-filter',
        title: '🗓️ Đổi kỳ ở một chỗ duy nhất',
        content: (
          <p>
            Thanh lọc dính đầu trang áp cho toàn bộ khối bên dưới. Cuộn xuống bao xa cũng đổi kỳ được mà
            không phải quay lên.
          </p>
        ),
        placement: 'bottom',
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
            Nút sao chép cạnh nhan đề bảng chụp lại đúng bảng đang xem để dán thẳng vào email hay slide
            họp, khỏi phải chụp màn hình rồi cắt.
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
        title: '🧭 Bốn con số của bộ tiêu chí',
        content: (
          <div className="space-y-2">
            <p>
              Điểm BSC trung bình, hạng mục <strong>mạnh nhất</strong>, hạng mục <strong>yếu nhất</strong>,
              và <strong>độ phủ</strong> — tỉ lệ KPI đã được gán vào một hạng mục.
            </p>
            {warn('Độ phủ chưa đạt 100% nghĩa là còn KPI nằm ngoài bộ tiêu chí. Ở chế độ chấm chính thức, phần chưa gán sẽ chặn việc chốt đánh giá.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-bsc-balance',
        title: '🕸️ Radar cân bằng',
        content: (
          <div className="space-y-2">
            <p>
              Radar cho thấy bộ tiêu chí có <strong>cân</strong> không: hình càng đều thì các lĩnh vực càng
              phát triển đồng đều. Các thẻ bên phải là chi tiết từng hạng mục kèm trọng số và số KPI.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-analytics-filter',
        title: '⚖️ Điểm BSC so với điểm hệ thống',
        content: (
          <div className="space-y-2">
            <p>
              Phần đối chiếu ở cuối trang đặt cạnh nhau <strong>điểm hệ thống</strong> (kết quả KPI thông
              thường) và <strong>điểm BSC</strong> (kết quả quy đổi qua bộ tiêu chí), xem được theo đơn vị
              hoặc theo từng nhân sự.
            </p>
            {note('Hai bên lệch nhau nhiều nghĩa là trọng số trong bộ tiêu chí đang nhấn vào thứ khác với những gì KPI đang đo. Đó là tín hiệu để xem lại trọng số, không phải lỗi số liệu.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-analytics-metrics',
        title: '🔧 Sửa bộ tiêu chí ở đâu',
        content: (
          <p>
            Ở đây chỉ xem kết quả. Muốn thêm bớt hạng mục, đổi trọng số hay chuyển chế độ chấm thì sang
            "Thiết lập công cụ › Quản lý BSC".
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },
}

export default analyticsTours
