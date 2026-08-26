import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'

/**
 * Hướng dẫn cho "Thiết lập công cụ" — dòng sidebar, mười mục bên trong, và các tab của
 * từng mục.
 *
 * Trang này được viết lại đầu tiên vì trước đó nó thiếu nhiều nhất: cả trang chỉ có
 * đúng một bước giới thiệu lưới thẻ, còn mười mục bên trong thì không mục nào có hướng
 * dẫn, kể cả những mục khó nhất (thang điểm, ma trận, xếp loại đơn vị).
 *
 * Neo dùng ở đây đều là neo chung của khung, không phải neo riêng của từng màn:
 *   `#tour-settings-nav`    lưới thẻ ở màn hình chọn mục
 *   `#tour-card-<id>`       một thẻ trên lưới
 *   `#tour-section-tabs`    hàng tab cấp 2 (các mục cùng cụm)
 *   `#tour-section-root`    thân của mục đang mở — mục nào cũng có
 *   `#tour-workspace-card`  card mở đầu của mục (mô tả, số liệu, nút hành động)
 *   `#tour-workspace-tabs`  hàng tab cấp 3 bên trong card đó
 * Nhờ vậy thêm bước hướng dẫn không phải sửa vào component nghiệp vụ.
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

const setupToolsTours: Record<TourKey, TourDef> = {
  /* ══════════ Cấp trang ══════════ */
  'setup-tools': {
    steps: [
      {
        target: '#tour-settings-nav',
        title: '🧩 Hai cụm, hai loại việc',
        content: (
          <div className="space-y-2">
            <p>
              Cụm <strong>Cấu hình</strong> trả lời "tổ chức chấm điểm theo luật nào" — bật tắt công cụ,
              thang điểm, ma trận, tiêu chuẩn xếp loại. Đặt một lần, thỉnh thoảng mới sửa.
            </p>
            <p>
              Cụm <strong>Công cụ</strong> là nơi <strong>vận hành hằng kỳ</strong>: mở kỳ đánh giá, dựng
              OKR/BSC, trao thưởng, quản ví, chia hạn mức AI.
            </p>
            <p className="text-[11px] text-slate-500">
              Thẻ nào không thấy nghĩa là tổ chức đang tắt công cụ đó — bật lại ở mục "Module &amp; tính năng".
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-card-modules',
        title: '1️⃣ Bắt đầu từ đây',
        content: (
          <div className="space-y-2">
            <p>
              Đây là công tắc tổng. Bật/tắt một module ở đây sẽ làm xuất hiện hoặc biến mất cả những thẻ
              khác trên chính lưới này, lẫn các mục ở những trang khác.
            </p>
            {note('Tổ chức mới nên đi theo thứ tự các thẻ từ trái sang phải, trên xuống dưới — chúng được xếp đúng theo thứ tự phụ thuộc.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-scoring',
        title: '2️⃣ Luật chấm điểm',
        content: (
          <div className="space-y-2">
            <p>
              Ba thẻ kế tiếp nối nhau thành một chuỗi: <strong>Thang điểm</strong> quy đổi kết quả thành
              điểm, <strong>Ma trận đánh giá</strong> ghép điểm hành vi với % KPI thành xếp loại cá nhân,
              rồi <strong>Xếp loại đơn vị</strong> áp tiêu chuẩn cho cả phòng ban.
            </p>
            {warn('Sửa thang điểm giữa kỳ sẽ làm lệch các đợt đã chấm. Nên chốt trước khi mở kỳ đầu tiên.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-card-kpi-cycles',
        title: '3️⃣ Rồi mới tới vận hành',
        content: (
          <div className="space-y-2">
            <p>
              Cấu hình xong thì mở <strong>kỳ đánh giá</strong> — mọi hoạt động KPI đều gắn vào một đợt
              nằm trong một kỳ. Chưa có đợt nào đang mở thì nhân viên không nộp báo cáo được.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  /* ══════════ Cụm Cấu hình ══════════ */
  'setup-tools/modules': {
    steps: [
      {
        target: '#tour-modules-grid',
        title: '🎛️ Công tắc tổng của tổ chức',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi công tắc mở ra một mảng chức năng: OKR, BSC, KPI hành vi, thác nước, thưởng điểm, ví
              tiền. Tắt cái nào thì cái đó biến mất khỏi sidebar, khỏi lưới thẻ và khỏi các bước đánh giá.
            </p>
            {warn('Tắt một module KHÔNG xoá dữ liệu đã có — chỉ ẩn đi. Bật lại là dữ liệu cũ trở về nguyên vẹn.')}
          </div>
        ),
        placement: 'right',
      },
      {
        target: '#tour-modules-grid',
        title: '🔗 Cái nào kéo theo cái nào',
        content: (
          <div className="space-y-2">
            <ul className="text-[11px] space-y-1.5 list-disc pl-4 text-slate-500 font-medium">
              <li><strong className="text-slate-900 dark:text-white">KPI hành vi:</strong> bật thì mới có thang điểm định tính và Ma trận đánh giá.</li>
              <li><strong className="text-slate-900 dark:text-white">BSC:</strong> bật thì có mục dựng bộ tiêu chí và góc nhìn BSC bên Phân tích.</li>
              <li><strong className="text-slate-900 dark:text-white">OKR:</strong> bật thì phần Phân tích đổi từ xem theo KPI sang xem theo mục tiêu.</li>
              <li><strong className="text-slate-900 dark:text-white">Thưởng &amp; Ví:</strong> hai số dư khác nhau (điểm và tiền), bật độc lập được.</li>
            </ul>
          </div>
        ),
        placement: 'right',
      },
      {
        target: '#tour-section-tabs',
        title: '↔️ Đi tiếp trong cụm',
        content: (
          <p>
            Hàng tab này chỉ liệt kê các mục <strong>cùng cụm</strong> với mục đang mở. Muốn nhảy sang cụm
            khác thì quay về lưới thẻ bằng nút mũi tên ở góc trên bên trái.
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/scoring': {
    steps: [
      {
        target: '#tour-workspace-card',
        title: '📏 Kết quả thành điểm bằng cách nào',
        content: (
          <div className="space-y-2">
            <p>
              Mục này định nghĩa cách hệ thống đổi con số nhân viên báo cáo thành điểm số. Không có nó thì
              mọi bài nộp chỉ là dữ liệu thô.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: '⚖️ Hai nửa của cùng một câu hỏi',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Định lượng</strong> dành cho thứ đo được bằng số (doanh thu, số hồ sơ).
              <strong> Định tính</strong> dành cho thứ phải nhận xét (thái độ, kỷ luật).
            </p>
            <p className="text-[11px] text-slate-500">
              Hai tab đứng chung một mục vì chúng ăn khớp với nhau — điểm định tính cuối cùng cũng quy về
              % để cộng vào hiệu suất chung.
            </p>
            {note('Chỉ thấy một tab? Tổ chức đang tắt "KPI hành vi" trong mục Module & tính năng.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/scoring#quantitative': {
    title: 'Thang điểm định lượng',
    steps: [
      {
        target: '#tour-section-root',
        title: '🔢 Mốc điểm theo % hoàn thành',
        content: (
          <div className="space-y-2">
            <p>
              Khai các mức và ngưỡng % tương ứng. Nhân viên đạt bao nhiêu phần trăm chỉ tiêu thì rơi vào
              mức có ngưỡng cao nhất mà họ vượt qua.
            </p>
            {warn('Ngưỡng phải phủ kín từ 0% trở lên. Để hở một khoảng thì kết quả rơi vào đó sẽ không xếp được mức nào.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/scoring#qualitative': {
    title: 'Thang điểm định tính',
    steps: [
      {
        target: '#tour-section-root',
        title: '🗣️ Mức đánh giá do người chấm chọn',
        content: (
          <div className="space-y-2">
            <p>
              Khác định lượng ở chỗ không có công thức: người đánh giá chọn thẳng một mức trong danh sách
              bạn khai ở đây, mỗi mức gắn sẵn một số điểm.
            </p>
            {note('Đặt tên mức bằng ngôn ngữ của tổ chức bạn ("Vượt mong đợi", "Đạt", "Cần cải thiện") — người chấm đọc đúng cái tên này khi đánh giá.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/matrix': {
    steps: [
      {
        target: '#tour-section-root',
        title: '🔲 Hai chiều thành một xếp loại',
        content: (
          <div className="space-y-2">
            <p>
              Ma trận ghép <strong>điểm hành vi</strong> (một chiều) với <strong>% hoàn thành KPI</strong>
              (chiều kia) để ra xếp loại cuối cùng của một người. Làm tốt việc nhưng thái độ kém, hay ngược
              lại, đều không thể tự động thành loại cao nhất.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-section-root',
        title: '✏️ Sửa dải và sửa ô',
        content: (
          <div className="space-y-2">
            <p>
              Bạn đặt được tên cho từng dải ở hàng và cột, thêm bớt dải, rồi điền hạng cho từng ô giao
              nhau. Giá trị trong ô chính là "Loại N" mà nhân viên nhận được.
            </p>
            {warn('Mục này chỉ hiện khi tổ chức bật "KPI hành vi" — tắt cờ đó thì xếp loại tính thẳng từ % KPI.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/unit-class': {
    steps: [
      {
        target: '#tour-section-root',
        title: '🏢 Xếp loại cho cả đơn vị',
        content: (
          <div className="space-y-2">
            <p>
              Ma trận ở mục trước xếp loại <strong>từng người</strong>. Mục này xếp loại <strong>cả phòng
              ban</strong>, dựa trên tỉ lệ nhân sự đạt từng mức bên trong nó.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-section-root',
        title: '📋 Luật dạng "đủ mọi điều kiện"',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi hạng là một bộ điều kiện kiểu "≥ 30% nhân sự đạt Loại 4 trở lên". Đơn vị được xếp vào
              hạng cao nhất mà nó thoả <strong>đủ</strong> điều kiện.
            </p>
            {note('Có sẵn bộ luật mẫu để bấm áp dụng rồi chỉnh lại theo tổ chức, thay vì gõ từ đầu.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-section-root',
        title: '🎯 Áp theo kỳ và theo phạm vi',
        content: (
          <p>
            Tiêu chuẩn gắn với một <strong>kỳ đánh giá</strong> và một phạm vi đơn vị, nên khối kinh doanh
            và khối hỗ trợ đặt chuẩn khác nhau được, và chuẩn năm nay không đụng vào kết quả năm ngoái.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  /* ══════════ Cụm Công cụ ══════════ */
  'setup-tools/kpi-cycles': {
    steps: [
      {
        target: '#tour-workspace-tabs',
        title: '🗓️ Kỳ gom đợt',
        content: (
          <div className="space-y-2">
            <p>
              Hai tầng thời gian, đừng nhầm: <strong>Đợt</strong> là một lần nộp và chấm (thường theo
              tháng). <strong>Kỳ</strong> gom nhiều đợt lại để ra một kết quả tổng hợp (quý, nửa năm, năm).
            </p>
            <p className="text-[11px] text-slate-500">
              Nhân viên nộp báo cáo theo đợt; xếp loại và khen thưởng thì tính theo kỳ.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-card',
        title: '🚦 Không có đợt mở thì không ai nộp được',
        content: (
          <div className="space-y-2">
            <p>
              Đây là mục cần đụng tới đều đặn nhất trong cả trang. Đầu mỗi chu kỳ, mở đợt mới; hết hạn,
              đóng lại để chốt số.
            </p>
            {warn('Quên mở đợt là toàn tổ chức không nộp được báo cáo — triệu chứng hay bị báo là "hệ thống lỗi".')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/kpi-cycles#cycles': {
    title: 'Kỳ đánh giá',
    steps: [
      {
        target: '#tour-workspace-card',
        title: '📆 Tạo kỳ trước, đợt sau',
        content: (
          <div className="space-y-2">
            <p>
              Một kỳ là Tháng / Quý / 6 Tháng / Năm. Tạo kỳ xong mới gán các đợt vào — đợt không thuộc kỳ
              nào thì không được tính vào đánh giá tổng hợp.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-section-root',
        title: '✅ Chuỗi duyệt theo cấp',
        content: (
          <div className="space-y-2">
            <p>
              Kết quả của kỳ đi lên theo từng cấp quản lý. Cấp dưới chốt xong thì khoá lại, cấp trên mới
              duyệt tiếp — nên số liệu không bị sửa sau lưng người đã ký.
            </p>
            {note('Xem tiến trình duyệt của cả kỳ ở mục "Đánh giá kỳ" bên Quản lý hiệu suất.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/kpi-cycles#periods': {
    title: 'Đợt đánh giá',
    steps: [
      {
        target: '#tour-periods-header',
        title: '🗓️ Một đợt là một lần nộp và chấm',
        content: (
          <div className="space-y-2">
            <p>Một "Đợt KPI" là một chu kỳ làm việc và đánh giá chính thức của công ty.</p>
            <p className="text-[11px] text-slate-500">
              Thiết lập theo <strong>Tháng, Quý, Năm</strong> hoặc theo chiến dịch ngắn hạn, tuỳ mô hình
              vận hành của doanh nghiệp.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-periods-toolbar',
        title: '🔍 Xem lại các đợt cũ',
        content: (
          <p>
            Hệ thống lưu dữ liệu nhiều năm. Dùng bộ lọc để mở lại hoặc so sánh cấu hình của những chu kỳ
            đã qua.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-periods-content',
        title: '⚙️ Mốc thời gian quyết định mọi thứ',
        content: (
          <div className="space-y-3">
            <p>
              Đặt <strong>ngày bắt đầu và ngày kết thúc</strong> cho đợt. Nhân viên chỉ nộp được báo cáo
              trong khoảng này, và hệ thống tự nhắc khi sắp tới hạn.
            </p>
            {warn('Rút ngắn ngày kết thúc của một đợt đang chạy sẽ chặn ngay những người chưa kịp nộp.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/okr': {
    steps: [
      {
        target: '#tour-okr-header',
        title: '🎯 Quản trị chiến lược (OKR)',
        content: (
          <div className="space-y-2">
            <p>
              Nơi đặt các <strong>Mục tiêu (Objectives)</strong> mang tính chiến lược và các{' '}
              <strong>Kết quả then chốt (Key Results)</strong> định lượng để đo mức thành công.
            </p>
            {note('OKR giúp cả tổ chức tập trung vào số ít việc thực sự có tác động lớn.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-okr-add-btn',
        title: '➕ Objective trước, Key Result sau',
        content: (
          <p>
            Tạo một <strong>Objective</strong> truyền cảm hứng trước, rồi thêm các{' '}
            <strong>Key Result</strong> cụ thể để đo nó. Objective không có Key Result thì không tính được
            tiến độ.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-okr-list',
        title: '📊 Tiến độ tự cập nhật',
        content: (
          <div className="space-y-2">
            <p>Tiến độ của Objective được tính tự động từ các Key Result thuộc về nó.</p>
            {warn('Key Result có liên kết với KPI thì tiến độ chạy theo KPI đó theo thời gian thực — sửa tay sẽ bị ghi đè.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/bsc': {
    steps: [
      {
        target: '#tour-workspace-card',
        title: '🧭 Bộ tiêu chí theo 4 lĩnh vực',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi <strong>bộ tiêu chí</strong> gắn với một kỳ và một phạm vi đơn vị. Bên trong nó là các
              hạng mục, chia theo bốn lĩnh vực của Thẻ điểm cân bằng, mỗi hạng mục có trọng số riêng.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-section-root',
        title: '1️⃣ Hạng mục trước, trọng số sau',
        content: (
          <div className="space-y-2">
            <p>
              Hai việc này có thứ tự: phải tạo hạng mục trước thì mới có thứ để gán trọng số. Màn hình
              được tách làm hai bước đúng theo thứ tự đó thay vì hai tab ngang hàng.
            </p>
            {warn('Tổng trọng số của các hạng mục trong một lĩnh vực nên bằng 100% — lệch thì điểm quy đổi sẽ không phản ánh đúng ý đồ.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-section-root',
        title: '🚀 Chạy thử rồi mới chính thức',
        content: (
          <div className="space-y-2">
            <p>
              Bộ tiêu chí có thể chạy ở chế độ <strong>chạy thử</strong> — vẫn tính điểm để đối chiếu
              nhưng chưa ảnh hưởng tới kết quả đánh giá thật. Yên tâm thì mới chuyển sang chính thức.
            </p>
            {note('Kết quả theo từng hạng mục xem ở Phân tích › Hạng mục (BSC).')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards': {
    steps: [
      {
        target: '#tour-workspace-card',
        title: '🎁 Điểm thưởng, không phải tiền',
        content: (
          <div className="space-y-2">
            <p>
              Toàn bộ mục này chạy trên <strong>điểm</strong>: trao điểm cho nhân viên, đặt hạn mức cho
              quản lý, và cho phép đổi điểm lấy quà. Tiền thật nằm ở mục "Quản lý ví".
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: '🗂️ Sáu tab, ba nhóm việc',
        content: (
          <div className="space-y-2">
            <ul className="text-[11px] space-y-1.5 list-disc pl-4 text-slate-500 font-medium">
              <li><strong className="text-slate-900 dark:text-white">Trao &amp; duyệt:</strong> Đề nghị thưởng, Hạn mức.</li>
              <li><strong className="text-slate-900 dark:text-white">Tự động:</strong> Chương trình tự động, Điểm danh.</li>
              <li><strong className="text-slate-900 dark:text-white">Đổi quà:</strong> Quà tặng, Yêu cầu đổi quà.</li>
            </ul>
            {note('Số vàng trên tab là số việc đang chờ bạn xử lý.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/rewards#grants': {
    title: 'Đề nghị thưởng',
    steps: [
      {
        target: '#tour-section-root',
        title: '🤝 Trao điểm và duyệt đề nghị',
        content: (
          <div className="space-y-2">
            <p>
              Quản lý trao điểm trong hạn mức của mình thì có hiệu lực ngay. Vượt hạn mức thì thành một
              đề nghị nằm chờ ở đây cho cấp trên duyệt.
            </p>
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#budgets': {
    title: 'Hạn mức thưởng',
    steps: [
      {
        target: '#tour-section-root',
        title: '💰 Mỗi quản lý một túi điểm',
        content: (
          <div className="space-y-2">
            <p>
              Cấp hạn mức để quản lý tự thưởng cho đội của mình mà không phải xin duyệt từng lần. Hết hạn
              mức thì mọi lần trao tiếp theo đều chuyển thành đề nghị.
            </p>
            {warn('Không cấp hạn mức cho ai thì mọi lượt trao điểm đều phải qua duyệt — hàng chờ sẽ dồn lên bạn.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#programs': {
    title: 'Chương trình tự động',
    steps: [
      {
        target: '#tour-section-root',
        title: '⚙️ Thưởng không cần ai bấm nút',
        content: (
          <div className="space-y-2">
            <p>
              Đặt luật để hệ thống tự trao điểm khi một điều kiện xảy ra — ví dụ hoàn thành đủ chỉ tiêu
              trong đợt, hay đạt xếp loại cao.
            </p>
            {note('Hợp với những khoản thưởng lặp lại đều đặn; khoản đột xuất thì dùng tab Đề nghị thưởng.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#checkin': {
    title: 'Điểm danh',
    steps: [
      {
        target: '#tour-section-root',
        title: '📅 Điểm danh hằng ngày lấy điểm',
        content: (
          <div className="space-y-2">
            <p>
              Bật để nhân viên nhận điểm khi vào hệ thống mỗi ngày. Bạn đặt số điểm mỗi lượt và mức
              thưởng thêm cho chuỗi ngày liên tiếp.
            </p>
            {warn('Luật tính chuỗi do máy chủ quyết định, không phải trình duyệt — đổi múi giờ máy cá nhân không "lách" được.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#gifts': {
    title: 'Quà tặng',
    steps: [
      {
        target: '#tour-section-root',
        title: '🛍️ Danh mục quà đổi điểm',
        content: (
          <div className="space-y-2">
            <p>
              Khai các món nhân viên đổi được, giá theo điểm và số lượng còn lại. Đây chính là những gì
              họ thấy ở "Của tôi › Điểm của tôi › Cửa hàng quà".
            </p>
            {note('Cửa hàng trống thì điểm thưởng không dùng được vào việc gì — nhớ khai ít nhất vài món trước khi bật module.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#redemptions': {
    title: 'Yêu cầu đổi quà',
    steps: [
      {
        target: '#tour-section-root',
        title: '📦 Hàng chờ giao quà',
        content: (
          <div className="space-y-2">
            <p>
              Nhân viên đổi quà xong thì yêu cầu nằm ở đây chờ bạn xác nhận đã giao. Điểm bị trừ ngay lúc
              đổi, nên xử lý chậm là người ta mất điểm mà chưa nhận được gì.
            </p>
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/wallet': {
    steps: [
      {
        target: '#tour-workspace-card',
        title: '🏦 Đây là tiền thật',
        content: (
          <div className="space-y-2">
            <p>
              Ví tách hẳn khỏi điểm thưởng: số dư ở đây là tiền, có nạp vào và có đối soát với ngân hàng.
            </p>
            {warn('Đừng nhầm hai số dư. Điểm thưởng nằm ở mục "Quản lý thưởng", không quy đổi ngược lại thành tiền.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: '🗂️ Xem, cấu hình, đối soát',
        content: (
          <p>
            <strong>Số dư nhân sự</strong> để tra cứu, <strong>Cấu hình</strong> để đặt luật nạp và tỉ giá
            quy đổi sang điểm, <strong>Đối soát</strong> để khớp giao dịch chuyển khoản.
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/wallet#wallets': {
    title: 'Số dư nhân sự',
    steps: [
      {
        target: '#tour-section-root',
        title: '👛 Ai đang có bao nhiêu',
        content: (
          <p>
            Danh sách số dư của từng nhân sự cùng lịch sử biến động. Dùng khi có khiếu nại về một giao
            dịch cụ thể.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/wallet#config': {
    title: 'Cấu hình ví',
    steps: [
      {
        target: '#tour-section-root',
        title: '⚙️ Luật nạp và tỉ giá',
        content: (
          <div className="space-y-2">
            <p>
              Đặt cách nhân viên nạp tiền vào ví và tỉ giá quy đổi từ tiền sang điểm thưởng.
            </p>
            {warn('Đổi tỉ giá chỉ áp cho giao dịch từ thời điểm đổi trở đi, không tính lại các lần quy đổi cũ.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/wallet#reconcile': {
    title: 'Đối soát',
    steps: [
      {
        target: '#tour-section-root',
        title: '🧾 Khớp với sao kê ngân hàng',
        content: (
          <p>
            Danh sách giao dịch chuyển khoản hệ thống nhận được. Giao dịch nào chưa khớp được với lệnh nạp
            nào thì nằm lại đây chờ xử lý tay.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/ai-quota': {
    steps: [
      {
        target: '#tour-workspace-card',
        title: '🪙 Chia hạn mức token AI',
        content: (
          <div className="space-y-2">
            <p>
              Tổ chức có một lượng token AI hằng tháng. Ở đây bạn chia lượng đó cho các đơn vị cấp dưới
              thuộc phạm vi quản lý của mình.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-section-root',
        title: '📉 Hết hạn mức thì trợ lý ngừng trả lời',
        content: (
          <div className="space-y-2">
            <p>
              Đơn vị dùng hết phần được chia thì K.AI và các gợi ý tự động ngừng hoạt động với đơn vị đó
              cho tới kỳ sau, hoặc tới khi bạn cấp thêm.
            </p>
            {note('Hạn mức đặt lại theo tháng — không cộng dồn phần chưa dùng hết.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },
}

export default setupToolsTours
