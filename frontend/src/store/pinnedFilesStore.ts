import { create } from 'zustand'
import { toast } from 'sonner'
import type { FormFileSink } from './formAssistStore'

interface PinnedFilesState {
  /** Tệp người dùng đã ghim ở ô chat, CHƯA đính vào đâu cả. */
  files: File[]
  pin: (files: File[]) => void
  unpin: (file: File) => void
  clear: () => void
}

/**
 * Tệp người dùng đã ghim ở ô chat, đang chờ một lệnh.
 *
 * <p><b>Không phải `evidenceDraftStore` sống lại.</b> Kho cũ là "minh chứng đang chờ BIỂU MẪU BÁO
 * CÁO" — một lớp trung gian thừa sau khi form biết tự khai `fileSink`, nên xoá là đúng. Kho này là
 * "tệp đang ghim ở Ô CHAT, chờ người dùng bảo đính", không biết gì về biểu mẫu nào, và tồn tại vì
 * bản thân việc ghim là một trạng thái người dùng NHÌN THẤY.
 *
 * <p>Phải là store chứ không phải state của component: widget trợ lý nổi trên mọi trang nhưng trang
 * `/ai-assistant` thì unmount khi điều hướng. Để trong component là tái lập đúng lỗi mất tệp im
 * lặng của bản đầu — ghim tệp, đi sang trang khác, tệp biến mất không báo gì.
 *
 * <p>Cố ý KHÔNG lưu xuống đĩa: đối tượng `File` không serialize được. Đóng tab là mất ghim.
 */
export const usePinnedFilesStore = create<PinnedFilesState>(set => ({
  files: [],
  pin: files => set(state => ({ files: [...state.files, ...files] })),
  // So bằng chính đối tượng File chứ không theo chỉ số: ô chat và form vẽ từ hai lần render khác
  // nhau, chỉ số có thể đã lệch giữa lúc vẽ và lúc bấm.
  unpin: file => set(state => ({ files: state.files.filter(f => f !== file) })),
  clear: () => set({ files: [] }),
}))

/**
 * Chuyển tệp đang ghim vào chỗ nhận tệp của form đang mở.
 *
 * <p>Là chỗ DUY NHẤT làm việc này. Cả hai đường — trợ lý gọi tool, và người dùng bấm nút "Đính vào
 * biểu mẫu" — đều đi qua đây, nên hai đường không thể lệch nhau về phép kiểm hay về việc dọn ghim.
 *
 * @returns tên các tệp thực sự vào được form; rỗng nghĩa là không có gì đổi
 */
export function attachPinnedTo(sink: FormFileSink | undefined): string[] {
  if (!sink) {
    toast.error('Chưa mở biểu mẫu nào có mục đính kèm')
    return []
  }
  const pinned = usePinnedFilesStore.getState().files
  if (!pinned.length) return []

  const { accepted, rejected } = sink.add(pinned)
  rejected.forEach(r => toast.error(r.reason))
  // Chỉ bỏ ghim phần ĐƯỢC NHẬN. Tệp bị từ chối vẫn nằm ghim để người dùng thấy và tự bỏ — biến mất
  // lặng lẽ cùng lúc với một câu toast là kiểu hỏng dễ bỏ sót nhất.
  accepted.forEach(f => usePinnedFilesStore.getState().unpin(f))
  return accepted.map(f => f.name)
}
