import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/apiError'
import { toastUploadError } from '@/lib/upload'
import { documentApi } from '../api/documentApi'
import { autoConvert } from '../editor/autoConvert'
import type {
  CreateOnlineDocumentInput, DocumentListParams, DocumentScope, KbDocument, SharePermission, UpdateDocumentInput,
  UploadDocumentInput,
} from '../types'

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
    refetchInterval: q => {
      const s = q.state.data?.aiStatus
      return s === 'PENDING' || s === 'INDEXING' ? 3000 : false
    },
  })
}

export function useDocumentChunks(id: string | null) {
  return useQuery({ queryKey: [KEY, 'chunks', id], queryFn: () => documentApi.chunks(id!), enabled: !!id })
}

/**
 * Mutation có toast và làm mới mọi query tài liệu (danh sách, dung lượng, tài liệu cũ).
 * {@code retryable}: mutation gửi tệp — lỗi mạng / 5xx thì toast kèm nút Thử lại gửi lại đúng tệp đó.
 */
function useDocMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, success: string | null, errorFallback: string,
                                      retryable = false) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success)
      qc.invalidateQueries({ queryKey: [KEY] })
    },
    onError: (e: unknown, vars: TVars) => retryable
      ? toastUploadError(e, () => mutation.mutate(vars), errorFallback)
      : toast.error(getApiErrorMessage(e, errorFallback)),
  })
  return mutation
}

/** Tải lên; tệp Word / Markdown tự chuyển sang tài liệu soạn trực tuyến (tệp gốc vào tab Phiên bản). */
export function useUploadDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation(async (input: UploadDocumentInput) => {
    const r = await autoConvert(await documentApi.upload(input))
    if (r.convertFailed) toast.warning(t('toast.autoConvertFailed'))
    return r.doc
  }, t('toast.uploaded'), t('toast.uploadFailed'), true)
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

/** Tạo tài liệu soạn trực tuyến. Không toast thành công — bên gọi mở thẳng trình soạn. */
export function useCreateOnlineDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation((input: CreateOnlineDocumentInput) => documentApi.createOnline(input), null, t('toast.saveFailed'))
}

/**
 * Nội dung chữ để mở trong trình soạn. Khoá nằm NGOÀI tiền tố `documents`: mọi mutation tài liệu làm mới cả tiền tố đó,
 * và nạp lại nội dung giữa lúc đang gõ sẽ xoá mất chữ chưa lưu. Chỉ tải lại khi trình soạn chủ động yêu cầu.
 */
export function useDocumentContent(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['document-content', id],
    queryFn: () => documentApi.content(id!),
    enabled: !!id && enabled,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
}

/** Thay tệp; tệp mới là Word / Markdown thì cũng tự chuyển sang dạng soạn trực tuyến như khi tải lên. */
export function useReplaceDocumentFile() {
  const { t } = useTranslation('documents')
  return useDocMutation(async ({ id, file }: { id: string; file: File }) => {
    const r = await autoConvert(await documentApi.replaceFile(id, file))
    if (r.convertFailed) toast.warning(t('toast.autoConvertFailed'))
    return r.doc
  }, t('toast.fileReplaced'), t('toast.uploadFailed'), true)
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
    t('toast.legacyReplaced'), t('toast.uploadFailed'), true)
}

// ── Trang chủ: gần đây, ghim, yêu thích ──────────────────────────────────────────────────────────

export function useRecentDocuments(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'recent'],
    queryFn: documentApi.recent,
    enabled,
    refetchInterval: q => pollWhileIndexing(q.state.data),
  })
}

export function usePinnedDocuments(enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'pinned'], queryFn: documentApi.pinned, enabled, staleTime: 30_000 })
}

export function useToggleFavorite() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, value }: { id: string; value: boolean }) => documentApi.setFavorite(id, value),
    null, t('toast.saveFailed'))
}

export function useTogglePin() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, value }: { id: string; value: boolean }) => documentApi.setPinned(id, value),
    null, t('toast.saveFailed'))
}

/**
 * Ghi "mở gần nhất" khi mở một tài liệu. Im lặng khi lỗi (đây là phụ, không chặn việc xem) và chỉ làm mới tab
 * Gần đây — không làm mới cả danh sách đang xem.
 */
export function useMarkOpened() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => documentApi.markOpened(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'recent'] }),
  })
}

// ── Thư mục ──────────────────────────────────────────────────────────────────────────────────────

export function useDocumentFolders(params: { scope?: DocumentScope; unitId?: string; parentId?: string }, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'folders', params],
    queryFn: () => documentApi.folders(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useCreateFolder() {
  const { t } = useTranslation('documents')
  return useDocMutation((input: Parameters<typeof documentApi.createFolder>[0]) => documentApi.createFolder(input),
    t('toast.folderCreated'), t('toast.saveFailed'))
}

export function useRenameFolder() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, name }: { id: string; name: string }) => documentApi.renameFolder(id, name),
    t('toast.saved'), t('toast.saveFailed'))
}

export function useDeleteFolder() {
  const { t } = useTranslation('documents')
  return useDocMutation((id: string) => documentApi.deleteFolder(id), t('toast.folderDeleted'), t('toast.deleteFailed'))
}

export function useMoveDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, folderId }: { id: string; folderId: string | null }) => documentApi.move(id, folderId),
    t('toast.moved'), t('toast.saveFailed'))
}

// ── Thùng rác ────────────────────────────────────────────────────────────────────────────────────

export function useTrash(enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'trash'], queryFn: documentApi.trash, enabled })
}

export function useRestoreDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation((id: string) => documentApi.restore(id), t('toast.restored'), t('toast.saveFailed'))
}

export function useDeletePermanently() {
  const { t } = useTranslation('documents')
  return useDocMutation((id: string) => documentApi.deletePermanently(id), t('toast.deletedPermanently'), t('toast.deleteFailed'))
}

// ── Phiên bản ────────────────────────────────────────────────────────────────────────────────────

export function useDocumentVersions(id: string, enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'versions', id], queryFn: () => documentApi.versions(id), enabled })
}

export function useRestoreVersion() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, versionId }: { id: string; versionId: string }) => documentApi.restoreVersion(id, versionId),
    t('toast.versionRestored'), t('toast.saveFailed'))
}

// ── Chia sẻ ──────────────────────────────────────────────────────────────────────────────────────

export function useDocumentShares(id: string, enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'shares', id], queryFn: () => documentApi.shares(id), enabled })
}

export function useShareUnits(enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'share-units'], queryFn: documentApi.shareUnits, enabled, staleTime: 5 * 60_000 })
}

export function useShareUnitMembers(unitId: string, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'share-unit-members', unitId],
    queryFn: () => documentApi.shareUnitMembers(unitId),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useShareTargets(q: string, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'share-targets', q],
    queryFn: () => documentApi.shareTargets(q),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useShareDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation(
    ({ id, userIds, unitIds, permission }: { id: string; userIds: string[]; unitIds: string[]; permission?: SharePermission }) =>
      documentApi.share(id, { userIds, unitIds, permission }),
    t('toast.shared'), t('toast.shareFailed'))
}

/** Đổi quyền một lượt chia sẻ (xem ↔ chỉnh sửa). */
export function useUpdateSharePermission() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, shareId, permission }: { id: string; shareId: string; permission: SharePermission }) =>
    documentApi.updateShare(id, shareId, permission), t('toast.sharePermissionUpdated'), t('toast.shareFailed'))
}

export function useUnshareDocument() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, shareId }: { id: string; shareId: string }) => documentApi.unshare(id, shareId),
    t('toast.unshared'), t('toast.shareFailed'))
}

export function useEmptyTrash() {
  const { t } = useTranslation('documents')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => documentApi.emptyTrash(),
    onSuccess: r => {
      toast.success(t('toast.trashEmptied', { count: r.deleted }))
      qc.invalidateQueries({ queryKey: [KEY] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, t('toast.deleteFailed'))),
  })
}

// ── Đề xuất đưa lên đơn vị / công ty ─────────────────────────────────────────────────────────────

export function usePromotionInbox(enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'promotions', 'inbox'], queryFn: documentApi.promotionInbox, enabled, staleTime: 30_000 })
}

export function useMyPromotions(enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'promotions', 'mine'], queryFn: documentApi.myPromotions, enabled })
}

export function useDocumentPromotions(id: string, enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'promotions', 'doc', id], queryFn: () => documentApi.documentPromotions(id), enabled })
}

export function usePropose() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, input }: { id: string; input: Parameters<typeof documentApi.propose>[1] }) =>
    documentApi.propose(id, input), t('toast.proposed'), t('toast.saveFailed'))
}

export function useApprovePromotion() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, title, note }: { id: string; title?: string; note?: string }) =>
    documentApi.approvePromotion(id, { title, note }), t('toast.promotionApproved'), t('toast.saveFailed'))
}

export function useRejectPromotion() {
  const { t } = useTranslation('documents')
  return useDocMutation(({ id, note }: { id: string; note?: string }) =>
    documentApi.rejectPromotion(id, note), t('toast.promotionRejected'), t('toast.saveFailed'))
}

export function useCancelPromotion() {
  const { t } = useTranslation('documents')
  return useDocMutation((id: string) => documentApi.cancelPromotion(id), t('toast.promotionCancelled'), t('toast.saveFailed'))
}

// ── Dung lượng ───────────────────────────────────────────────────────────────────────────────────

export function useStorageStats(enabled: boolean) {
  return useQuery({ queryKey: [KEY, 'storage-stats'], queryFn: documentApi.storageStats, enabled })
}
