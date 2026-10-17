import i18n from 'i18next'
import { toast } from 'sonner'
import { toastUploadError } from '@/lib/upload'
import { documentApi } from '../api/documentApi'

/** Khớp `DocumentImageService` phía máy chủ (máy chủ vẫn kiểm lại theo nội dung tệp). */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'
const IMAGE_TYPES = new Set(IMAGE_ACCEPT.split(','))
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Tải một ảnh của trình soạn (nút Ảnh, dán Ctrl+V, kéo thả) lên kho công khai và trả URL — BlockNote gọi hàm này qua
 * `uploadFile`, nên dán / thả ảnh vào tài liệu hay thư là tự lên. Sai loại / quá lớn thì báo ngay, không gửi lên.
 */
export async function uploadEditorImage(file: File): Promise<string> {
  const t = i18n.getFixedT(null, 'shared')
  if (!IMAGE_TYPES.has(file.type)) {
    toast.error(t('EditorToolbar.imageType'))
    throw new Error('unsupported image type')
  }
  if (file.size > MAX_BYTES) {
    toast.error(t('EditorToolbar.imageTooLarge'))
    throw new Error('image too large')
  }
  try {
    return await documentApi.uploadImage(file)
  } catch (e) {
    toastUploadError(e, undefined, t('EditorToolbar.imageFailed'))
    throw e
  }
}
