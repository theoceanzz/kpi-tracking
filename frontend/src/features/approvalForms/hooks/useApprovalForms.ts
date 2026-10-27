import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/apiError'
import { approvalFormsApi } from '../api/approvalFormsApi'
import type { FormRequestBody, FormValues, LocalizedName, RequestBox } from '../types'

export const approvalFormKeys = {
  all: ['approval-forms'] as const,
  admin: ['approval-forms', 'admin'] as const,
  library: (lang: string) => ['approval-forms', 'library', lang] as const,
  detail: (id: string) => ['approval-forms', 'detail', id] as const,
  processOptions: ['approval-forms', 'process-options'] as const,
  catalog: ['approval-forms', 'catalog'] as const,
  requests: ['approval-requests'] as const,
  submitView: (formId: string) => ['approval-requests', 'form', formId] as const,
  list: (box: RequestBox, q: string, page: number) => ['approval-requests', 'list', box, q, page] as const,
  counts: ['approval-requests', 'counts'] as const,
  request: (id: string) => ['approval-requests', 'detail', id] as const,
}

// ── Quản trị ──

export function useFormAdmin(enabled = true) {
  return useQuery({ queryKey: approvalFormKeys.admin, queryFn: approvalFormsApi.admin, enabled })
}

export function useFormLibrary(lang: string, enabled: boolean) {
  return useQuery({ queryKey: approvalFormKeys.library(lang), queryFn: approvalFormsApi.library, enabled, staleTime: 10 * 60_000 })
}

export function useFormDetail(id: string | undefined) {
  return useQuery({
    queryKey: approvalFormKeys.detail(id ?? ''),
    queryFn: () => approvalFormsApi.get(id!),
    enabled: !!id,
    // Trình sửa giữ bản nháp riêng; tải lại ngầm giữa chừng sẽ đè lên những gì người dùng đang soạn.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useFormProcessOptions(enabled = true) {
  return useQuery({ queryKey: approvalFormKeys.processOptions, queryFn: approvalFormsApi.processOptions, enabled, staleTime: 5 * 60_000 })
}

/** Sau mọi thay đổi ở quản trị: danh sách quản trị và danh mục nộp đơn đều đổi theo. */
function useInvalidateForms() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: approvalFormKeys.admin })
    qc.invalidateQueries({ queryKey: approvalFormKeys.catalog })
  }
}

function useFormsMutation<V, R>(fn: (v: V) => Promise<R>, successKey?: string) {
  const { t } = useTranslation('approvalForms')
  const invalidate = useInvalidateForms()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate()
      if (successKey) toast.success(t(successKey))
    },
    onError: (e) => toast.error(getApiErrorMessage(e, t('toast.failed'))),
  })
}

export function useSaveForm() {
  const qc = useQueryClient()
  const { t } = useTranslation('approvalForms')
  const invalidate = useInvalidateForms()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: FormRequestBody }) =>
      id ? approvalFormsApi.update(id, body) : approvalFormsApi.create(body),
    onSuccess: (saved) => {
      invalidate()
      qc.setQueryData(approvalFormKeys.detail(saved.id), saved)
      toast.success(t('toast.published'))
    },
    // Lỗi 422 của backend mang câu dịch sẵn (vd. "Đơn chưa hoàn chỉnh: …") — hiện nguyên văn.
    onError: (e) => toast.error(getApiErrorMessage(e, t('toast.failed'))),
  })
}

export const useSetFormActive = () =>
  useFormsMutation(({ id, active }: { id: string; active: boolean }) => approvalFormsApi.setActive(id, active))
export const useRenameForm = () =>
  useFormsMutation(({ id, name, description }: { id: string; name: LocalizedName; description?: LocalizedName }) =>
    approvalFormsApi.rename(id, name, description), 'toast.saved')
export const useDeleteForm = () => useFormsMutation((id: string) => approvalFormsApi.remove(id), 'toast.formDeleted')
export const useCreateGroup = () => useFormsMutation((name: LocalizedName) => approvalFormsApi.createGroup(name), 'toast.groupCreated')
export const useUpdateGroup = () =>
  useFormsMutation(({ id, name }: { id: string; name: LocalizedName }) => approvalFormsApi.updateGroup(id, name), 'toast.saved')
export const useSetGroupActive = () =>
  useFormsMutation(({ id, active }: { id: string; active: boolean }) => approvalFormsApi.setGroupActive(id, active))
export const useDeleteGroup = () => useFormsMutation((id: string) => approvalFormsApi.removeGroup(id), 'toast.groupDeleted')
export const useReorderGroups = () => useFormsMutation((ids: string[]) => approvalFormsApi.reorderGroups(ids))
export const useReorderForms = () =>
  useFormsMutation(({ groupId, ids }: { groupId: string; ids: string[] }) => approvalFormsApi.reorderForms(groupId, ids))

// ── Nhân viên ──

export function useFormCatalog() {
  return useQuery({ queryKey: approvalFormKeys.catalog, queryFn: approvalFormsApi.catalog })
}

export function useSubmitView(formId: string | null) {
  return useQuery({
    queryKey: approvalFormKeys.submitView(formId ?? ''),
    queryFn: () => approvalFormsApi.submitView(formId!),
    enabled: !!formId,
  })
}

export function useRequestList(box: RequestBox, q: string, page: number) {
  return useQuery({
    queryKey: approvalFormKeys.list(box, q, page),
    queryFn: () => approvalFormsApi.list({ box, q: q || undefined, page, size: 20 }),
    placeholderData: keepPreviousData,
  })
}

export function useRequestCounts() {
  return useQuery({ queryKey: approvalFormKeys.counts, queryFn: approvalFormsApi.counts, refetchInterval: 60_000 })
}

export function useRequestDetail(id: string | null) {
  return useQuery({ queryKey: approvalFormKeys.request(id ?? ''), queryFn: () => approvalFormsApi.detail(id!), enabled: !!id })
}

export function useSubmitRequest() {
  const qc = useQueryClient()
  const { t } = useTranslation('approvalForms')
  return useMutation({
    mutationFn: (body: { formId: string; orgUnitId: string; values: FormValues }) => approvalFormsApi.submit(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalFormKeys.requests })
      toast.success(t('toast.submitted'))
    },
    onError: (e) => toast.error(getApiErrorMessage(e, t('toast.failed'))),
  })
}

export function useWithdrawRequest() {
  const qc = useQueryClient()
  const { t } = useTranslation('approvalForms')
  return useMutation({
    mutationFn: (id: string) => approvalFormsApi.withdraw(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalFormKeys.requests })
      toast.success(t('toast.withdrawn'))
    },
    onError: (e) => toast.error(getApiErrorMessage(e, t('toast.failed'))),
  })
}
