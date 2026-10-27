import type { TFunction } from 'i18next'
import type { ApproverSpec, PersonRef } from '../../types'
import type { ProcessOptions } from '../../hooks/useProcessOptions'

/** Khoá phân biệt một mục người duyệt (để chọn / bỏ chọn). */
export function approverKey(a: ApproverSpec): string {
  switch (a.type) {
    case 'USER': return `USER:${a.userId}`
    case 'ROLE': return `ROLE:${a.roleId}`
    case 'ORG_UNIT_HEAD': return `ORG_UNIT_HEAD:${a.orgUnitId}`
    case 'REQUESTER_MANAGER': return `REQUESTER_MANAGER:${a.levelsUp ?? 0}`
  }
}

export function approverLabel(
  a: ApproverSpec,
  t: TFunction,
  options: Pick<ProcessOptions, 'roleName' | 'unitName'>,
  users: Record<string, PersonRef>,
): string {
  switch (a.type) {
    case 'USER': return (a.userId && users[a.userId]?.name) || t('pickers.unknown')
    case 'ROLE': return t('approvers.roleLabel', { name: (a.roleId && options.roleName.get(a.roleId)) || t('pickers.unknown') })
    case 'ORG_UNIT_HEAD': return t('approvers.headOf', { name: (a.orgUnitId && options.unitName.get(a.orgUnitId)) || t('pickers.unknown') })
    case 'REQUESTER_MANAGER': return t(`approvers.manager${a.levelsUp ?? 0}`)
  }
}
