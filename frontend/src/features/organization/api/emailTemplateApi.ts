import axiosInstance from '@/lib/axios'
import type { Language } from '@/i18n/languages'
import type { ApiResponse } from '@/types/api'

/** Matches BE: EmailTemplateResponse */
export interface EmailTemplate {
  code: string
  label: string
  description: string
  group: string
  subject: string
  /**
   * HTML thân email. Các khối đặc thù (nút bấm, ô mã, bảng thông tin, khung nhấn mạnh)
   * mang thuộc tính `data-email` để trình soạn đọc ngược lại thành node sửa được.
   */
  body: string
  /** true = body là toàn bộ HTML, hệ thống không bọc khung header/footer. */
  fullHtml: boolean
  enabled: boolean
  /**
   * Ai làm chủ công tắc bật/tắt gửi:
   * `self` — ngay tại màn hình này;
   * `notification_settings` — thuộc tab Thiết lập thông báo;
   * `locked` — không được tắt (mail bảo mật).
   */
  enabledControl: 'self' | 'notification_settings' | 'locked'
  /** true = tổ chức đã tuỳ chỉnh; false = đang dùng bản mặc định. */
  customized: boolean
  defaultSubject: string
  defaultBody: string
  /** Tên biến → mô tả, dùng làm chip bấm-để-chèn. */
  variables: Record<string, string>
  /** Biến không được xoá — thiếu thì lưu sẽ báo lỗi. */
  requiredVariables: string[]
}

export interface SaveEmailTemplatePayload {
  subject: string
  body: string
  fullHtml: boolean
  enabled: boolean
}

/**
 * `language` là ngôn ngữ của BẢN MAIL đang cấu hình — mỗi ngôn ngữ một bản tuỳ chỉnh riêng, người nhận
 * nhận bản theo ngôn ngữ của họ. Không phải ngôn ngữ giao diện của người đang cấu hình.
 */
export const emailTemplateApi = {
  list: (language: Language) =>
    axiosInstance.get<ApiResponse<EmailTemplate[]>>('/email-templates', { params: { language } }).then(r => r.data.data),

  save: (code: string, language: Language, payload: SaveEmailTemplatePayload) =>
    axiosInstance.put<ApiResponse<EmailTemplate>>(`/email-templates/${code}`, payload, { params: { language } }).then(r => r.data.data),

  /** Xoá bản tuỳ chỉnh để quay về nội dung mặc định. */
  reset: (code: string, language: Language) =>
    axiosInstance.delete<ApiResponse<EmailTemplate>>(`/email-templates/${code}`, { params: { language } }).then(r => r.data.data),

  /**
   * Tải ảnh lên Cloudinary, trả về URL để chèn vào nội dung.
   * Không nhúng base64 vì HTML sẽ phình rất lớn và nhiều mail client chặn.
   */
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    // Phải khai multipart thủ công: axiosInstance đặt mặc định Content-Type là
    // application/json cho mọi request, đè lên header mà axios tự sinh cho FormData.
    return axiosInstance
      .post<ApiResponse<{ url: string }>>('/email-templates/images', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data.data.url)
  },

  preview: (code: string, language: Language, payload: SaveEmailTemplatePayload) =>
    axiosInstance
      .post<ApiResponse<{ subject: string; html: string; source: string }>>(
        `/email-templates/${code}/preview`, payload, { params: { language } })
      .then(r => r.data.data),
}
