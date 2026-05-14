import { Step } from 'react-joyride'
import type { TourPageKey } from '@/store/tourStore'

/**
 * Page tour definitions - each page has its own set of steps.
 * Steps only reference DOM targets that exist on that specific page.
 */

/* ─── Dashboard: Director ─── */
export const directorDashboardSteps: Step[] = [
  {
    target: '#tour-dashboard-stats',
    title: '📊 Chỉ số Sức khỏe Tổ chức',
    content: (
      <div className="space-y-3">
        <p>Chào mừng Giám đốc! Đây là cái nhìn toàn cảnh về quy mô và hiệu suất hiện tại của toàn doanh nghiệp:</p>
        <ul className="text-[11px] space-y-2 list-disc pl-4 text-slate-500 font-medium">
          <li><strong className="text-slate-900">Phòng ban:</strong> Tổng số đơn vị đang vận hành trong sơ đồ tổ chức.</li>
          <li><strong className="text-slate-900">Nhân sự:</strong> Số lượng nhân viên đã được kích hoạt tài khoản trên hệ thống.</li>
          <li><strong className="text-slate-900">Chỉ tiêu:</strong> Tổng lượng KPI đang được theo dõi và thực hiện trong kỳ này.</li>
          <li><strong className="text-slate-900">Đánh giá:</strong> Điểm hiệu suất trung bình của toàn công ty dựa trên kỳ gần nhất.</li>
        </ul>
        <p className="text-[11px] text-indigo-600 font-bold italic">💡 Theo dõi các chỉ số này hàng ngày để nắm bắt nhịp độ phát triển của công ty.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-dashboard-approve-btn',
    title: '⚡ Phê duyệt Nhanh',
    content: (
      <div className="space-y-2">
        <p>Để đảm bảo vận hành không bị gián đoạn, bạn có thể <strong>xử lý nhanh các yêu cầu quan trọng</strong> ngay tại đây.</p>
        <p className="text-[11px] bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg italic text-amber-700">
          Mẹo: Hệ thống sẽ tự động tổng hợp các mục đang "nóng" cần sự phản hồi của bạn nhất để tối ưu thời gian quản lý.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-dashboard-completion',
    title: '📈 Xu hướng Hoàn thành',
    content: (
      <div className="space-y-2">
        <p>Biểu đồ này giúp bạn theo dõi xu hướng hoàn thành mục tiêu theo thời gian thực của toàn bộ tổ chức.</p>
        <p className="text-[11px] text-slate-500">
          Nhận diện sớm các giai đoạn "nút thắt cổ chai" hoặc các phòng ban đang bị tụt lại phía sau để có những điều chỉnh chiến lược kịp thời trước khi kết thúc kỳ đánh giá.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-dashboard-tabs',
    title: '🔍 Phân tích Đa chiều',
    content: (
      <div className="space-y-2">
        <p>Chuyển đổi linh hoạt giữa các góc nhìn để quản lý hiệu quả hơn:</p>
        <ul className="text-[11px] space-y-1 list-disc pl-4 text-slate-500">
          <li><strong>Cơ cấu:</strong> Xem hiệu suất theo từng phòng ban, đơn vị.</li>
          <li><strong>Nhân sự:</strong> Đi sâu vào từng cá nhân để vinh danh những người xuất sắc nhất.</li>
        </ul>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── Dashboard: Head ─── */
export const headDashboardSteps: Step[] = [
  {
    target: '#tour-dashboard-stats',
    title: '👥 Hiệu suất Đội ngũ',
    content: (
      <div className="space-y-2">
        <p>Chào Trưởng đơn vị! Hãy tập trung vào 3 con số ảnh hưởng trực tiếp đến hiệu quả vận hành của bộ phận bạn:</p>
        <ul className="text-[11px] space-y-2 list-disc pl-4 text-slate-500 font-medium">
          <li><strong className="text-slate-900">KPI Chờ duyệt:</strong> Các mục tiêu nhân viên vừa thiết lập, cần bạn kiểm tra và xác nhận tính thực tế.</li>
          <li><strong className="text-slate-900">Báo cáo mới:</strong> Các kết quả công việc nhân viên vừa nộp, hãy đánh giá chúng ngay.</li>
          <li><strong className="text-slate-900">Tỷ lệ hoàn thành:</strong> Mức độ bám sát mục tiêu trung bình của cả phòng ban.</li>
        </ul>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-dashboard-approve-btn',
    title: '🎯 Trung tâm Phê duyệt',
    content: (
      <div className="space-y-2">
        <p>Truy cập nhanh vào trung tâm phê duyệt để <strong>đánh giá các bài nộp</strong> của nhân viên.</p>
        <p className="text-[11px] text-indigo-600 font-bold italic">💡 Phản hồi nhanh và công tâm từ bạn sẽ giúp nhân viên có thêm động lực hoàn thành các mục tiêu tiếp theo.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-dashboard-completion',
    title: '📈 Theo dõi Tiến độ',
    content: (
      <div className="space-y-2">
        <p>Biểu đồ này giúp bạn biết phòng ban mình đang ở đâu so với mục tiêu đề ra cho cả kỳ.</p>
        <p className="text-[11px] text-amber-600 font-bold">Nếu đường biểu đồ đi xuống hoặc đi ngang quá lâu, hãy kiểm tra ngay danh sách các bài nộp đang bị trễ hoặc gặp khó khăn.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-dashboard-tabs',
    title: '🏆 Vinh danh & Hỗ trợ',
    content: (
      <div className="space-y-2">
        <p>Nơi vinh danh những cá nhân xuất sắc nhất và nhận diện sớm các nhân sự đang gặp khó khăn trong công việc.</p>
        <p className="text-[11px] text-slate-500">Bạn có thể nhấn trực tiếp vào tên từng nhân viên để xem chi tiết lý do tại sao kết quả của họ chưa đạt như kỳ vọng.</p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── Dashboard: Staff ─── */
export const staffDashboardSteps: Step[] = [
  {
    target: '#tour-staff-stats',
    title: '⭐ Kết quả của Bạn',
    content: (
      <div className="space-y-2">
        <p>Mọi nỗ lực và đóng góp của bạn đều được cụ thể hóa bằng những con số minh bạch:</p>
        <ul className="text-[11px] space-y-2 list-disc pl-4 text-slate-500">
          <li><strong className="text-slate-900">Tỷ lệ Phê duyệt:</strong> Phần trăm các bài nộp được quản lý chấp nhận trên tổng số.</li>
          <li><strong className="text-slate-900">Điểm số hiện tại:</strong> Điểm KPI trung bình của bạn tính đến thời điểm này.</li>
        </ul>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-staff-tasks',
    title: '🔥 Nhiệm vụ Ưu tiên',
    content: (
      <div className="space-y-2">
        <p>Đây là danh sách các KPI quan trọng nhất bạn cần tập trung trong kỳ này.</p>
        <p className="text-[11px] bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-700 font-bold italic">
          💡 Hãy ưu tiên hoàn thành các mục có "Trọng số (%)" cao trước để tối ưu hóa điểm số của bạn một cách hiệu quả nhất.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-staff-submit',
    title: '📝 Báo cáo Kết quả',
    content: (
      <div className="space-y-2">
        <p>Đừng quên gửi báo cáo tiến độ định kỳ kèm theo các <strong>minh chứng cụ thể (ảnh, tài liệu, link công việc)</strong>.</p>
        <p className="text-[11px] text-slate-500">Minh chứng càng rõ ràng và đầy đủ thì quản lý của bạn sẽ phê duyệt càng nhanh chóng hơn!</p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── Company Page ─── */
export const companySteps: Step[] = [
  {
    target: '#tour-company-hero',
    title: '🏢 Bản sắc Doanh nghiệp',
    content: (
      <div className="space-y-2">
        <p>Nơi thiết lập các thông tin cơ bản nhất như Tên công ty, Slogan và Logo thương hiệu.</p>
        <p className="text-[11px] text-indigo-600 font-bold">⚠️ Những thông tin này sẽ xuất hiện trên mọi báo cáo PDF và các thông báo tự động gửi cho nhân viên.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-company-hierarchy',
    title: '🌳 Phân cấp Tổ chức',
    content: (
      <div className="space-y-2">
        <p>Xác định các <strong>Cấp bậc (Levels)</strong> trong công ty của bạn.</p>
        <ul className="text-[11px] space-y-1 list-disc pl-4 text-slate-500">
          <li>Việc phân cấp đúng giúp hệ thống tự động xác định luồng phê duyệt (ai duyệt cho ai).</li>
          <li><strong>Cấp 0</strong> luôn là cấp cao nhất (ví dụ: Giám đốc/Hội đồng quản trị).</li>
        </ul>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-company-scoring',
    title: '🏆 Quy chuẩn Xếp loại',
    content: (
      <div className="space-y-2">
        <p>Định nghĩa các ngưỡng điểm để hệ thống tự động xếp loại hiệu suất cho nhân viên.</p>
        <p className="text-[11px] bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg text-amber-700 italic border-l-4 border-amber-400">
          Ví dụ: Bạn có thể quy định từ 90-100 điểm là hạng A+, 80-89 điểm là hạng A. Hãy thiết lập thật kỹ vì nó ảnh hưởng đến các chính sách khen thưởng sau này.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-company-okr',
    title: '🎯 Mô hình OKR',
    content: (
      <div className="space-y-2">
        <p>Kích hoạt tính năng **OKR (Objectives and Key Results)** để liên kết chiến lược với vận hành.</p>
        <p className="text-[11px] text-slate-500">
          Khi bật, bạn có thể tạo các Mục tiêu định hướng và kết nối chúng trực tiếp với các chỉ số KPI đo lường hàng ngày.
        </p>
      </div>
    ),
    placement: 'right',
  },
  {
    target: '#tour-company-waterfall',
    title: '🌊 Mô hình Thác nước (Waterfall)',
    content: (
      <div className="space-y-2">
        <p>Bật tính năng này để cho phép <strong>Phân rã mục tiêu</strong> từ trên xuống dưới.</p>
        <p className="text-[11px] text-slate-500">
          Khi được bật, Quản lý có thể giao lại chỉ tiêu của mình cho cấp dưới và kết quả của nhân viên sẽ tự động cộng dồn ngược lên cho Quản lý.
        </p>
      </div>
    ),
    placement: 'right',
  },
]

/* ─── Roles Page ─── */
export const rolesSteps: Step[] = [
  {
    target: '#tour-roles-header',
    title: '🛡️ Quản lý Vai trò & Quyền hạn',
    content: (
      <div className="space-y-2">
        <p>Ma trận chức danh giúp chuẩn hóa tên gọi vị trí trong toàn bộ công ty.</p>
        <p className="text-[11px] text-slate-500">Tại đây, bạn có thể gán các <strong>quyền hạn (Permissions)</strong> cụ thể cho từng vai trò để kiểm soát ai có thể xem hoặc chỉnh sửa dữ liệu.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-roles-hierarchy-btn',
    title: '📐 Sơ đồ Phân cấp',
    content: <p>Nhấn vào đây để xem trực quan sơ đồ phân cấp giữa các chức danh. Điều này giúp bạn dễ dàng hình dung luồng báo cáo trong tổ chức.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-roles-stats',
    title: '📊 Thống kê Vai trò',
    content: <p>Tổng hợp nhanh số lượng nhân viên đang được gán cho từng nhóm vai trò chính.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-roles-table',
    title: '🔑 Kiểm soát Quyền hạn',
    content: (
      <div className="space-y-2">
        <p>Hãy cẩn trọng khi cấp các quyền như <strong>Admin</strong> hoặc <strong>Approve</strong>.</p>
        <p className="text-[11px] bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-red-700 italic">
          ⚠️ Những quyền này cho phép người dùng can thiệp trực tiếp vào dữ liệu của người khác hoặc thay đổi cấu hình hệ thống.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── Organization Structure Page ─── */
export const orgStructureSteps: Step[] = [
  {
    target: '#tour-org-view-mode',
    title: '👁️ Chế độ Xem linh hoạt',
    content: (
      <div className="space-y-2">
        <p>Hệ thống cung cấp hai cách nhìn về sơ đồ tổ chức:</p>
        <ul className="text-[11px] space-y-1 list-disc pl-4 text-slate-500">
          <li><strong>Sơ đồ (Mindmap):</strong> Cái nhìn trực quan về luồng quản lý và sự liên kết giữa các phòng ban.</li>
          <li><strong>Danh sách:</strong> Phù hợp khi bạn cần tìm kiếm nhanh hoặc chỉnh sửa thông tin hàng loạt.</li>
        </ul>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-org-content',
    title: '🏗️ Xây dựng Bộ máy',
    content: (
      <div className="space-y-2">
        <p>Tại đây, bạn có thể tạo mới các phòng ban, đơn vị và gán <strong>Trưởng đơn vị</strong> tương ứng.</p>
        <p className="text-[11px] text-amber-600 font-bold italic">
          💡 Lưu ý quan trọng: Một phòng ban không có Trưởng đơn vị sẽ khiến quy trình phê duyệt KPI tại đó bị tắc nghẽn.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── Users Page ─── */
export const usersSteps: Step[] = [
  {
    target: '#tour-users-header',
    title: '👥 Quản trị Nhân sự',
    content: <p>Đây là nơi tập trung quản lý toàn bộ tài khoản người dùng trong hệ thống.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-users-import',
    title: '📥 Import Excel',
    content: <p>Nếu công ty có số lượng nhân viên lớn, hãy sử dụng tính năng <strong>Import từ Excel</strong> để tiết kiệm thời gian thiết lập ban đầu.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-users-add',
    title: '➕ Thêm nhân viên mới',
    content: <p>Dùng để tạo nhanh tài khoản lẻ cho nhân viên mới gia nhập công ty.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-users-filters',
    title: '🔍 Tìm kiếm & Lọc',
    content: (
      <div className="space-y-2">
        <p>Bạn có thể lọc nhân viên theo phòng ban, vai trò hoặc trạng thái tài khoản.</p>
        <p className="text-[11px] text-slate-500 italic">Mẹo: Dễ dàng tìm ra các tài khoản đang bị khóa (Deactivated) để xử lý khi cần.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-users-table',
    title: '📝 Cấu hình Hồ sơ',
    content: (
      <div className="space-y-2">
        <p>Nhấn vào từng nhân viên để hoàn thiện hồ sơ của họ:</p>
        <ul className="text-[11px] space-y-1 list-disc pl-4 text-slate-500">
          <li>Gán vào <strong>Phòng ban</strong> cụ thể trong sơ đồ.</li>
          <li>Cấp <strong>Vai trò</strong> phù hợp với nhiệm vụ của họ.</li>
        </ul>
        <p className="text-[11px] text-indigo-600 font-bold">⚠️ Bước này là bắt buộc để nhân viên có thể nhận được KPI và tham gia vào hệ thống.</p>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── System Settings Page ─── */
export const settingsSteps: Step[] = [
  {
    target: '#tour-settings-header',
    title: '⚙️ Cấu hình Hệ thống',
    content: <p>Nơi điều chỉnh các thông số kỹ thuật cốt lõi và tùy biến trải nghiệm người dùng cho phù hợp với văn hóa riêng của công ty bạn.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-settings-tabs',
    title: '🎨 Tùy biến Giao diện',
    content: (
      <div className="space-y-2">
        <p>Bạn có thể linh hoạt thay đổi tên các mục menu ở Sidebar.</p>
        <p className="text-[11px] bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-700 italic">
          Ví dụ: Nếu công ty bạn dùng thuật ngữ "Mục tiêu OKR", hãy đổi "KPI của tôi" thành "OKR cá nhân" để tạo sự gần gũi và chuyên nghiệp.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]

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
    target: '#tour-kpi-delegate-btn',
    title: '🌿 Phân rã Mục tiêu (Delegate)',
    content: (
      <div className="space-y-2">
        <p>Đây là phím tắt nhanh để <strong>ủy quyền/giao việc</strong> cho cấp dưới.</p>
        <p className="text-[11px] bg-cyan-50 dark:bg-cyan-900/20 p-2 rounded-lg text-cyan-700 italic border-l-4 border-cyan-400">
          Mẹo: Hệ thống sẽ tự động tạo một chỉ tiêu con liên kết với chỉ tiêu này, giúp việc theo dõi dòng chảy chỉ tiêu trở nên minh bạch và tự động hoàn toàn.
        </p>
      </div>
    ),
    placement: 'left',
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

/* ─── KPI Periods Page ─── */
export const kpiPeriodsSteps: Step[] = [
  {
    target: '#tour-periods-header',
    title: '🗓️ Thiết lập Chu kỳ Đánh giá',
    content: (
      <div className="space-y-2">
        <p>Một "Đợt KPI" đại diện cho một chu kỳ làm việc và đánh giá chính thức của công ty.</p>
        <p className="text-[11px] text-slate-500">Bạn có thể linh hoạt thiết lập các đợt theo <strong>Tháng, Quý, Năm</strong> hoặc theo các chiến dịch kinh doanh ngắn hạn tùy thuộc vào mô hình vận hành của doanh nghiệp.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-periods-toolbar',
    title: '🔍 Quản lý Lịch sử',
    content: <p>Hệ thống hỗ trợ lưu trữ dữ liệu nhiều năm. Bạn có thể sử dụng bộ lọc để xem lại hoặc so sánh cấu hình của các chu kỳ trong quá khứ.</p>,
    placement: 'bottom',
  },
  {
    target: '#tour-periods-content',
    title: '⚙️ Vận hành Chu kỳ',
    content: (
      <div className="space-y-3">
        <p>Tại đây bạn thiết lập mốc <strong>Ngày bắt đầu và Ngày kết thúc</strong> chính thức cho chu kỳ.</p>
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500 rounded text-[11px] text-indigo-700 italic">
          💡 Lưu ý: Nhân viên chỉ có thể gửi báo cáo kết quả trong khoảng thời gian hiệu lực này. Hệ thống sẽ tự động nhắc nhở khi sắp đến hạn chót để đảm bảo không ai bị sót việc.
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

/* ─── Analytics Page ─── */
export const analyticsSteps: Step[] = [
  {
    target: '#tour-analytics-header',
    title: '🧠 Phân tích Dữ liệu Thông minh',
    content: (
      <div className="space-y-2">
        <p>Tính năng giúp biến những con số thô thành các biểu đồ trực quan sinh động.</p>
        <p className="text-[11px] text-indigo-600 font-bold">💡 Giúp lãnh đạo nhận diện ngay lập tức các "điểm nóng" hoặc vấn đề hệ thống mà không cần đọc những báo cáo văn bản dài dòng.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-analytics-tabs',
    title: '🔭 Các Góc nhìn Chuyên sâu',
    content: (
      <div className="space-y-3">
        <ul className="text-[11px] space-y-2 list-disc pl-4 text-slate-500 font-medium">
          <li><strong className="text-slate-900">Thống kê tổng:</strong> Tỷ lệ hoàn thành KPI trung bình của toàn doanh nghiệp.</li>
          <li><strong className="text-slate-900">Phân cấp:</strong> So sánh hiệu suất giữa các đơn vị để tối ưu hóa nguồn lực.</li>
          <li><strong className="text-slate-900">Bảng chi tiết:</strong> Xuất dữ liệu ra Excel phục vụ báo cáo quản trị chuyên sâu.</li>
        </ul>
      </div>
    ),
    placement: 'bottom',
  },
]

/* ─── OKR Management Page ─── */
export const okrManagementSteps: Step[] = [
  {
    target: '#tour-okr-header',
    title: '🎯 Quản trị Chiến lược (OKR)',
    content: (
      <div className="space-y-2">
        <p>Đây là nơi thiết lập các <strong>Mục tiêu (Objectives)</strong> mang tính chiến lược và các <strong>Kết quả then chốt (Key Results)</strong> định lượng để đo lường thành công.</p>
        <p className="text-[11px] text-indigo-600 font-bold italic">💡 OKR giúp toàn bộ tổ chức tập trung vào những việc thực sự quan trọng và có tác động lớn nhất.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-okr-add-btn',
    title: '➕ Thiết lập Mục tiêu mới',
    content: (
      <div className="space-y-2">
        <p>Bắt đầu bằng cách tạo một <strong>Objective</strong> truyền cảm hứng. Sau đó, bạn sẽ thêm các <strong>Key Results</strong> cụ thể để đo lường Objective đó.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#tour-okr-list',
    title: '📊 Theo dõi Tiến độ Chiến lược',
    content: (
      <div className="space-y-2">
        <p>Hệ thống tự động tính toán tiến độ của Objective dựa trên các Key Results liên quan.</p>
        <p className="text-[11px] bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg text-amber-700 italic border-l-4 border-amber-400">
          Mẹo: Khi các KPI liên kết với Key Result được cập nhật, tiến độ tại đây cũng sẽ thay đổi theo thời gian thực.
        </p>
      </div>
    ),
    placement: 'bottom',
  },
]


/* ─── Map page keys to their labels (for sidebar replay button tooltips) ─── */
export const tourPageLabels: Record<TourPageKey, string> = {
  'dashboard-director': 'Tổng quan (Giám đốc)',
  'dashboard-head': 'Tổng quan (Trưởng đơn vị)',
  'dashboard-staff': 'Dashboard cá nhân',
  'company': 'Công ty',
  'roles': 'Vai trò',
  'org-structure': 'Sơ đồ tổ chức',
  'users': 'Nhân sự',
  'settings': 'Cấu hình hệ thống',
  'kpi-criteria': 'Quản lý chỉ tiêu',
  'kpi-periods': 'Quản lý đợt',
  'kpi-pending': 'Duyệt chỉ tiêu',
  'kpi-adjustments': 'Duyệt điều chỉnh',
  'submissions-org': 'Phê duyệt & Đánh giá',
  'my-kpi': 'KPI của tôi',
  'my-submissions': 'Bài nộp của tôi',
  'my-adjustments': 'Điều chỉnh của tôi',
  'evaluations': 'Kết quả đánh giá',
  'analytics': 'Thống kê',
  'okr-management': 'Quản lý OKR',
}

/** Map URL paths to tour page keys */
export const pathToTourKey: Record<string, TourPageKey> = {
  '/dashboard/director': 'dashboard-director',
  '/dashboard/head': 'dashboard-head',
  '/dashboard/staff': 'dashboard-staff',
  '/company': 'company',
  '/roles': 'roles',
  '/org-structure': 'org-structure',
  '/users': 'users',
  '/settings': 'settings',
  '/kpi-criteria': 'kpi-criteria',
  '/kpi-periods': 'kpi-periods',
  '/kpi-criteria/pending': 'kpi-pending',
  '/kpi-adjustments/pending': 'kpi-adjustments',
  '/submissions/org-unit': 'submissions-org',
  '/my-kpi': 'my-kpi',
  '/submissions': 'my-submissions',
  '/my-adjustments': 'my-adjustments',
  '/evaluations': 'evaluations',
  '/analytics': 'analytics',
  '/okr': 'okr-management',
}
