import { create } from 'zustand'

/** Một yêu cầu mở K.AI kèm câu hỏi đã soạn sẵn — từ nút "K.AI" trên một trang nghiệp vụ. */
export interface AiAsk {
  /** Tăng dần; bên tiêu thụ ghi nhớ id đã xử lý để không gửi trùng khi render lại. */
  id: number
  prompt: string
  /** Đơn vị trang đang xem: backend đặt làm "đơn vị hiện tại" của lượt (như thẻ Insight). */
  focusUnitId?: string
}

interface AiAssistantState {
  /** Yêu cầu đang chờ khung chat tiêu thụ; null khi không có. */
  pending: AiAsk | null
  ask: (prompt: string, opts?: { focusUnitId?: string }) => void
  /** Khung chat gọi sau khi đã gửi; chỉ xoá nếu vẫn đúng yêu cầu đó (bấm hai lần nhanh không mất cái sau). */
  take: (id: number) => void
}

let nextId = 1

/**
 * Cầu nối giữa các trang và bong bóng K.AI.
 *
 * <p>Bong bóng giữ trạng thái mở/đóng và ô nhập cục bộ (nó là một component trong AppLayout), nên
 * một trang không có cách nào "mở chat và hỏi câu này". Store này là hộp thư một ngăn: trang bỏ
 * câu hỏi vào, bong bóng (hoặc trang /ai-assistant) lấy ra, mở khung và tự gửi — người dùng không
 * phải bấm Enter. Không xếp hàng: bấm nút thứ hai khi câu đầu chưa được lấy thì câu sau thay câu
 * trước, đúng như người dùng đổi ý.
 */
export const useAiAssistantStore = create<AiAssistantState>((set, get) => ({
  pending: null,
  ask: (prompt, opts) => {
    const text = prompt.trim()
    if (!text) return
    set({ pending: { id: nextId++, prompt: text, focusUnitId: opts?.focusUnitId } })
  },
  take: id => {
    if (get().pending?.id === id) set({ pending: null })
  },
}))
