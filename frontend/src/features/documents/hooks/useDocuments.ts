import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/apiError'
import { documentApi } from '../api/documentApi'
import type { DocumentListParams, KbDocument, UpdateDocumentInput, UploadDocumentInput } from '../types'

const KEY = 'documents'

/** Còn tài liệu đang chờ/đang nạp thì hỏi lại mỗi 3 giây, hết thì thôi. */
function pollWhileIndexing(docs: KbDocument[] | undefined): number | false {
  return docs?.some(d => d.aiStatus === 'PENDING' || d.aiStatus === 'INDEXING') ? 3000 : false
}

export function useDocumentCapabilities() {
  return useQuery({ queryKey: [KEY, 'capabilities'], queryFn: documentApi.capabilities, staleTime: 60_000 })
}

export function useDocumentUsage() {
  return useQuery({ queryKey: [KEY, 'usage'], queryFn: documentApi.usage })
}

export function useDocuments(params: DocumentListParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => documentApi.list(params),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval: q => pollWhileIndexing(q.state.data?.content),
  })
}

export function useLegacyDocuments(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'legacy'],
    queryFn: documentApi.legacy,
    enabled,
    refetchInterval: q => pollWhileIndexing(q.state.data),
  })
}

/** Một tài liệu theo id — mở từ chip nguồn của K.AI. Không thử lại: 404 là mất quyền hoặc đã xoá, thử lại vô ích. */
export function useDocument(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    queryFn: () => documentApi.get(id!),
    enabled: !!id && enabled,
    retry: false,
  })
}

export function useDocumentChunks(id: string | null) {
  return useQuery({ queryKey: [KEY, 'chunks', id], queryFn: () => documentApi.chunks(id!), enabled: !!id })
}

/** Mutation có toast và làm mới mọi query tài liệu (danh sách, dung lượng, tài liệu cũ). */
function useDocMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, success: string | null, errorFallback: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success)
      qc.invalidateQueries({ queryKey: [KEY] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, errorFallback)),
  })
}

export function useUploadDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation((input: UploadDocumentInput) => documentApi.upload(input),
    t('toast.uploaded'), t('toast.uploadFailed'))
}

export function useUpdateDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, input }: { id: string; input: UpdateDocumentInput }) => documentApi.update(id, input),
    t('toast.saved'), t('toast.saveFailed'))
}

/** Bật/tắt "Dùng cho AI" ngay trên bảng — không toast thành công, trạng thái đổi ngay trên dòng là đủ. */
export function useToggleDocumentAi() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, aiEnabled }: { id: string; aiEnabled: boolean }) => documentApi.update(id, { aiEnabled }),
    null, t('toast.saveFailed'))
}

export function useReplaceDocumentFile() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, file }: { id: string; file: File }) => documentApi.replaceFile(id, file),
    t('toast.fileReplaced'), t('toast.uploadFailed'))
}

export function useDeleteDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation((doc: KbDocument) => doc.legacy ? documentApi.removeLegacy(doc.id) : documentApi.remove(doc.id),
    t('toast.deleted'), t('toast.deleteFailed'))
}

export function useReindexDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation((id: string) => documentApi.reindex(id), t('toast.reindexQueued'), t('toast.saveFailed'))
}

export function useReplaceLegacyDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, file }: { id: string; file: File }) => documentApi.replaceLegacy(id, file),
    t('toast.legacyReplaced'), t('toast.uploadFailed'))
}
