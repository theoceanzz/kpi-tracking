import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Bài đi qua từng ô của các modal trong "Thiết lập công ty" — nối sau bài của mục (`next`).
 *
 * Cùng khuôn với luồng Tạo KPI: màn hình khai `useTourModal('<tên>', mở, đóng)`, mỗi bước tự mở
 * modal (luỹ đẳng), bước mặc định chặn bấm, form gọi `blockedByTour()` trước khi gửi nên không
 * bao giờ lưu thật, và `cleanup` đóng modal khi xong / bỏ ngang.
 */

export const USERS_FORM: TourKey = 'setup-company/users+form'
export const ROLES_FORM: TourKey = 'setup-company/roles+form'
export const ROLES_PERMS: TourKey = 'setup-company/roles+perms'
export const ORG_FORM: TourKey = 'setup-company/org-structure+form'
export const DELEGATIONS_FORM: TourKey = 'setup-company/delegations+form'
export const RANKS_EDIT: TourKey = 'setup-company/ranks+edit'

const { t, modal } = tourKit('tourForms')

const formsCompanyTours = perLanguage((): Record<TourKey, TourDef> => {
  const users = modal('users.form')
  const roles = modal('roles.form')
  const perms = modal('roles.perms')
  const hier = modal('roles.hierarchy')
  const org = modal('org.form')
  const deleg = modal('delegations.form')
  const ranks = modal('ranks.edit')

  return {
    [USERS_FORM]: {
      title: t('usersForm.title'),
      cleanup: users.close,
      steps: [
        users.opener('usersForm.add', tourTarget('users.add'), 'left'),
        users.step('usersForm.form', tourTarget('users.form'), 'left'),
        users.step('usersForm.name', tourTarget('users.form.name'), 'bottom'),
        users.step('usersForm.code', tourTarget('users.form.code'), 'bottom'),
        users.step('usersForm.email', tourTarget('users.form.email'), 'bottom'),
        users.step('usersForm.password', tourTarget('users.form.password'), 'bottom'),
        users.step('usersForm.phone', tourTarget('users.form.phone'), 'top'),
        users.step('usersForm.unit', tourTarget('users.form.unit'), 'top'),
        users.step('usersForm.role', tourTarget('users.form.role'), 'top'),
        users.step('usersForm.submit', tourTarget('users.form.submit'), 'top'),
      ],
    },

    [ROLES_FORM]: {
      title: t('rolesForm.title'),
      next: ROLES_PERMS,
      cleanup: roles.close,
      steps: [
        roles.opener('rolesForm.add', tourTarget('roles.add'), 'left'),
        roles.step('rolesForm.form', tourTarget('roles.form'), 'left'),
        roles.step('rolesForm.name', tourTarget('roles.form.name'), 'bottom'),
        roles.step('rolesForm.level', tourTarget('roles.form.level'), 'bottom'),
        roles.step('rolesForm.rank', tourTarget('roles.form.rank'), 'bottom'),
        roles.step('rolesForm.submit', tourTarget('roles.form.submit'), 'top'),
      ],
    },

    // Hai chỗ chọn quyền: ngăn quyền của MỘT vai trò, và hộp đặt quyền chuẩn cho mọi vai trò.
    [ROLES_PERMS]: {
      title: t('rolesPerms.title'),
      cleanup: async () => {
        await perms.close()
        await hier.close()
      },
      steps: [
        perms.step('rolesPerms.drawer', tourTarget('roleperm.drawer'), 'left'),
        perms.step('rolesPerms.defaults', tourTarget('roleperm.defaults'), 'bottom'),
        perms.step('rolesPerms.search', tourTarget('roleperm.search'), 'bottom'),
        perms.step('rolesPerms.group', tourTarget('roleperm.group'), 'left'),
        perms.step('rolesPerms.groupToggle', tourTarget('roleperm.group-toggle'), 'left'),
        perms.step('rolesPerms.item', tourTarget('roleperm.item'), 'left'),
        perms.step('rolesPerms.save', tourTarget('roleperm.save'), 'top'),
        hier.opener('rolesPerms.hierarchyBtn', tourTarget('roles.hierarchy'), 'left', { prepare: perms.close }),
        hier.step('rolesPerms.legend', tourTarget('hier.legend'), 'bottom'),
        hier.step('rolesPerms.matrix', tourTarget('hier.matrix'), 'top'),
        hier.step('rolesPerms.apply', tourTarget('hier.apply'), 'top'),
      ],
    },

    [ORG_FORM]: {
      title: t('orgForm.title'),
      cleanup: org.close,
      steps: [
        org.step('orgForm.form', tourTarget('org.form'), 'left'),
        org.step('orgForm.logo', tourTarget('org.form.logo'), 'left'),
        org.step('orgForm.parent', tourTarget('org.form.parent'), 'left'),
        org.step('orgForm.name', tourTarget('org.form.name'), 'left'),
        org.step('orgForm.code', tourTarget('org.form.code'), 'left'),
        org.step('orgForm.type', tourTarget('org.form.type'), 'left'),
        org.step('orgForm.status', tourTarget('org.form.status'), 'left'),
        org.step('orgForm.relation', tourTarget('org.form.relation'), 'left'),
        org.step('orgForm.contact', tourTarget('org.form.contact'), 'left'),
        org.step('orgForm.location', tourTarget('org.form.location'), 'left'),
        org.step('orgForm.roles', tourTarget('org.form.roles'), 'left'),
        org.step('orgForm.submit', tourTarget('org.form.submit'), 'top'),
      ],
    },

    // Không phải hộp thoại mà là chế độ sửa ngay trong khối — cùng khuôn mở / đóng.
    [RANKS_EDIT]: {
      title: t('ranksEdit.title'),
      cleanup: ranks.close,
      steps: [
        ranks.opener('ranksEdit.open', tourTarget('ranks.edit'), 'left'),
        ranks.step('ranksEdit.note', tourTarget('ranks.editor.note'), 'bottom'),
        ranks.step('ranksEdit.row', tourTarget('ranks.editor.row'), 'bottom'),
        ranks.step('ranksEdit.name', tourTarget('ranks.editor.name'), 'bottom'),
        ranks.step('ranksEdit.managerTitle', tourTarget('ranks.editor.title'), 'bottom'),
        ranks.step('ranksEdit.order', tourTarget('ranks.editor.order'), 'left'),
        ranks.step('ranksEdit.add', tourTarget('ranks.editor.add'), 'top'),
        ranks.step('ranksEdit.save', tourTarget('ranks.editor.save'), 'top'),
      ],
    },

    [DELEGATIONS_FORM]: {
      title: t('delegationsForm.title'),
      cleanup: deleg.close,
      steps: [
        deleg.opener('delegationsForm.add', tourTarget('delegations.add'), 'left'),
        deleg.step('delegationsForm.form', tourTarget('delegations.form'), 'left'),
        deleg.step('delegationsForm.delegate', tourTarget('delegations.form.delegate'), 'bottom'),
        deleg.step('delegationsForm.units', tourTarget('delegations.form.units'), 'bottom'),
        deleg.step('delegationsForm.subtree', tourTarget('delegations.form.subtree'), 'top'),
        deleg.step('delegationsForm.leader', tourTarget('delegations.form.leader'), 'top'),
        deleg.step('delegationsForm.expires', tourTarget('delegations.form.expires'), 'top'),
        deleg.step('delegationsForm.reason', tourTarget('delegations.form.reason'), 'top'),
        deleg.step('delegationsForm.submit', tourTarget('delegations.form.submit'), 'top'),
      ],
    },
  }
})

export default formsCompanyTours
