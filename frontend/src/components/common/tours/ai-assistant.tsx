import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'

/**
 * Hướng dẫn cho "K.AI" — trang trợ lý toàn màn hình.
 *
 * Trang không có mục con, và cũng không có neo `tour-*` nào: nó là một khung hội thoại
 * chiếm trọn màn hình chứ không phải bảng biểu có các khối rời. Dùng bước căn giữa —
 * nội dung cần nói ở đây là "hỏi được cái gì" chứ không phải "ô này nằm đâu".
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

const aiAssistantTours: Record<TourKey, TourDef> = {
  'ai-assistant': {
    steps: [
      {
        target: 'body',
        title: '🤖 Hỏi thẳng bằng tiếng Việt',
        content: (
          <div className="space-y-2">
            <p>
              K.AI đọc được dữ liệu KPI trong phạm vi bạn có quyền xem. Hỏi như hỏi một đồng nghiệp:
              "phòng nào đang chậm nhất kỳ này", "so sánh quý trước với quý này".
            </p>
            <p className="text-[11px] text-slate-500">
              Trợ lý chỉ thấy đúng những gì bạn được thấy — nó không vượt qua phân quyền.
            </p>
          </div>
        ),
        placement: 'center',
      },
      {
        target: 'body',
        title: '💡 Gợi ý và hội thoại cũ',
        content: (
          <div className="space-y-2">
            <p>
              Các thẻ gợi ý ở đầu màn là những phát hiện trợ lý tự rút ra từ số liệu hiện tại — bấm vào
              để hỏi sâu thêm. Cột bên trái lưu lại các cuộc hội thoại trước.
            </p>
            {note('Hội thoại được giữ theo mạch, nên hỏi tiếp "còn phòng B thì sao" mà không cần nhắc lại bối cảnh.')}
          </div>
        ),
        placement: 'center',
      },
      {
        target: 'body',
        title: '🪙 Mỗi câu hỏi tốn hạn mức',
        content: (
          <div className="space-y-2">
            <p>
              Trợ lý dùng hạn mức token mà đơn vị bạn được chia hằng tháng. Hết hạn mức thì K.AI ngừng
              trả lời cho tới kỳ sau hoặc tới khi được cấp thêm.
            </p>
            {warn('Số liệu do trợ lý tóm tắt vẫn nên đối chiếu ở phần Phân tích trước khi đưa vào báo cáo chính thức.')}
          </div>
        ),
        placement: 'center',
      },
    ],
  },
}

export default aiAssistantTours
