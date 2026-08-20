import { create } from 'zustand'

/** Định danh form, phải khớp với FormRegistry phía backend. */
export type AssistFormId =
  | 'kpi_form'
  | 'submission_form'
  | 'evaluation_form'
  | 'kpi_adjustment_form'
  | 'org_unit_form'
  | 'org_unit_drawer_form'

export interface RegisteredForm {
  formId: AssistFormId
  /**
   * Đọc giá trị các ô NGAY LÚC GỌI. Cố ý là hàm chứ không phải dữ liệu trong store: nếu form đẩy
   * giá trị vào store mỗi lần gõ phím thì mọi thành phần đang nghe store sẽ vẽ lại theo từng ký tự.
   * Trợ lý chỉ cần giá trị đúng một lần — lúc gửi câu hỏi đi.
   */
  getValues: () => Record<string, unknown>
  /** Điền một ô. Chỉ được gọi khi người dùng bấm chấp nhận đề xuất. */
  setValue: (field: string, value: unknown) => void
}

interface FormAssistState {
  /** Form đang mở, hoặc null. Chỉ đổi khi mở/đóng form nên không gây vẽ lại theo từng ký tự. */
  active: RegisteredForm | null
  register: (form: RegisteredForm) => void
  /** Truyền formId để form đóng muộn không xoá nhầm đăng ký của form vừa mở sau nó. */
  unregister: (formId: AssistFormId) => void
}

/**
 * Cho form đang mở trên màn hình tự giới thiệu với trợ lý AI.
 *
 * <p>Widget trợ lý nằm ở AppLayout nên nó nổi trên mọi trang, nhưng không có cách nào biết người
 * dùng đang mở modal nào — các form là modal cục bộ trong từng feature. Store này là chỗ gặp nhau:
 * form đăng ký lúc mở, huỷ lúc đóng; widget chỉ đọc.
 */
export const useFormAssistStore = create<FormAssistState>((set, get) => ({
  active: null,
  register: form => set({ active: form }),
  unregister: formId => {
    // Mở form B trong khi form A đang đóng dở thì cleanup của A chạy SAU register của B.
    // Không kiểm formId ở đây là xoá mất đăng ký của B.
    if (get().active?.formId === formId) set({ active: null })
  },
}))
