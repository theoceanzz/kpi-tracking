import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'

/**
 * Hướng dẫn cho "Thiết lập công ty" — dòng sidebar và chín mục bên trong.
 *
 * Trước đây trang này chỉ có một bước giới thiệu lưới thẻ, cộng ba mục còn sót lại từ
 * hồi chúng là ba dòng sidebar riêng (vai trò, cơ cấu, nhân viên). Sáu mục còn lại —
 * gồm cả bốn mục hệ thống mà khách hàng ít khi tự tìm ra — không có gì.
 *
 * Về các neo dùng ở đây, xem ghi chú đầu file `setup-tools.tsx`.
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

const danger = (text: string) => (
  <p className="text-[11px] bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-red-700 dark:text-red-400 font-bold italic border-l-4 border-red-400">
    ⛔ {text}
  </p>
)

const setupCompanyTours: Record<TourKey, TourDef> = {
  /* ══════════ Cấp trang ══════════ */
  'setup-company': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: '🗂️ Ba cụm, ba câu hỏi',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Tổ chức</strong> — công ty này là ai, có mấy cấp.{' '}
              <strong>Con người</strong> — ai làm ở đâu, được làm gì.{' '}
              <strong>Hệ thống</strong> — app nói chuyện với nhân viên như thế nào.
            </p>
            <p className="text-[11px] text-slate-500">
              Bấm một thẻ để mở. Lưới sẽ thu lại thành hàng tab mảnh nhường chỗ cho nội dung, và đường dẫn
              ghi lại mục đang xem nên bookmark được.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-card-info',
        title: '1️⃣ Khai báo nền',
        content: (
          <div className="space-y-2">
            <p>
              Tên, mã doanh nghiệp, rồi <strong>Cấp bậc công ty</strong> — công ty có mấy tầng và mỗi tầng gọi là
              gì (Khối, Phòng, Tổ...).
            </p>
            {warn('Cấp bậc quyết định hình dạng của cây đơn vị. Đặt trước khi dựng cơ cấu, đổi sau sẽ ảnh hưởng tới các đơn vị đã tạo.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-roles',
        title: '2️⃣ Vai trò → Cơ cấu → Nhân viên',
        content: (
          <div className="space-y-2">
            <p>
              Cụm Con người có thứ tự đúng: tạo <strong>vai trò</strong> trước, dựng{' '}
              <strong>cây đơn vị</strong> sau, rồi mới <strong>thêm nhân viên</strong> và gán họ vào hai
              thứ đó.
            </p>
            {note('Làm ngược thứ tự thì tới bước thêm nhân viên sẽ không có đơn vị hay vai trò nào để chọn.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-sidebar',
        title: '3️⃣ Cụm ít ai để ý',
        content: (
          <div className="space-y-2">
            <p>
              Bốn mục Hệ thống cho phép <strong>đổi tên mọi mục trên menu</strong> theo ngôn ngữ của công
              ty bạn, chọn sự kiện nào gửi thông báo, sửa nội dung email hệ thống, và nối với Lark.
            </p>
            <p className="text-[11px] text-slate-500">
              Không bắt buộc để chạy được, nhưng là phần làm app trông giống của riêng tổ chức bạn.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  /* ══════════ Cụm Tổ chức ══════════ */
  'setup-company/info': {
    steps: [
      {
        target: '#tour-company-hero',
        title: '🏢 Hồ sơ doanh nghiệp',
        content: (
          <div className="space-y-2">
            <p>
              Tên và mã doanh nghiệp xuất hiện trên báo cáo xuất ra, trong email hệ thống gửi đi và trên
              đầu các bản in. Bấm <strong>Chỉnh sửa hồ sơ</strong> ở góc phải để sửa chúng cùng lĩnh vực
              hoạt động, mã số thuế, quy mô nhân sự và mô tả công ty.
            </p>
            {note('Logo và ảnh bìa đổi riêng bằng nút máy ảnh ngay trên ảnh, không cần vào chế độ sửa.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-company-hero',
        title: '🔎 Danh sách tính năng đang bật',
        content: (
          <div className="space-y-2">
            <p>
              Thẻ cuối trang liệt kê những module tổ chức đang dùng. Đây chỉ là chỗ <strong>xem</strong>{' '}
              — muốn bật tắt thì sang "Thiết lập công cụ › Module &amp; tính năng".
            </p>
            {note('Thấy một mục nào đó biến mất khỏi menu? Kiểm tra danh sách này trước tiên.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-company/ranks': {
    steps: [
      {
        target: '#tour-company-hierarchy',
        title: '🪜 Công ty bạn có mấy tầng',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi dòng là một tầng trong cây đơn vị, xếp từ trên xuống. Bạn đặt tên loại đơn vị của tầng
              đó (Khối, Chi nhánh, Phòng, Tổ...) và chức danh của người phụ trách.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-company-hierarchy',
        title: '🏷️ Gọi đúng tên của công ty bạn',
        content: (
          <div className="space-y-2">
            <p>
              Tên bạn đặt ở đây được dùng khắp app: lúc tạo đơn vị mới, trên báo cáo, trong bộ lọc. Đặt
              đúng từ mà nhân viên vẫn nói hằng ngày thì không ai phải dịch trong đầu.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-company-hierarchy',
        title: '⏳ Đặt sớm, sửa muộn',
        content: (
          <div className="space-y-2">
            <p>Thêm hoặc bớt một tầng sẽ ảnh hưởng tới toàn bộ đơn vị đã tạo theo cấu trúc cũ.</p>
            {warn('Nên chốt cấu trúc cấp bậc ngay khi khởi tạo tổ chức, trước khi dựng cây đơn vị và nhập nhân sự.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  /* ══════════ Cụm Con người ══════════ */
  'setup-company/roles': {
    steps: [
      {
        target: '#tour-roles-header',
        title: '🛡️ Vai trò và quyền hạn',
        content: (
          <div className="space-y-2">
            <p>Vai trò vừa là chức danh chuẩn hoá trong toàn công ty, vừa là bộ quyền đi kèm.</p>
            <p className="text-[11px] text-slate-500">
              Gán <strong>quyền (Permissions)</strong> cho vai trò, rồi gán vai trò cho người — không cấp
              quyền lẻ cho từng cá nhân.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-roles-hierarchy-btn',
        title: '📐 Sơ đồ phân cấp',
        content: (
          <p>
            Mở sơ đồ để nhìn thứ bậc giữa các chức danh. Thứ bậc này quyết định luồng báo cáo và chuỗi
            duyệt: ai duyệt của ai.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-roles-stats',
        title: '📊 Ai đang ở vai nào',
        content: <p>Số nhân sự đang được gán cho từng nhóm vai trò chính, để soát nhanh xem có ai bị bỏ sót.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-roles-table',
        title: '🔑 Cẩn trọng với quyền mạnh',
        content: (
          <div className="space-y-2">
            <p>
              Các quyền dạng <strong>quản trị</strong> và <strong>phê duyệt</strong> cho phép can thiệp
              vào dữ liệu của người khác và đổi cấu hình toàn tổ chức.
            </p>
            {danger('Đừng cấp trọn bộ quyền quản trị cho một vai trò đông người chỉ để tiện — mọi thay đổi cấu hình sau đó sẽ khó truy ra ai làm.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-company/org-structure': {
    steps: [
      {
        target: '#tour-org-view-mode',
        title: '👁️ Hai cách nhìn cùng một cây',
        content: (
          <div className="space-y-2">
            <p>Cùng dữ liệu, hai cách xem tuỳ việc bạn đang làm:</p>
            <ul className="text-[11px] space-y-1 list-disc pl-4 text-slate-500">
              <li><strong>Sơ đồ:</strong> nhìn tổng thể luồng quản lý và quan hệ giữa các đơn vị.</li>
              <li><strong>Danh sách:</strong> tìm nhanh và sửa hàng loạt.</li>
            </ul>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-org-content',
        title: '🏗️ Dựng bộ máy',
        content: (
          <div className="space-y-2">
            <p>
              Tạo đơn vị, đặt nó dưới đơn vị cha, rồi gán <strong>người phụ trách</strong>. Số tầng bạn
              được phép tạo lấy theo cấu trúc đã khai ở mục "Cấp bậc công ty".
            </p>
            {warn('Đơn vị không có người phụ trách sẽ làm tắc chuỗi duyệt KPI của cả đơn vị đó — không ai nhận được việc cần duyệt.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-org-content',
        title: '🔗 Cây này quyết định nhiều thứ',
        content: (
          <div className="space-y-2">
            <p>
              Đây không chỉ là sơ đồ để xem. Cây đơn vị quyết định ai thấy dữ liệu của ai, chỉ tiêu chảy
              xuống theo đường nào, và báo cáo tổng hợp cộng dồn ra sao.
            </p>
            {note('Nhập cây đơn vị lớn bằng Excel thay vì tạo tay từng đơn vị — có nút nhập ngay trên màn hình này.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-company/users': {
    steps: [
      {
        target: '#tour-users-header',
        title: '👥 Toàn bộ tài khoản',
        content: <p>Nơi tập trung quản lý mọi tài khoản người dùng của tổ chức.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-users-import',
        title: '📥 Nhập từ Excel',
        content: (
          <p>
            Với danh sách nhân sự lớn, dùng <strong>nhập từ Excel</strong> thay vì tạo tay. Tải file mẫu
            trong hộp thoại để biết đúng thứ tự cột.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-users-add',
        title: '➕ Thêm lẻ',
        content: <p>Dùng cho người mới vào sau đợt nhập ban đầu.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-users-filters',
        title: '🔍 Tìm và lọc',
        content: (
          <div className="space-y-2">
            <p>Lọc theo đơn vị, vai trò hoặc trạng thái tài khoản.</p>
            <p className="text-[11px] text-slate-500 italic">
              Mẹo: lọc theo trạng thái để soát các tài khoản đang bị khoá trước mỗi kỳ đánh giá.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-users-table',
        title: '📝 Chưa gán thì chưa dùng được',
        content: (
          <div className="space-y-2">
            <p>Bấm vào từng người để hoàn thiện hồ sơ:</p>
            <ul className="text-[11px] space-y-1 list-disc pl-4 text-slate-500">
              <li>Gán vào <strong>đơn vị</strong> trong cây tổ chức.</li>
              <li>Cấp <strong>vai trò</strong> đúng với công việc của họ.</li>
            </ul>
            {warn('Thiếu một trong hai thứ này thì người đó không nhận được chỉ tiêu và không xuất hiện trong bất kỳ báo cáo nào.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  /* ══════════ Cụm Hệ thống ══════════ */
  'setup-company/sidebar': {
    steps: [
      {
        target: '#tour-sidebar-header',
        title: '🏷️ Gọi mọi thứ theo tên của bạn',
        content: (
          <div className="space-y-2">
            <p>
              Đổi nhãn của bất kỳ mục nào trên menu và bên trong từng trang — "Chỉ tiêu" thành "Định mức",
              "Đợt" thành "Tháng", tuỳ tổ chức bạn quen gọi thế nào.
            </p>
            {note('Dòng phụ ngay dưới nhan đề đếm số mục đang được đổi tên — nhìn đó là biết công ty đã tuỳ biến tới đâu.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-sidebar-header',
        title: '🔍 Tìm rồi mới sửa, và nhớ Lưu',
        content: (
          <div className="space-y-2">
            <p>
              Ô <strong>Tìm mục</strong> lọc theo cả nhãn mặc định lẫn nhãn bạn đã đặt. Sửa xong phải bấm
              <strong> Lưu thay đổi</strong> ở ngay cạnh — mọi ô nhập được ghi cùng một lần.
            </p>
            {warn('Rời màn hình khi chưa lưu là mất hết những gì vừa gõ, không có hộp thoại nhắc lại.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-sidebar-note',
        title: '📍 Chia theo NƠI mục hiện ra',
        content: (
          <div className="space-y-2">
            <p>
              Bảng chia thành từng khối: khối <strong>Thanh điều hướng</strong> là các dòng trên sidebar,
              còn mỗi khối tiếp theo là các mục nằm bên trong một trang cụ thể.
            </p>
            {note('Chia như vậy vì phần lớn màn hình giờ là mục trong trang — danh sách phẳng sẽ có hơn hai mươi dòng mà không biết dòng nào ở đâu.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-sidebar-scope-sidebar',
        title: '↩️ Đổi tên không đổi chức năng',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi dòng hiện nhãn mặc định, cụm của nó, và khoá kỹ thuật in mờ bên dưới. Nhãn chỉ là cách
              hiển thị: đổi tên không mất dữ liệu, không đổi quyền.
            </p>
            {note('Xoá trống ô nhập là mục đó quay về nhãn mặc định — không cần nhớ tên gốc là gì.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-company/notifications': {
    steps: [
      {
        target: '#tour-notif-header',
        title: '🔔 Mặc định cho cả tổ chức',
        content: (
          <div className="space-y-2">
            <p>
              Thiết lập ở đây áp làm <strong>mặc định</strong> cho mọi nhân viên. Sửa xong nhớ bấm
              <strong> Lưu cấu hình</strong> ở góc phải card này.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-notif-events',
        title: '📨 Hai kênh, bật độc lập',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi dòng là một sự kiện — có chỉ tiêu cần duyệt, có bài nộp mới, sắp tới hạn nộp. Hai công
              tắc bên phải là <strong>Email</strong> (thư vào hộp thư) và <strong>Hệ thống</strong> (chuông
              trong app), bật tắt riêng từng cái.
            </p>
            {note('Việc gấp thì bật cả hai; việc lặp lại thường xuyên thì chỉ để chuông, kẻo hộp thư nhân viên đầy thư hệ thống rồi họ bỏ qua luôn thư quan trọng.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-notif-events',
        title: '✉️ Nội dung thư ở mục khác',
        content: (
          <p>
            Ở đây quyết định <strong>có gửi hay không</strong>. Còn <strong>gửi cái gì</strong> — tiêu đề
            và nội dung thư — nằm ở mục "Thiết lập email" ngay bên cạnh.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-company/email': {
    steps: [
      {
        target: '#tour-email-list',
        title: '✉️ Danh mục thư, chia theo nhóm',
        content: (
          <div className="space-y-2">
            <p>
              Cột trái liệt kê mọi loại thư hệ thống gửi đi. Chấm tròn xanh nghĩa là mẫu đã được tuỳ chỉnh;
              dấu ✕ nghĩa là loại thư đó đang tắt, hệ thống sẽ không gửi.
            </p>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '#tour-email-subject',
        title: '🧩 Biến được điền tự động',
        content: (
          <div className="space-y-2">
            <p>
              Tiêu đề và nội dung dùng các <strong>biến</strong> được thay lúc gửi — tên người nhận, tên
              đợt, đường dẫn tới việc cần xử lý. Danh sách biến dùng được hiện ngay cạnh ô soạn.
            </p>
            {warn('Vài biến là bắt buộc: thiếu chúng thì hệ thống từ chối lưu và báo đỏ ngay dưới ô soạn. Bỏ liên kết đặt lại mật khẩu đi là người nhận không còn cách nào làm xong việc thư đang yêu cầu.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-email-editor',
        title: '🖊️ Soạn trực quan hoặc soạn HTML',
        content: (
          <div className="space-y-2">
            <p>
              Chuyển qua lại giữa trình soạn trực quan và chế độ HTML đầy đủ mà không mất nội dung — hai
              chế độ dùng chung một chuỗi HTML.
            </p>
            {note('Ở chế độ HTML, thẻ script, iframe và các handler onclick bị loại bỏ khi lưu — đây là thư gửi ra ngoài nên không cho chạy mã.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-email-actions',
        title: '👁️ Xem trước, lưu, hoặc về mặc định',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Xem trước</strong> dựng thử thư với dữ liệu mẫu. <strong>Khôi phục mặc định</strong>
              đưa mẫu về bản gốc — nút này mờ đi khi mẫu chưa từng bị sửa.
            </p>
            {warn('Luôn xem trước trước khi lưu: thư đã gửi thì không rút lại được.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-company/api': {
    steps: [
      {
        target: '#tour-lark-status',
        title: '🔗 Nối với Lark',
        content: (
          <div className="space-y-2">
            <p>
              Dải trên cùng nói ngay trạng thái: đã bật đăng nhập bằng Lark chưa, và đang liên kết với tổ
              chức Lark nào. Nối rồi thì nhân viên đăng nhập bằng tài khoản Lark, khỏi nhớ thêm mật khẩu.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-lark-credentials',
        title: '🪜 Làm theo thứ tự các bước',
        content: (
          <div className="space-y-2">
            <p>
              Các bước đánh số và mở khoá dần: khai ứng dụng bên Lark → dán <strong>App ID</strong> và
              <strong> App Secret</strong> vào đây → bấm <strong>Kiểm tra kết nối</strong>.
            </p>
            {note('Có nút mở thẳng trang quản trị của Lark ở bước trước — làm song song hai cửa sổ sẽ nhanh hơn.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-lark-connect',
        title: '👤 Liên kết bằng chính tài khoản của bạn',
        content: (
          <div className="space-y-2">
            <p>
              Bấm <strong>Kết nối với Lark</strong>, đăng nhập một lần, hệ thống tự nhận diện công ty của
              bạn rồi ghi nhớ — không phải nhập tay tên hay mã tổ chức.
            </p>
            {warn('Quyền vừa thêm bên Lark chỉ có hiệu lực sau khi phiên bản ứng dụng được duyệt. Thấy trạng thái "Added" là chưa đủ.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-lark-defaults',
        title: '🗺️ Đơn vị và vai trò cho người mới',
        content: (
          <div className="space-y-2">
            <p>
              Người từ Lark đăng nhập lần đầu sẽ được tạo tài khoản tự động và xếp vào đơn vị, vai trò khai
              ở bước này. Từng người vẫn chỉnh lại được sau.
            </p>
            {warn('Đặt mặc định quá rộng là người lạ đăng nhập một phát có ngay quyền xem dữ liệu cả đơn vị. Chọn vai trò hẹp nhất rồi nâng sau.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },
}

export default setupCompanyTours
