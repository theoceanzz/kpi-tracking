import { Step } from 'react-joyride'

/**
 * Nội dung hướng dẫn viết từ hồi mỗi màn hình còn là một dòng sidebar riêng.
 *
 * Vẫn đang chạy và vẫn đúng, nên được các file trong thư mục này dùng lại nguyên vẹn
 * thay vì chép tay sang chỗ mới — chép tay một đống JSX chỉ để đổi chỗ ở là cách chắc
 * chắn nhất để làm rơi mất một bước.
 *
 * Khác biệt với các file cùng thư mục: ở đây là mảng bước trần, không mang khoá. Khoá
 * ba tầng do file của từng trang gán. Viết lại màn nào thì bê nội dung vào file trang
 * đó và xoá mảng tương ứng khỏi đây.
 */

/**
 * Page tour definitions - each page has its own set of steps.
 * Steps only reference DOM targets that exist on that specific page.
 */

/* ─── KPI Criteria Page ─── */
export const kpiCriteriaSteps: Step[] = [
  {
    target: '#tour-kpi-toolbar',
    title: '🎯 Quản lý Chỉ tiêu Tập trung',
    content: (
      <div className="space-y-2">
        <p>Đây là công cụ lọc mạnh mẽ giúp quản lý dễ dàng tìm kiếm và theo dõi KPI của bất kỳ nhân viên nào trong kỳ đánh giá.</p>
        <p className="text-[11px] text-slate-500">Bạn có thể lọc theo phòng ban, trạng thái chỉ tiêu hoặc tìm đích danh một nhân viên cụ thể.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-kpi-add-btn',
    title: '✍️ Thiết lập Mục tiêu',
    content: (
      <div className="space-y-3">
        <p>Bắt đầu giao KPI cho đội ngũ của bạn. Hãy ghi nhớ nguyên tắc <strong>SMART</strong> (Cụ thể, Đo lường được, Khả thi, Thực tế, Có thời hạn).</p>
        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded text-[11px] text-amber-700 font-medium">
          ⚠️ QUAN TRỌNG: Hãy đảm bảo tổng trọng số (%) của các KPI cho một nhân viên phải đạt đúng 100% để hệ thống tính điểm chính xác.
        </div>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-kpi-tabs',
    title: '🔄 Luồng Phê duyệt',
    content: (
      <div className="space-y-2">
        <p>Theo dõi sát sao trạng thái của từng KPI từ lúc khởi tạo cho đến khi hoàn thành.</p>
        <p className="text-[11px] text-slate-500 italic">💡 Ghi nhớ: Chỉ những KPI ở trạng thái <strong>Đã duyệt (Approved)</strong> mới chính thức có hiệu lực và được tính vào kết quả đánh giá cuối kỳ.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    // Trước đây bước này trỏ vào `#tour-kpi-delegate-btn` — nút nằm TRONG menu "..." của
    // từng dòng, nên chỉ tồn tại lúc menu đang mở. Ngoài đời không bao giờ có neo đó và
    // TourHost lặng lẽ bỏ luôn bước này. Trỏ vào chính danh sách rồi chỉ đường tới menu.
    target: '#tour-kpi-list',
    title: '🌿 Phân rã Mục tiêu (Delegate)',
    content: (
      <div className="space-y-2">
        <p>
          Mỗi dòng có menu <strong>“…”</strong> ở cuối. Trong đó, <strong>Phân rã chỉ tiêu</strong> là
          phím tắt để <strong>ủy quyền/giao việc</strong> cho cấp dưới.
        </p>
        <p className="text-[11px] bg-cyan-50 dark:bg-cyan-900/20 p-2 rounded-lg text-cyan-700 italic border-l-4 border-cyan-400">
          Mẹo: Hệ thống sẽ tự động tạo một chỉ tiêu con liên kết với chỉ tiêu này, giúp việc theo dõi dòng chảy chỉ tiêu trở nên minh bạch và tự động hoàn toàn.
        </p>
        <p className="text-[11px] text-slate-500">
          Chỉ hiện khi tổ chức bật <strong>thác nước</strong> và chỉ tiêu đã ở trạng thái <strong>Đã duyệt</strong>.
        </p>
      </div>
    ),
    placement: 'top',
  },
]

/* ─── My KPI Page ─── */
export const myKpiSteps: Step[] = [
  {
    target: '#tour-my-kpi-toolbar',
    title: '📝 Bảng Mục tiêu Cá nhân',
    content: (
      <div className="space-y-2">
        <p>Chào mừng bạn! Mọi nhiệm vụ và mục tiêu bạn cần thực hiện trong kỳ này đều được tập trung tại đây.</p>
        <p className="text-[11px] text-indigo-600 font-bold italic">💡 Hãy kiểm tra kỹ các "Mục tiêu (Target)" mà quản lý đã giao để lập kế hoạch triển khai hiệu quả.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-my-kpi-table',
    title: '🚀 Theo dõi & Thực hiện',
    content: (
      <div className="space-y-3">
        <p>Các thông số quan trọng bạn cần nắm vững để tối ưu điểm số:</p>
        <ul className="text-[11px] space-y-2 list-disc pl-4 text-slate-500 font-medium">
          <li><strong className="text-slate-900">Đơn vị:</strong> Cách thức đo lường kết quả (VNĐ, %, Giờ, Sản phẩm...).</li>
          <li><strong className="text-slate-900">Trọng số:</strong> Mức độ ảnh hưởng của mục tiêu này đến tổng điểm cuối kỳ của bạn.</li>
          <li><strong className="text-slate-900">Tiến độ:</strong> Nhấn nút <strong>"Nộp bài"</strong> ngay khi bạn hoàn thành một phần hoặc toàn bộ chỉ tiêu để cập nhật kết quả.</li>
        </ul>
        <p className="text-[11px] bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg text-amber-700 italic border-l-4 border-amber-400">
          Mẹo: Nếu mục tiêu không còn phù hợp với thực tế, hãy sử dụng tính năng "Yêu cầu điều chỉnh" để gửi đề xuất lên cấp trên.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── My Submissions Page ─── */
export const mySubmissionsSteps: Step[] = [
  {
    target: '#tour-my-sub-tabs',
    title: '🚥 Trạng thái Bài nộp',
    content: (
      <div className="space-y-2">
        <p>Theo dõi sát sao tiến độ phê duyệt từ cấp trên đối với các báo cáo kết quả của bạn.</p>
        <p className="text-[11px] text-slate-500">
          Nếu bài nộp bị <strong>Từ chối (Rejected)</strong>, hãy đọc kỹ phần phản hồi của quản lý để chỉnh sửa và gửi lại ngay lập tức.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-my-sub-list',
    title: '📂 Nhật ký Công việc',
    content: (
      <div className="space-y-2">
        <p>Đây là kho lưu trữ toàn bộ lịch sử báo cáo và minh chứng bạn đã gửi đi.</p>
        <p className="text-[11px] bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-700 italic">
          💡 Bạn có thể sử dụng dữ liệu này để đối chiếu điểm số hoặc làm bằng chứng bảo vệ kết quả công việc khi kết thúc kỳ đánh giá.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── Org Unit Submissions (Approve) Page ─── */
export const orgUnitSubmissionsSteps: Step[] = [
  {
    target: '#tour-approve-stats',
    title: '📊 Tổng quan Xét duyệt',
    content: <p>Các số liệu tổng hợp giúp bạn nắm bắt nhanh khối lượng công việc đang chờ xử lý và tiến độ phê duyệt chung của toàn đơn vị.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-approve-toolbar',
    title: '⚡ Lọc & Ưu tiên',
    content: (
      <div className="space-y-2">
        <p>Sử dụng bộ lọc để ưu tiên phê duyệt các báo cáo quan trọng hoặc các nhân sự có hạn chót gần nhất.</p>
        <p className="text-[11px] text-slate-500 italic">💡 Bạn có thể lọc nhanh theo từng phòng ban con để quản lý tập trung hơn.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-approve-table',
    title: '🔍 Đánh giá Công tâm',
    content: (
      <div className="space-y-3">
        <p>Khi phê duyệt bài nộp, hãy nhấn vào từng dòng để xem chi tiết <strong>Tài liệu minh chứng</strong> mà nhân viên đã đính kèm.</p>
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded text-[11px] text-blue-700 font-medium">
          💡 Mẹo: Hãy để lại những lời nhận xét (Feedback) chân thành. Phản hồi tích cực hoặc góp ý xây dựng sẽ giúp nhân viên cải thiện hiệu suất rõ rệt trong các đợt tiếp theo.
        </div>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── KPI Pending Approval Page ─── */
export const kpiPendingSteps: Step[] = [
  {
    target: '#tour-pending-header',
    title: '🤝 Xét duyệt Mục tiêu',
    content: (
      <div className="space-y-2">
        <p>Đây là bước quan trọng nhất để đảm bảo nhân viên không đặt mục tiêu quá thấp hoặc quá xa rời thực tế.</p>
        <p className="text-[11px] text-indigo-600 font-bold italic">💡 Hãy thống nhất và phê duyệt mục tiêu ngay từ đầu kỳ để nhân viên có lộ trình làm việc rõ ràng.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-pending-toolbar',
    title: '🏢 Lọc Theo Đơn vị',
    content: <p>Duyệt theo từng phòng ban để đảm bảo tính công bằng và nhất quán về khối lượng công việc giữa các nhân sự có vị trí tương đương nhau.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-pending-tabs',
    title: '⚡ Xử lý Nhanh',
    content: (
      <div className="space-y-2">
        <p>Bạn có thể <strong>Phê duyệt hàng loạt</strong> các KPI đã đạt chuẩn để đẩy nhanh tiến độ thiết lập mục tiêu cho cả bộ phận.</p>
        <p className="text-[11px] text-slate-500 italic">Mẹo: Chỉ phê duyệt khi bạn đã chắc chắn các chỉ tiêu tuân thủ đúng định hướng của công ty.</p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── KPI Adjustment Approval Page ─── */
export const kpiAdjustmentsSteps: Step[] = [
  {
    target: '#tour-adj-header',
    title: '🔄 Kiểm soát Thay đổi',
    content: (
      <div className="space-y-2">
        <p>Trong quá trình làm việc, nếu có những biến động khách quan từ thị trường hoặc tổ chức, nhân viên có thể gửi yêu cầu <strong>điều chỉnh số liệu</strong>.</p>
        <p className="text-[11px] text-indigo-600 font-bold">⚠️ Bạn là người quyết định cuối cùng có chấp thuận các thay đổi này hay không.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-adj-toolbar',
    title: '🚥 Lọc Yêu cầu Cấp bách',
    content: <p>Các yêu cầu điều chỉnh thường mang tính thời điểm. Hãy ưu tiên xử lý các mục có <strong>đếm ngược thời gian</strong> sắp hết để đảm bảo tính kỷ luật dữ liệu.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-adj-tabs',
    title: '📎 Bằng chứng Thay đổi',
    content: (
      <div className="space-y-2">
        <p>Nhấn vào yêu cầu để xem <strong>Lý do chi tiết</strong> mà nhân viên đưa ra.</p>
        <p className="text-[11px] bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg text-amber-700 italic border-l-4 border-amber-400">
          💡 Chỉ chấp thuận khi lý do thực sự hợp lý, khách quan và có minh chứng đi kèm nếu cần thiết.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── My Adjustments Page ─── */
export const myAdjustmentsSteps: Step[] = [
  {
    target: '#tour-myadj-header',
    title: '🔄 Yêu cầu của Bạn',
    content: <p>Nơi lưu trữ và theo dõi trạng thái các mong muốn điều chỉnh mục tiêu mà bạn đã gửi lên cấp trên.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-myadj-table',
    title: '⏳ Theo dõi Hạn xử lý',
    content: (
      <div className="space-y-3">
        <p>Lưu ý: Mỗi yêu cầu chỉ có thời hạn <strong>24 giờ</strong> để quản lý phê duyệt.</p>
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded text-[11px] text-red-700 italic">
          ⚠️ Nếu quá hạn, yêu cầu sẽ tự động bị đóng để đảm bảo tính kỷ luật của dữ liệu hệ thống. Nếu bị từ chối, hãy đọc kỹ nhận xét để bổ sung lý do thuyết phục hơn cho lần sau.
        </div>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── Evaluations Page ─── */
export const evaluationsSteps: Step[] = [
  {
    target: '#tour-eval-header',
    title: '📈 Kết quả Hiệu suất',
    content: (
      <div className="space-y-2">
        <p>Đây là "bảng điểm" cuối cùng phản ánh nỗ lực của bạn hoặc đội ngũ trong suốt kỳ đánh giá.</p>
        <p className="text-[11px] text-indigo-600 font-bold italic">💡 Kết quả này là cơ sở quan trọng nhất cho các chính sách Khen thưởng, Thăng tiến và Đào tạo của công ty.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-eval-filters',
    title: '📂 Tra cứu Lịch sử',
    content: <p>Dễ dàng tra cứu lại kết quả từ nhiều kỳ trước đó để theo dõi <strong>biểu đồ tăng trưởng năng lực</strong> và sự tiến bộ của nhân viên theo thời gian.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-eval-table',
    title: '🏆 Bảng Xếp hạng',
    content: (
      <div className="space-y-2">
        <p>Nhấn vào từng dòng để xem <strong>Chi tiết Đánh giá</strong>.</p>
        <p className="text-[11px] text-slate-500 italic">Tại đây bạn có thể đối chiếu sự chênh lệch giữa Điểm tự chấm của nhân viên và Điểm phê duyệt cuối cùng của quản lý.</p>
      </div>
    ),
    placement: 'bottom',
  },
]

