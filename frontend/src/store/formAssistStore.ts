import { create } from 'zustand'
import type { Accept } from 'react-dropzone'

/** Một tệp bị từ chối, kèm câu nói cho người dùng đọc. */
export interface RejectedFile {
  file: File
  reason: string
}

/**
 * Một chỗ NHẬN TỆP trên form đang mở. Vắng trường này = form đó không nhận tệp.
 *
 * <p>Đây là năng lực TUỲ CHỌN của form, không phải thứ trợ lý phải biết trước. Nhờ vậy ô chat lập
 * trình theo interface này chứ không theo `submission_form`: thêm một form biết đính kèm về sau chỉ
 * là khai thêm một `fileSink`, không phải sửa lại ô chat.
 *
 * <p>Phép kiểm nằm TRONG sink chứ không ở phía chat: mỗi form có quyền có giới hạn riêng, và ô chat
 * thì không nên biết giới hạn của bất kỳ form nào. `accept`/`maxSize`/`hint` chỉ dùng để VẼ (thuộc
 * tính accept của input, viền vùng thả, dòng mô tả) — không dùng để quyết định nhận hay từ chối.
 */
export interface FormFileSink {
  /** Tên mục hiển thị, vd "Tài liệu chứng minh". Ô chat lấy chữ từ đây, không tự bịa. */
  label: string
  accept: Accept
  maxSize: number
  maxFiles: number
  /** Dòng mô tả giới hạn, hiện dưới vùng thả. */
  hint: string
  /** Tệp đang có, đọc NGAY LÚC GỌI — để đếm trần và để báo tên cho trợ lý. */
  current: () => File[]
  /** Nhận tệp. TỰ kiểm và trả về phần bị từ chối kèm lý do. */
  add: (files: File[]) => { accepted: File[]; rejected: RejectedFile[] }
  /**
   * Gỡ một tệp đã đính. Nhận chính đối tượng File chứ không nhận chỉ số: ô chat và form vẽ từ hai
   * lần render khác nhau, chỉ số có thể đã lệch giữa lúc vẽ và lúc bấm.
   */
  remove: (file: File) => void
}

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
  /**
   * Các ô ĐANG hiện trên màn hình và ĐANG sửa được, đọc ngay lúc gọi.
   *
   * <p>Không có nó thì trợ lý điền được ô mà người dùng không nhìn thấy. Đo được ca thật: KPI định
   * lượng thì ô "Mức định tính" không được vẽ ra, nhưng React Hook Form vẫn giữ giá trị của ô chưa
   * mount, `getValues()` vẫn trả nó, và trợ lý điền vào rồi báo "đã điền" — người dùng không có
   * chỗ nào để nhìn thấy hay xoá đi.
   *
   * <p>Là HÀM chứ không phải mảng trong store, cùng lý do với `getValues`: điều kiện hiện/ẩn đổi
   * theo state (loại KPI đang chọn, chế độ tạo/sửa, readOnly), đẩy vào store mỗi lần đổi là bắt
   * mọi thành phần đang nghe vẽ lại theo.
   *
   * <p>Đây chỉ là lớp THU HẸP. Máy chủ lấy giao với bản khai báo của nó, nên một client bị sửa
   * cùng lắm tự bó tay mình chứ không bịa thêm được ô nào.
   */
  fillableFields: () => string[]
  /** Điền một ô. Chỉ được gọi khi người dùng bấm chấp nhận đề xuất. */
  setValue: (field: string, value: unknown) => void
  /**
   * Chỗ nhận tệp của form này, nếu có. Vắng = form không đính kèm được, và ô chat tắt nút kẹp tệp
   * kèm câu giải thích thay vì nhận tệp rồi chẳng biết đưa đi đâu.
   */
  fileSink?: FormFileSink
}

interface FormAssistState {
  /** Form đang mở, hoặc null. Chỉ đổi khi mở/đóng form nên không gây vẽ lại theo từng ký tự. */
  active: RegisteredForm | null
  /**
   * Ảnh chụp tệp đang đính kèm của form đang mở, CHỈ để vẽ.
   *
   * <p>`fileSink.current()` đọc qua ref nên nhanh nhưng KHÔNG phản ứng: ô chat sẽ không vẽ lại khi
   * người dùng gỡ một tệp ngay trên form, và thẻ tệp ở ô nhập sẽ đứng hình sai. Ảnh chụp này chảy
   * MỘT CHIỀU (form → store → ô chat) nên form vẫn là nơi giữ sự thật, không phải bản sao thứ hai.
   *
   * <p>Đổi hiếm (mỗi lần thêm/gỡ tệp) nên để dữ liệu trong store ở đây là được — khác `getValues`
   * vốn đổi theo từng ký tự.
   */
  attachedFiles: File[]
  setAttachedFiles: (files: File[]) => void
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
  attachedFiles: [],
  setAttachedFiles: files => set({ attachedFiles: files }),
  register: form => set({ active: form }),
  unregister: formId => {
    // Mở form B trong khi form A đang đóng dở thì cleanup của A chạy SAU register của B.
    // Không kiểm formId ở đây là xoá mất đăng ký của B.
    // Ảnh chụp tệp cũng phải dọn cùng lúc, nếu không thẻ tệp của form vừa đóng còn treo ở ô chat.
    if (get().active?.formId === formId) set({ active: null, attachedFiles: [] })
  },
}))
