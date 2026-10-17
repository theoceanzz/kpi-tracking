import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { screenEvidence } from '@/lib/attachmentPolicy'
import { usePinnedFilesStore } from '@/store/pinnedFilesStore'

/**
 * Cho THẢ TỆP VÀO BẤT KỲ ĐÂU trong khung chat — tệp rơi vào chỗ ghim.
 *
 * <p>Đây là cái NỀN tất định cho lời mời "kéo thả tệp vào đây" của trợ lý. Thẻ vùng thả chỉ hiện
 * khi model gọi `request_evidence_upload`, mà cần câu duy nhất bắt nó gọi là câu chữ trong mô tả
 * tool — thứ đã bốn lần chứng minh là không đáng tin. Có nền này thì model có gọi tool hay không,
 * người dùng vẫn thả được, nên lời mời không bao giờ còn là hứa suông.
 *
 * <p>`noClick`/`noKeyboard`: khung chat đầy nút và ô nhập, biến cả nó thành một cái nút mở hộp
 * chọn tệp là cướp mọi cú bấm. Chỉ nhận kéo-thả.
 */
export function useChatFileDrop(disabled?: boolean) {
  const pin = usePinnedFilesStore(s => s.pin)
  const pinned = usePinnedFilesStore(s => s.files)

  const onDrop = useCallback(
    (dropped: File[]) => {
      if (!dropped.length) return
      const { accepted, rejected } = screenEvidence(dropped, pinned)
      rejected.forEach(r => toast.error(r.reason))
      if (accepted.length) pin(accepted)
    },
    [pin, pinned],
  )

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  })

  return { getRootProps, isDragActive }
}
