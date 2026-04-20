import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orgUnitApi } from '../api/org-unit.api'
import type { CreateOrgUnitRequest, UpdateOrgUnitRequest } from '../types/org-unit'
import { toast } from 'sonner'

export function useOrgUnitTree(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-units', 'tree', orgId],
    queryFn: () => orgUnitApi.getTree(orgId!),
    enabled: !!orgId
  })
}

export function useOrgHierarchyLevels(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-hierarchy-levels', orgId],
    queryFn: () => orgUnitApi.getHierarchyLevels(orgId!),
    enabled: !!orgId
  })
}

export function useCreateOrgUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, payload }: { orgId: string; payload: CreateOrgUnitRequest }) => 
      orgUnitApi.createNode(orgId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-units', 'tree', variables.orgId] })
      toast.success('Thêm thành phần tổ chức thành công')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi tạo thành phần tổ chức')
    }
  })
}

export function useUpdateOrgUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, unitId, payload }: { orgId: string; unitId: string; payload: UpdateOrgUnitRequest }) => 
      orgUnitApi.updateNode(orgId, unitId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-units', 'tree', variables.orgId] })
      toast.success('Cập nhật thành phần tổ chức thành công')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi cập nhật thành phần')
    }
  })
}

export function useOrgUnit(orgId: string | undefined, unitId: string | undefined) {
  return useQuery({
    queryKey: ['org-units', 'detail', orgId, unitId],
    queryFn: () => orgUnitApi.getById(orgId!, unitId!),
    enabled: !!orgId && !!unitId
  })
}

export function useOrgUnitSubtree(orgId: string | undefined, unitId: string | undefined) {
  return useQuery({
    queryKey: ['org-units', 'subtree', orgId, unitId],
    queryFn: () => orgUnitApi.getSubtree(orgId!, unitId!),
    enabled: !!orgId && !!unitId
  })
}

export function useProvinces() {
  return useQuery({
    queryKey: ['provinces'],
    queryFn: () => orgUnitApi.getProvinces()
  })
}

export function useDistricts(provinceId: string | undefined) {
  return useQuery({
    queryKey: ['districts', provinceId],
    queryFn: () => orgUnitApi.getDistricts(provinceId!),
    enabled: !!provinceId
  })
}

export function useUploadLogo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, unitId, file }: { orgId: string; unitId: string; file: File }) => 
      orgUnitApi.uploadLogo(orgId, unitId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-units', 'tree', variables.orgId] })
      queryClient.invalidateQueries({ queryKey: ['org-units', 'detail', variables.orgId, variables.unitId] })
      toast.success('Tải logo lên thành công')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi tải logo')
    }
  })
}

export function useDeleteOrgUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orgId, unitId }: { orgId: string; unitId: string }) => 
      orgUnitApi.deleteNode(orgId, unitId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-units', 'tree', variables.orgId] })
      toast.success('Xoá thành phần tổ chức thành công')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Hệ thống chặn chức năng hoặc có lỗi')
    }
  })
}
