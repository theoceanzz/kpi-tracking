import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'
import { DELEGATIONS_FORM, ORG_FORM, RANKS_EDIT, ROLES_FORM, USERS_FORM } from './forms-company'

/**
 * Hướng dẫn cho "Thiết lập công ty" — trang gộp và từng mục bên trong.
 *
 * Bản 2 viết lại theo khuôn từng bước nhỏ (xem `kit.tsx`): mỗi bước một phần tử, một–hai câu.
 * Bản 1 chỉ vào cả khối lớn và có bước trỏ vào phần tử đã bỏ (`#tour-roles-stats`). Ba mục Ủy
 * quyền, Tài liệu AI, Quy trình KPI trước đây chưa có bài — nay có, bản 1.
 */

const V = 2
/** Bản 3: mục có modal nối thêm bài đi qua từng ô của modal (xem `forms-company.tsx`). */
const V3 = 3
const { s, sectionCards } = tourKit('tourSetupCompany')

const setupCompanyTours = perLanguage((): Record<TourKey, TourDef> => ({
  'setup-company': { version: V, steps: sectionCards('setup-company') },

  'setup-company/info': {
    version: V,
    steps: [
      s('info.cover', tourTarget('company.cover'), 'left'),
      s('info.logo', tourTarget('company.logo'), 'right'),
      s('info.edit', tourTarget('company.edit'), 'left'),
      s('info.profile', tourTarget('company.profile'), 'top'),
      s('info.features', tourTarget('company.features'), 'top'),
      s('info.featuresManage', tourTarget('company.features-manage'), 'left'),
    ],
  },

  'setup-company/ranks': {
    version: V3,
    next: RANKS_EDIT,
    steps: [
      s('ranks.list', tourTarget('ranks.list'), 'top'),
      s('ranks.edit', tourTarget('ranks.edit'), 'left'),
    ],
  },

  'setup-company/roles': {
    version: V3,
    next: ROLES_FORM,
    steps: [
      s('roles.stats', tourTarget('ws.stats'), 'bottom'),
      s('roles.add', tourTarget('roles.add'), 'left'),
      s('roles.hierarchy', tourTarget('roles.hierarchy'), 'left'),
      s('roles.search', tourTarget('roles.search'), 'bottom'),
      s('roles.table', tourTarget('roles.table'), 'top'),
      s('roles.rowMenu', tourTarget('roles.row-menu'), 'left'),
    ],
  },

  'setup-company/org-structure': {
    version: V3,
    next: ORG_FORM,
    steps: [
      s('org.viewMode', tourTarget('org.view-mode'), 'bottom'),
      s('org.content', tourTarget('org.content'), 'top'),
      s('org.createRoot', tourTarget('org.create-root'), 'bottom'),
      s('org.import', tourTarget('org.import'), 'bottom'),
      s('org.export', tourTarget('org.export'), 'bottom'),
    ],
  },

  'setup-company/users': {
    version: V3,
    next: USERS_FORM,
    steps: [
      s('users.add', tourTarget('users.add'), 'left'),
      s('users.import', tourTarget('users.import'), 'left'),
      s('users.search', tourTarget('filter.search'), 'bottom'),
      s('users.roleFilter', tourTarget('users.role-filter'), 'bottom'),
      s('users.unitFilter', tourTarget('users.unit-filter'), 'bottom'),
      s('users.table', tourTarget('users.table'), 'top'),
      s('users.rowMenu', tourTarget('users.row-menu'), 'left'),
    ],
  },

  'setup-company/delegations': {
    version: 2,
    next: DELEGATIONS_FORM,
    steps: [
      s('delegations.add', tourTarget('delegations.add'), 'left'),
      s('delegations.note', tourTarget('delegations.note'), 'bottom'),
      s('delegations.list', tourTarget('delegations.list'), 'top'),
      s('delegations.revoke', tourTarget('delegations.revoke'), 'left'),
    ],
  },

  'setup-company/sidebar': {
    version: V,
    steps: [
      s('sidebar.header', tourTarget('sidebar.header'), 'bottom'),
      s('sidebar.search', tourTarget('sidebar.search'), 'bottom'),
      s('sidebar.note', tourTarget('sidebar.note'), 'bottom'),
      s('sidebar.scope', tourTarget('sidebar.scope'), 'top'),
      s('sidebar.resetItem', tourTarget('sidebar.reset-item'), 'left'),
      s('sidebar.save', tourTarget('sidebar.save'), 'left'),
    ],
  },

  'setup-company/notifications': {
    version: V,
    steps: [
      s('notif.events', tourTarget('notif.events'), 'top'),
      s('notif.save', tourTarget('notif.save'), 'left'),
      s('notif.deadline', tourTarget('notif.deadline'), 'top'),
    ],
  },

  'setup-company/email': {
    version: V,
    steps: [
      s('email.language', tourTarget('email.language'), 'right'),
      s('email.list', tourTarget('email.list'), 'right'),
      s('email.template', tourTarget('email.template'), 'right'),
      s('email.enabled', tourTarget('email.enabled'), 'left'),
      s('email.notifLink', tourTarget('email.notif-link'), 'left'),
      s('email.subject', tourTarget('email.subject'), 'bottom'),
      s('email.advanced', tourTarget('email.advanced'), 'left'),
      s('email.preview', tourTarget('email.preview'), 'top'),
      s('email.reset', tourTarget('email.reset'), 'top'),
      s('email.save', tourTarget('email.save'), 'top'),
    ],
  },

  'setup-company/api': {
    version: V,
    steps: [
      s('lark.status', tourTarget('lark.status'), 'bottom'),
      s('lark.createApp', tourTarget('lark.create-app'), 'top'),
      s('lark.configure', tourTarget('lark.configure'), 'top'),
      s('lark.credentials', tourTarget('lark.credentials'), 'top'),
      s('lark.test', tourTarget('lark.test'), 'top'),
      s('lark.connect', tourTarget('lark.connect'), 'top'),
      s('lark.defaults', tourTarget('lark.defaults'), 'top'),
      s('lark.enable', tourTarget('lark.enable'), 'top'),
    ],
  },

  'setup-company/ai-docs': {
    steps: [
      s('aidocs.card', tourTarget('aidocs.card'), 'bottom'),
      s('aidocs.open', tourTarget('aidocs.open'), 'left'),
    ],
  },

  'setup-company/kpi-workflow': {
    steps: [
      s('workflow.org', tourTarget('workflow.org'), 'bottom'),
      s('workflow.graph', tourTarget('workflow.graph'), 'top'),
      s('workflow.reset', tourTarget('workflow.reset'), 'bottom'),
      s('workflow.save', tourTarget('workflow.save'), 'bottom'),
      s('workflow.fullscreen', tourTarget('workflow.fullscreen'), 'left'),
      s('workflow.mine', tourTarget('workflow.mine'), 'top'),
      s('workflow.mineToggle', tourTarget('workflow.mine-toggle'), 'left'),
    ],
  },
}))

export default setupCompanyTours
