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
        target: '#tour-workspace-tabs',
        title: '📏 Ba thang điểm, ba loại câu hỏi',
        content: (
          <div className="space-y-2">
            <ul className="text-[11px] space-y-1.5 list-disc pl-4 text-slate-500 font-medium">
              <li><strong className="text-slate-900 dark:text-white">Định lượng:</strong> đo được bằng số — doanh thu, số hồ sơ, tỉ lệ lỗi.</li>
              <li><strong className="text-slate-900 dark:text-white">Định tính:</strong> người chấm chọn một mức có sẵn — thái độ, kỷ luật.</li>
              <li><strong className="text-slate-900 dark:text-white">Hạnh kiểm:</strong> bộ tiêu chí hành vi có trọng số, chấm riêng thành một phiếu.</li>
            </ul>
            {note('Thiếu tab nào nghĩa là tổ chức đang tắt module tương ứng ở mục "Module & tính năng" — không phải bạn thiếu quyền.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-card',
        title: '✏️ Xem trước, sửa sau',
        content: (
          <div className="space-y-2">
            <p>
              Mặc định màn hình ở chế độ <strong>chỉ xem</strong>. Bấm <strong>Chỉnh sửa</strong> ở góc
              phải card này mới mở được các ô nhập; nút <strong>↺</strong> bên cạnh đưa cả thang về bộ
              mặc định của hệ thống.
            </p>
            {warn('Đặt lại mặc định ghi đè toàn bộ mức bạn đã khai, không hỏi lại lần hai và không hoàn tác được.')}
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
        target: '#tour-scoring-max',
        title: '🔢 Thang mấy điểm',
        content: (
          <div className="space-y-2">
            <p>
              Số ở khối tím là <strong>điểm tối đa</strong> của một chỉ tiêu định lượng. Mọi % hoàn thành
              đều quy về thang này, nên đổi nó là đổi ý nghĩa của mọi điểm số đang có.
            </p>
            {warn('Đổi thang giữa kỳ làm các đợt đã chấm và các đợt sắp chấm không còn cùng đơn vị đo. Nên chốt trước khi mở kỳ đầu tiên.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-scoring-levels',
        title: '🪜 Các mức xếp loại',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi mức gồm <strong>tên</strong>, <strong>ngưỡng điểm</strong> và <strong>màu</strong>. Một
              kết quả rơi vào mức có ngưỡng cao nhất mà nó vượt qua — nên ngưỡng phải phủ kín từ 0 trở lên.
            </p>
            {note('Màu ở đây chính là màu hiện trên bảng đánh giá và trong báo cáo, nên chọn màu tương phản rõ giữa các mức kề nhau.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-scoring-levels',
        title: '➕ Thêm và bớt mức',
        content: (
          <p>
            Ở chế độ chỉnh sửa, mỗi mức có nút thùng rác để xoá và có <strong>Thêm mức</strong> ở đầu
            danh sách. Xong thì bấm <strong>Lưu cấu hình</strong> ở cuối — bỏ qua bước lưu là thay đổi mất
            khi rời màn hình.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/scoring#qualitative': {
    title: 'Thang điểm định tính',
    steps: [
      {
        target: '#tour-qualitative-guide',
        title: '🗣️ Không có công thức, chỉ có mức',
        content: (
          <div className="space-y-2">
            <p>
              Khác định lượng ở chỗ người chấm <strong>chọn thẳng một mức</strong> trong danh sách bạn khai
              ở đây. Ô hướng dẫn màu xanh này giải thích ý nghĩa từng cột ngay tại chỗ.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-qualitative-levels',
        title: '📊 Vị trí · Giá trị · % BSC',
        content: (
          <div className="space-y-2">
            <ul className="text-[11px] space-y-1.5 list-disc pl-4 text-slate-500 font-medium">
              <li><strong className="text-slate-900 dark:text-white">Vị trí:</strong> thứ tự cột khi xuất bảng tính.</li>
              <li><strong className="text-slate-900 dark:text-white">Giá trị:</strong> điểm quy đổi, dùng làm trục cho ma trận xếp loại.</li>
              <li><strong className="text-slate-900 dark:text-white">% BSC:</strong> mức hoàn thành tương ứng khi tính điểm BSC — chỉ hiện khi tổ chức bật BSC.</li>
            </ul>
            {note('Giá trị và % BSC độc lập nhau: một mức có thể đáng 3.5 điểm trên thang 5 mà vẫn tính là 80% hoàn thành.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-qualitative-levels',
        title: '💬 Đặt tên theo ngôn ngữ công ty',
        content: (
          <p>
            Người chấm đọc đúng cái tên bạn gõ ở đây. "Vượt mong đợi / Đạt / Cần cải thiện" dễ chấm nhất
            quán hơn "Mức 1 / Mức 2 / Mức 3".
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/scoring#conduct': {
    title: 'Bộ tiêu chí hạnh kiểm',
    steps: [
      {
        target: '#tour-conduct-sets',
        title: '🤝 Mỗi kỳ một bộ tiêu chí',
        content: (
          <div className="space-y-2">
            <p>
              Một bộ tiêu chí hạnh kiểm là danh sách tiêu chí hành vi kèm <strong>trọng số</strong>. Bộ được
              gán cho một hoặc nhiều kỳ; kỳ nào không được gán thì dùng <strong>bộ mặc định</strong>.
            </p>
            {warn('Không có bộ mặc định thì các kỳ chưa gán sẽ không mở được phiếu chấm — màn hình hạnh kiểm của nhân viên trống trơn.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-conduct-sets',
        title: '⚖️ Tổng trọng số phải bằng 100%',
        content: (
          <div className="space-y-2">
            <p>
              Mở một bộ ra để sửa tên tiêu chí và trọng số. Điểm từng tiêu chí nhân trọng số rồi cộng lại
              thành điểm hạnh kiểm.
            </p>
            {warn('Tổng khác 100% thì điểm tổng không bao giờ đạt đủ thang — phiếu chấm sẽ báo cảnh báo vàng ngay trên đầu bảng.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-conduct-add-set',
        title: '📑 Nhân bản thay vì gõ lại',
        content: (
          <p>
            Kỳ sau chỉ khác vài tiêu chí thì dùng <strong>nhân bản</strong> trên chính bộ cũ rồi sửa, thay
            vì tạo bộ trống. Bộ cũ vẫn giữ nguyên cho các kỳ đã chấm xong.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/matrix': {
    steps: [
      {
        target: '#tour-matrix-guide',
        title: '🔲 Hai trục thành một xếp loại',
        content: (
          <div className="space-y-2">
            <p>
              Ma trận ghép <strong>điểm hành vi</strong> (hàng) với <strong>% hoàn thành KPI</strong> (cột)
              thành xếp loại cuối cùng của một người. Làm tốt việc nhưng thái độ kém, hay ngược lại, đều
              không tự động thành loại cao nhất.
            </p>
            {warn('Chỉ ra xếp loại khi có ĐỦ HAI TRỤC. Người chỉ có một loại KPI thì thiếu một trục — trừ khi tổ chức bật Chấm hạnh kiểm để bù vào.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-matrix-table',
        title: '📐 Đọc bảng theo hai chiều',
        content: (
          <div className="space-y-2">
            <p>
              Ô góc trên trái ghi tên hai trục kèm mũi tên chỉ chiều. Dò hàng theo điểm hành vi, dò cột
              theo % KPI, ô giao nhau chính là <strong>loại</strong> nhân viên nhận được.
            </p>
            {note('Bảng rộng hơn màn hình thì vuốt ngang ngay trong bảng — cột nhãn hàng được ghim lại nên không mất dấu.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-matrix-header',
        title: '✏️ Sửa nhãn, thêm bớt dải',
        content: (
          <div className="space-y-2">
            <p>
              Bấm biểu tượng bút ở đây để mở chế độ sửa: đổi tên hai trục, đổi nhãn từng dải, thêm hàng
              hoặc cột bằng nút <strong>+ Hàng</strong> / <strong>+ Cột</strong>, và điền lại giá trị ô.
            </p>
            {warn('Giá trị ô phải là số nguyên từ 1 trở lên, nhãn không được trùng và không được để trống — hệ thống chặn lưu nếu vi phạm.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/unit-class': {
    steps: [
      {
        target: '#tour-unitclass-header',
        title: '🏢 Xếp loại cho cả đơn vị',
        content: (
          <div className="space-y-2">
            <p>
              Ma trận ở mục trước xếp loại <strong>từng người</strong>. Mục này xếp loại <strong>cả phòng
              ban</strong> theo tỉ lệ nhân sự đạt từng mức bên trong nó.
            </p>
            {note('Nút "?" ngay cạnh nhan đề mở phần giải thích dài; "Đặt lại" đưa hồ sơ về bộ mẫu; "Lưu" ghi mọi hồ sơ cùng lúc.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-unitclass-levels',
        title: '🎨 Thang mức để tra',
        content: (
          <p>
            Hàng mảnh này liệt kê các mức xếp loại đang có kèm màu. Nó là bảng tra dùng suốt lúc soạn điều
            kiện bên dưới — tên mức ở đây chính là tên bạn chọn trong từng điều kiện.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-unitclass-profiles',
        title: '📋 Mỗi hồ sơ một bộ luật',
        content: (
          <div className="space-y-2">
            <p>
              Mở một hồ sơ ra sẽ thấy các <strong>mức xếp loại</strong> xếp từ cao xuống thấp, mỗi mức là
              một chuỗi điều kiện kiểu "≥ 30% nhân sự đạt Loại 4 trở lên".
            </p>
            <p>
              Đơn vị được xếp vào mức <strong>đầu tiên từ trên xuống</strong> mà nó thoả <strong>đủ</strong>
              mọi điều kiện — nên thứ tự mức quan trọng, dùng mũi tên lên/xuống để sắp lại.
            </p>
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-unitclass-add',
        title: '🎯 Một hồ sơ cho mỗi nhóm đơn vị',
        content: (
          <div className="space-y-2">
            <p>
              Thêm hồ sơ khi khối kinh doanh và khối hỗ trợ cần chuẩn khác nhau. Mỗi hồ sơ gán cho một
              nhóm đơn vị (đơn vị con tự kế thừa) và cho một kỳ.
            </p>
            {warn('Nên luôn giữ một hồ sơ mặc định. Đơn vị không khớp hồ sơ nào và cũng không có mặc định thì không ra xếp loại.')}
          </div>
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
        target: '#tour-cycles-header',
        title: '📆 Kỳ gom đợt',
        content: (
          <div className="space-y-2">
            <p>
              Một kỳ là Tháng / Quý / 6 Tháng / Năm. Hai con số trên card cho biết tổ chức đang có bao
              nhiêu kỳ và đã gom được bao nhiêu đợt vào các kỳ đó.
            </p>
            {note('Tạo kỳ trước, rồi sang tab "Đợt đánh giá" gán đợt vào — đợt không thuộc kỳ nào thì không vào được đánh giá tổng hợp.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycles-toolbar',
        title: '🔍 Tìm và lọc kỳ cũ',
        content: (
          <p>
            Lọc theo tên, theo loại kỳ và theo khoảng thời gian. Hai nút ở cuối thanh đổi giữa xem
            <strong> dạng bảng</strong> và <strong>dạng thẻ</strong> — bảng hợp khi đối chiếu ngày tháng,
            thẻ hợp khi lướt nhanh.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cycles-content',
        title: '🔗 Số đợt trên mỗi dòng',
        content: (
          <div className="space-y-2">
            <p>
              Cột <strong>Số đợt</strong> cho biết kỳ đó đã gom được mấy đợt. Kỳ có 0 đợt thì đánh giá kỳ
              sẽ không có gì để tổng hợp.
            </p>
            {warn('Xoá một kỳ không xoá các đợt bên trong — chúng chỉ bị gỡ khỏi kỳ và trở thành đợt rời.')}
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
        target: '#tour-bsc-header',
        title: '🧭 Bộ tiêu chí theo 4 lĩnh vực',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi <strong>bộ tiêu chí</strong> gắn với một kỳ và một phạm vi đơn vị. Bên trong là các hạng
              mục chia theo bốn lĩnh vực của Thẻ điểm cân bằng, mỗi hạng mục một trọng số.
            </p>
            {note('Nút "Import" ở đây nhập được cả bộ tiêu chí kèm trọng số, hoặc chỉ danh mục hạng mục — chọn đúng loại tệp trong menu đổ xuống.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-bsc-scorecards',
        title: '1️⃣ Tạo bộ, rồi thêm hạng mục',
        content: (
          <div className="space-y-2">
            <p>
              Bấm <strong>Bộ tiêu chí mới</strong> để tạo, rồi bấm vào thẻ để mở ra và thêm hạng mục vào
              từng lĩnh vực. Hạng mục phải có trước thì mới có thứ để chia trọng số.
            </p>
            {warn('Tổng trọng số các hạng mục trong một bộ phải bằng 100%. Thẻ nào lệch sẽ báo ngay trên chính thẻ đó.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '.tour-bsc-scorecard-card',
        title: '🚀 Chạy song song rồi mới chính thức',
        content: (
          <div className="space-y-2">
            <p>
              Mỗi bộ có hai chế độ. <strong>Chạy song song</strong>: vẫn tính và lưu điểm BSC để đối chiếu,
              nhưng điểm chính thức vẫn là điểm hệ thống cũ. <strong>Chính thức</strong>: điểm BSC thay
              luôn điểm hệ thống cho các đánh giá chốt từ đó về sau.
            </p>
            {warn('Ở chế độ chính thức, đánh giá bị chặn nếu còn KPI chưa gán hạng mục. Rà cho hết trước khi chuyển.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-bsc-scorecards',
        title: '📊 Xem kết quả ở đâu',
        content: (
          <p>
            Điểm theo từng hạng mục, radar cân bằng và phần đối chiếu BSC với điểm hệ thống nằm ở
            <strong> Phân tích › Hạng mục (BSC)</strong>.
          </p>
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
            {note('Bảng tin phía trên hàng tab là hoạt động thưởng của cả tổ chức — ai vừa được ghi nhận vì việc gì.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: '🗂️ Bảy tab, bốn nhóm việc',
        content: (
          <div className="space-y-2">
            <ul className="text-[11px] space-y-1.5 list-disc pl-4 text-slate-500 font-medium">
              <li><strong className="text-slate-900 dark:text-white">Trao &amp; duyệt:</strong> Đề nghị thưởng, Hạn mức.</li>
              <li><strong className="text-slate-900 dark:text-white">Tự động:</strong> Chương trình tự động, Điểm danh.</li>
              <li><strong className="text-slate-900 dark:text-white">Ghi nhận:</strong> Mẫu chứng nhận.</li>
              <li><strong className="text-slate-900 dark:text-white">Đổi quà:</strong> Quà tặng, Yêu cầu đổi quà.</li>
            </ul>
            {note('Số vàng trên tab là số việc đang chờ bạn xử lý — có số thì vào tab đó trước.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: '🚦 Thứ tự dựng lần đầu',
        content: (
          <p>
            Tổ chức mới nên đi: <strong>Hạn mức</strong> (để quản lý tự thưởng được) →{' '}
            <strong>Quà tặng</strong> (để điểm có chỗ tiêu) → rồi mới bật{' '}
            <strong>Điểm danh</strong> và <strong>Chương trình tự động</strong>.
          </p>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/rewards#grants': {
    title: 'Đề nghị thưởng',
    steps: [
      {
        target: '#tour-grants-filters',
        title: '🔖 Lọc theo trạng thái',
        content: (
          <div className="space-y-2">
            <p>
              Sáu trạng thái hiện hết ra thành chip, không giấu trong dropdown. Đang chờ duyệt là việc của
              bạn; các trạng thái còn lại để tra cứu lại về sau.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-grants-root',
        title: '🤝 Trong hạn mức thì không cần duyệt',
        content: (
          <div className="space-y-2">
            <p>
              Quản lý trao điểm <strong>trong hạn mức</strong> của mình thì có hiệu lực ngay. Vượt hạn mức,
              hoặc vượt mức tối đa mỗi lần, thì thành đề nghị nằm chờ ở đây.
            </p>
            {warn('Duyệt là điểm vào ví nhân viên ngay. Thu hồi được, nhưng nhân viên đã thấy thông báo — nên đọc lý do trước khi bấm.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-grants-root',
        title: '✍️ Trao điểm mới',
        content: (
          <p>
            Nút <strong>Thưởng điểm</strong> nằm trên card ở đầu mục. Chọn người, nhập số điểm và ghi lý do
            — lý do là thứ hiện lên bảng tin cho cả tổ chức đọc, nên viết cụ thể việc đã làm.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#budgets': {
    title: 'Hạn mức thưởng',
    steps: [
      {
        target: '#tour-budgets-note',
        title: '💰 Hạn mức để khỏi phải xin duyệt',
        content: (
          <div className="space-y-2">
            <p>
              Người có hạn mức tự thưởng được ngay. Vượt hạn mức hoặc vượt mức tối đa mỗi lần thì lượt trao
              đó chuyển thành đề nghị chờ duyệt.
            </p>
            {warn('Không cấp hạn mức cho ai thì mọi lượt trao điểm đều dồn vào hàng chờ duyệt của bạn.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-budgets-root',
        title: '⏳ Hiệu lực có thời hạn',
        content: (
          <div className="space-y-2">
            <p>
              Dòng chữ trên bảng đếm riêng số hạn mức <strong>đang hiệu lực</strong>, không gộp hạn mức đã
              hết hạn. Mỗi hạn mức có khoảng thời gian riêng và thanh tiến trình cho biết đã dùng bao nhiêu.
            </p>
            {note('Hạn mức hết hạn không tự gia hạn. Đầu kỳ mới nên rà lại danh sách này.')}
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
        target: '#tour-programs-note',
        title: '⚙️ "Tự động" nhưng vẫn phải bấm chạy',
        content: (
          <div className="space-y-2">
            <p>
              Chương trình <strong>không tự chạy theo lịch</strong>. Bạn bấm <strong>▷ Chạy</strong>, chọn
              đợt/kỳ, xem trước bảng xếp hạng, rồi mới phát điểm.
            </p>
            {note('Bậc thưởng khai trong cấu hình chỉ là mặc định — mỗi lần chạy vẫn sửa lại được cho riêng lần đó.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-programs-actions',
        title: '🏆 Đặt luật một lần',
        content: (
          <p>
            <strong>Tạo chương trình</strong> để khai luật: ai lọt top của đợt/kỳ thì được bao nhiêu điểm.
            Hợp với những khoản lặp lại đều đặn; khoản đột xuất thì dùng tab Đề nghị thưởng.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-programs-root',
        title: '🏦 Điểm lấy từ quỹ chung',
        content: (
          <p>
            Điểm phát từ chương trình lấy từ <strong>quỹ chung của tổ chức</strong>, không trừ vào hạn mức
            cá nhân của quản lý nào.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#checkin': {
    title: 'Điểm danh',
    steps: [
      {
        target: '#tour-checkin-note',
        title: '📅 Nhân viên tự bấm mỗi ngày',
        content: (
          <div className="space-y-2">
            <p>
              Thẻ điểm danh hiện ở trang <strong>Của tôi › Điểm của tôi</strong>. Nhân viên bấm là điểm vào
              thẳng ví của họ, không trừ hạn mức của quản lý nào.
            </p>
            {warn('Điểm mỗi lượt nhân với số nhân sự nhân với số ngày làm việc — con số nhỏ ở đây cộng dồn rất nhanh.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-checkin-stats',
        title: '📈 Hai con số để cân mức điểm',
        content: (
          <p>
            <strong>Đã điểm danh hôm nay</strong> cho biết bao nhiêu người thực sự dùng, còn{' '}
            <strong>Điểm đã phát tháng này</strong> là chi phí thật của tính năng. Nhìn hai số này trước khi
            tăng điểm mỗi lượt.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-checkin-form',
        title: '🎚️ Bật, đặt điểm, thưởng chuỗi',
        content: (
          <div className="space-y-2">
            <p>
              Công tắc đầu tiên bật/tắt cả tính năng — tắt thì thẻ biến mất khỏi màn hình nhân viên, lịch
              sử điểm đã phát vẫn giữ nguyên. Bên dưới là điểm mỗi lượt và mức thưởng thêm cho chuỗi ngày
              liên tiếp.
            </p>
            {note('Luật tính chuỗi do máy chủ quyết định, không phải trình duyệt — đổi giờ máy cá nhân không lách được.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#certificates': {
    title: 'Mẫu chứng nhận',
    steps: [
      {
        target: '#tour-certificates-intro',
        title: '🏅 Giấy khen của riêng công ty',
        content: (
          <div className="space-y-2">
            <p>
              Chưa tạo mẫu nào thì màn hình in vẫn có sẵn sáu thiết kế. Mẫu ở đây là bản riêng của công ty
              bạn — có logo, chữ ký và lời văn cố định.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-certificates-root',
        title: '🖨️ Dùng khi nào',
        content: (
          <p>
            Mẫu được dùng lúc in chứng nhận cho một lượt thưởng. Không phải lượt thưởng nào cũng có giấy
            khen — chỉ những lượt cấp trên chọn kèm chứng nhận mới hiện ở "Của tôi › Điểm của tôi ›
            Chứng nhận".
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/rewards#gifts': {
    title: 'Quà tặng',
    steps: [
      {
        target: '#tour-gifts-actions',
        title: '🛍️ Danh mục quà đổi điểm',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Thêm quà</strong> để khai món mới: tên, ảnh, giá theo điểm và số lượng còn lại. Đây
              chính là những gì nhân viên thấy ở "Của tôi › Điểm của tôi › Cửa hàng quà".
            </p>
            {note('Có nút "Kho quà UrBox" khi tổ chức bật tích hợp — lấy voucher có sẵn thay vì tự nhập từng món.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-gifts-root',
        title: '📦 Hết hàng thì tự khoá',
        content: (
          <div className="space-y-2">
            <p>
              Số lượng về 0 thì món đó hiện là hết hàng bên phía nhân viên, không đổi được nữa. Muốn ngừng
              hẳn một món thì sửa số lượng chứ không cần xoá — xoá làm mất lịch sử đổi quà cũ.
            </p>
            {warn('Cửa hàng trống thì điểm thưởng không dùng được vào việc gì. Khai vài món trước khi bật module thưởng.')}
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
        target: '#tour-redemptions-filters',
        title: '📦 Hàng chờ giao quà',
        content: (
          <div className="space-y-2">
            <p>
              Lọc theo trạng thái để tách phần <strong>chờ xử lý</strong> khỏi phần đã giao. Số trên tab
              đếm đúng phần đang chờ.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-redemptions-root',
        title: '⏱️ Điểm trừ ngay lúc đổi',
        content: (
          <div className="space-y-2">
            <p>
              Nhân viên bấm đổi là điểm bị trừ ngay, chưa cần bạn duyệt. Yêu cầu nằm ở đây chờ bạn xác nhận
              đã giao quà.
            </p>
            {warn('Xử lý chậm nghĩa là người ta đã mất điểm mà chưa nhận được gì — đây là nguồn khiếu nại phổ biến nhất của module thưởng.')}
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
              Ví tách hẳn khỏi điểm thưởng: số dư ở đây là tiền, có nạp vào qua chuyển khoản và có đối soát
              với ngân hàng.
            </p>
            {warn('Đừng nhầm hai số dư. Tiền đổi được sang điểm, nhưng điểm KHÔNG quy ngược lại thành tiền.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-workspace-tabs',
        title: '🗂️ Xem, cấu hình, đối soát',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Số dư nhân sự</strong> để tra cứu, <strong>Cấu hình</strong> để đặt tài khoản nhận
              tiền và tỉ giá, <strong>Đối soát SePay</strong> để khớp giao dịch chuyển khoản.
            </p>
            {note('Dựng lần đầu thì vào Cấu hình trước — chưa có số tài khoản thì nhân viên không tạo được đơn nạp.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/wallet#wallets': {
    title: 'Số dư nhân sự',
    steps: [
      {
        target: '#tour-cashwallets-stats',
        title: '👛 Ba con số của cả tổ chức',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Đang giữ</strong> là tiền đã nạp mà chưa đổi thành điểm — phần này tổ chức đang nợ
              nhân viên. <strong>Đã đổi ra điểm</strong> là phần đã tiêu. <strong>Số ví</strong> đếm người
              đã từng nạp ít nhất một lần.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cashwallets-filters',
        title: '🔍 Tra cứu khi có khiếu nại',
        content: (
          <p>
            Tìm theo tên hoặc email, lọc theo đơn vị, rồi mở một ví ra xem toàn bộ lịch sử biến động của
            người đó.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-cashwallets-stats',
        title: '🚨 Ví lệch sổ',
        content: (
          <div className="space-y-2">
            <p>
              Khi có ví lệch so với sổ cái, một dải đỏ hiện ngay dưới ba ô này. Bấm vào dải đó để lọc đúng
              những ví đang lệch — đây là đường duy nhất xem chúng là ví nào.
            </p>
            {warn('Ví lệch sổ là lỗi dữ liệu tiền tệ, không phải cảnh báo nghiệp vụ. Cần kiểm tra ngay chứ không để tồn.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/wallet#config': {
    title: 'Cấu hình ví',
    steps: [
      {
        target: '#tour-wallet-bank',
        title: '🏧 Tài khoản nhận tiền',
        content: (
          <div className="space-y-2">
            <p>
              Số tài khoản và mã ngân hàng là <strong>hai trường bắt buộc</strong> để dựng mã VietQR. Thiếu
              chúng thì nhân viên không tạo được đơn nạp.
            </p>
            {warn('Điền xong mà mãi không thấy giao dịch nào về thường là gõ nhầm số tài khoản, hoặc chưa liên kết bên SePay. Chuyển thử một khoản nhỏ là cách nhanh nhất để biết cả chuỗi đã thông.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-wallet-rate',
        title: '💱 Tỉ giá quy đổi',
        content: (
          <div className="space-y-2">
            <p>
              Số tiền đổi được 1 điểm. Bảng <strong>"Nhân viên sẽ thấy"</strong> bên cạnh quy đổi sẵn vài
              mức hay gặp, để bạn thấy ngay hệ quả của con số vừa nhập.
            </p>
            {note('Giao dịch đã thực hiện giữ nguyên tỉ giá cũ trong lịch sử, nên đổi con số này không làm sai số liệu quá khứ.')}
          </div>
        ),
        placement: 'top',
      },
      {
        target: '#tour-wallet-limits',
        title: '⏲️ Hạn mức và hạn giờ của mã QR',
        content: (
          <p>
            Giới hạn số tiền mỗi lần nạp và thời gian sống của mã QR. Mã hết hạn thì đơn nạp tự huỷ, nhân
            viên tạo đơn mới — đặt quá ngắn sẽ sinh nhiều đơn treo.
          </p>
        ),
        placement: 'top',
      },
    ],
  },

  'setup-tools/wallet#reconcile': {
    title: 'Đối soát SePay',
    steps: [
      {
        target: '#tour-sepay-status',
        title: '🧾 Sổ có cân không',
        content: (
          <div className="space-y-2">
            <p>
              Dải trên cùng nói thẳng tình trạng: xanh là sổ cân, vàng là còn giao dịch chưa khớp đơn, lệch
              số tiền, hoặc có ví lệch sổ cái.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-sepay-scope',
        title: '🔀 Hàng đợi hay tất cả',
        content: (
          <div className="space-y-2">
            <p>
              <strong>Hàng đợi</strong> chỉ hiện giao dịch cần bạn xử lý. <strong>Tất cả</strong> hiện mọi
              giao dịch hệ thống nhận được, dùng khi tra cứu lại một khoản cũ.
            </p>
            {note('Giao dịch chưa khớp thường do nhân viên chuyển sai nội dung. Mở giao dịch ra để gán tay vào đúng đơn nạp.')}
          </div>
        ),
        placement: 'bottom',
      },
    ],
  },

  'setup-tools/ai-quota': {
    steps: [
      {
        target: '#tour-aiquota-mine',
        title: '🪙 Hạn mức của chính bạn',
        content: (
          <div className="space-y-2">
            <p>
              Thẻ trên cùng là token AI của riêng bạn — phần bạn dùng khi chat với K.AI. Nó tách khỏi túi
              dùng để chia cho người khác ở ngay bên dưới.
            </p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-aiquota-pool',
        title: '📊 Túi để phân bổ',
        content: (
          <div className="space-y-2">
            <p>
              Ba ô này cho biết còn bao nhiêu để chia. Với quản lý cao nhất, túi là ngân sách của cả công
              ty; với trưởng đơn vị, túi lấy chính từ hạn mức cá nhân của họ.
            </p>
            {warn('Túi bằng 0 thì không chia được cho ai. Công ty chưa được cấp ngân sách thì phải liên hệ quản trị hệ thống.')}
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-aiquota-delegation',
        title: '🔁 Cho cấp dưới tự chia',
        content: (
          <p>
            Bật công tắc này thì trưởng đơn vị chia được token cho nhân sự của họ — và phần chia đó trừ vào
            chính hạn mức của họ, không đụng tới túi của bạn.
          </p>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-aiquota-people',
        title: '📉 Hết hạn mức thì trợ lý ngừng trả lời',
        content: (
          <div className="space-y-2">
            <p>
              Tìm người theo tên, lọc theo vai trò và trạng thái, rồi đặt hạn mức cho từng người. Ai dùng
              hết phần được chia thì K.AI ngừng trả lời cho tới khi được cấp thêm.
            </p>
            {note('Hạn mức đặt lại theo tháng — phần chưa dùng hết không cộng dồn sang tháng sau.')}
          </div>
        ),
        placement: 'top',
      },
    ],
  },
}

export default setupToolsTours
