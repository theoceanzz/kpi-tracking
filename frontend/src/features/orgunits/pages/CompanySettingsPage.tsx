import { Building2 } from 'lucide-react'
import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import PageTour from '@/components/common/PageTour'
import { companySteps } from '@/components/common/tourSteps'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { CompanyInfoSection, CompanyHierarchySection } from '../components/CompanySections'
import { OrganizationStructurePage } from '@/features/organization/pages/OrganizationStructurePage'
import UsersPage from '@/features/users/pages/UsersPage'
import RoleManagementPage from '@/features/organization/pages/RoleManagementPage'
import { SidebarSettingsTab, NotificationSettingsTab } from '@/features/organization/components/SystemSettingsTabs'
import EmailTemplateSettingsTab from '@/features/organization/components/EmailTemplateSettingsTab'
import LarkSettingsTab from '@/features/organization/components/LarkSettingsTab'
import { useSearchParams } from 'react-router-dom'

/**
 * Toàn bộ thiết lập cấp công ty trong MỘT trang. Trước đây là năm dòng sidebar riêng
 * (Công ty, Cơ cấu tổ chức, Nhân viên, Vai trò, Cấu hình hệ thống); gom lại để menu
 * bên trái ngắn, khách hàng đỡ phải quét nhiều mục mới tìm được thứ cần.
 */
export default function CompanySettingsPage() {
  const pageTitle = usePageTitle('setup-company', 'Thiết lập công ty')
  const [, setSearchParams] = useSearchParams()

  const goToSection = (id: string) =>
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('section', id)
      return p
    }, { replace: true })

  return (
    <>
      <PageTour pageKey="company" steps={companySteps} />
      <SettingsSectionLayout
        navId="setup-company"
        title={pageTitle}
        subtitle="Thông tin, cơ cấu, con người và các thiết lập chung của tổ chức"
        eyebrow={
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-xs font-black uppercase tracking-widest mb-3">
            <Building2 size={14} /> Thiết lập
          </div>
        }
        sections={[
          { id: 'info', render: () => <CompanyInfoSection /> },
          { id: 'ranks', render: () => <CompanyHierarchySection /> },
          { id: 'org-structure', render: () => <OrganizationStructurePage /> },
          { id: 'users', render: () => <UsersPage /> },
          { id: 'roles', render: () => <RoleManagementPage /> },
          { id: 'sidebar', render: () => <SidebarSettingsTab /> },
          { id: 'notifications', render: () => <NotificationSettingsTab /> },
          {
            id: 'email',
            render: () => <EmailTemplateSettingsTab onOpenNotificationSettings={() => goToSection('notifications')} />,
          },
          { id: 'api', render: () => <LarkSettingsTab /> },
        ]}
      />
    </>
  )
}
