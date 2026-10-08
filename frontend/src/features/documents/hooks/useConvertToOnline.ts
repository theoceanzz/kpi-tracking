import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { convertToOnline } from '../editor/autoConvert'
import type { KbDocument } from '../types'

interface ConvertInput {
  doc: KbDocument
  /** Khối đã có sẵn (trình soạn .md truyền nội dung đang mở). */
  content?: string
  /** `contentHash` của đúng bản đã chuyển; mặc định là bản hiện hành của `doc`. */
  baseHash?: string
}

/**
 * Chuyển tại chỗ một tệp .md đang mở trong trình soạn sang tài liệu soạn trực tuyến đủ định dạng (tệp .md vào tab Phiên
 * bản). Tệp tải lên mới thì tự chuyển ngay khi tải (`autoConvert`), không cần nút này.
 */
export function useConvertToOnline() {
  const { t } = useTranslation('documents')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ doc, content, baseHash }: ConvertInput) => convertToOnline(doc, content, baseHash),
    onSuccess: converted => {
      qc.setQueryData(['documents', 'one', converted.id], converted)
      qc.removeQueries({ queryKey: ['document-content', converted.id] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success(t('toast.convertedOnline'))
    },
    onError: e => {
      console.error('Chuyển tài liệu thành tài liệu trực tuyến thất bại', e)
      toast.error(getApiErrorMessage(e, t('toast.convertFailed')))
    },
  })
}
