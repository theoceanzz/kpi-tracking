import { create } from 'zustand'
import type { RequestDraft } from '@/features/ai/chat/api/aiApi'

/**
 * Bản nháp ĐƠN TỪ K.AI vừa điền hộ, chờ hộp nộp đơn nhận. Thẻ trong khung chat gọi `open` rồi điều hướng tới
 * `/requests?tab=submit&form=<id>`; hộp nộp đơn của đúng mẫu đó `peek` lúc dựng (không đổi store — StrictMode gọi
 * hàm khởi tạo hai lần) rồi `clear` sau khi gắn, nên mở lại mẫu đó lần sau không bị điền lại bản cũ.
 */
interface RequestDraftState {
  pending: RequestDraft | null
  open: (draft: RequestDraft) => void
  peek: (formId: string) => RequestDraft | null
  clear: () => void
}

export const useRequestDraftStore = create<RequestDraftState>((set, get) => ({
  pending: null,
  open: draft => set({ pending: draft }),
  peek: formId => {
    const d = get().pending
    return d && d.formId === formId ? d : null
  },
  clear: () => set({ pending: null }),
}))
