import { createBrowserRouter } from 'react-router-dom'
import RedirectToSection from './RedirectToSection'
import AuthLayout from '@/layouts/AuthLayout'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from './ProtectedRoute'
import PermissionRoute from './PermissionRoute'
import PlatformAdminRoute from './PlatformAdminRoute'
import LandingPage from '@/features/landing/pages/LandingPage'

// Auth pages
import LoginPage from '@/features/auth/pages/LoginPage'
import RegisterPage from '@/features/auth/pages/RegisterPage'
import VerifyEmailPage from '@/features/auth/pages/VerifyEmailPage'
import LarkCallbackPage from '@/features/auth/pages/LarkCallbackPage'
import LarkSelectCompanyPage from '@/features/auth/pages/LarkSelectCompanyPage'
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage'

// Dashboard pages
import EmployeePerformancePage from '@/features/dashboard/pages/EmployeePerformancePage'

import OrgUnitDetailPage from '@/features/organization/pages/OrgUnitDetailPage'
import CompanySettingsPage from '@/features/orgunits/pages/CompanySettingsPage'
import PerformancePage from '@/features/kpi/pages/PerformancePage'
import MySpacePage from '@/features/profile/pages/MySpacePage'
import NewSubmissionPage from '@/features/submissions/pages/NewSubmissionPage'
import SubmissionDetailPage from '@/features/submissions/pages/SubmissionDetailPage'
import ProfilePage from '@/features/profile/pages/ProfilePage'
import NotificationsPage from '@/features/notifications/pages/NotificationsPage'
import ForceChangePasswordPage from '@/features/auth/pages/ForceChangePasswordPage'
import DatasourcesPage from '@/features/datasources/pages/DatasourcesPage'
import DatasourceDetailPage from '@/features/datasources/pages/DatasourceDetailPage'
import ReportsPage from '@/features/reports/pages/ReportsPage'
import ReportDetailPage from '@/features/reports/pages/ReportDetailPage'
import AnalyticsPage from '@/features/analytics/pages/AnalyticsPage'
import AiAssistantPage from '@/features/analytics/pages/AiAssistantPage'
import ToolSettingsPage from '@/features/orgunits/pages/ToolSettingsPage'

import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import ErrorPage from '@/features/errors/pages/ErrorPage'
import PlatformAdminPage from '@/features/platformAdmin/pages/PlatformAdminPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/auth/lark/select-company', element: <LarkSelectCompanyPage /> },
    ],
  },
  {
    // Ngoài AuthLayout: luồng kết nối Lark chạy khi quản trị viên đang đăng nhập,
    // mà AuthLayout lại đẩy người đã đăng nhập về /dashboard.
    path: '/auth/lark/callback',
    element: <LarkCallbackPage />,
  },
  {
    element: <PlatformAdminRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/admin', element: <PlatformAdminPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/force-password-change', element: <ForceChangePasswordPage /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/profile', element: <ProfilePage /> },

          // Vận hành KPI gom về một trang; cổng route là phép HOẶC của năm quyền, còn
          // từng mục bên trong tự lọc lại theo đúng quyền cũ của nó.
          {
            element: <PermissionRoute permission={['KPI:VIEW', 'KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT', 'SUBMISSION:REVIEW', 'CYCLE_EVAL:VIEW']} />,
            children: [
              { path: '/performance', element: <PerformancePage /> },
              // Route cũ giữ làm redirect cho link, bookmark và nút tắt trên dashboard.
              { path: '/kpi-criteria', element: <RedirectToSection to="/performance" params={{ section: 'kpi-criteria' }} /> },
              { path: '/kpi-criteria/pending', element: <RedirectToSection to="/performance" params={{ section: 'kpi-criteria-pending' }} /> },
              { path: '/kpi-adjustments/pending', element: <RedirectToSection to="/performance" params={{ section: 'kpi-adjustments-pending' }} /> },
              { path: '/submissions/org-unit', element: <RedirectToSection to="/performance" params={{ section: 'submissions-org-unit' }} /> },
              { path: '/kpi-cycles/evaluation', element: <RedirectToSection to="/performance" params={{ section: 'cycle-evaluation' }} /> },
              // Kỳ và đợt là hai tab của một mục trong trang Thiết lập công cụ.
              { path: '/kpi-periods', element: <RedirectToSection to="/settings/tools" params={{ section: 'kpi-cycles', tab: 'periods' }} /> },
              { path: '/kpi-cycles', element: <RedirectToSection to="/settings/tools" params={{ section: 'kpi-cycles' }} /> },
            ],
          },

          // Phân bổ hạn mức token AI — gác đúng bằng quyền thực hiện hành động.
          // KHÔNG gộp vào khối "Admin / HR Management" bên dưới: khối đó đòi đủ ba quyền
          // ORG:VIEW + USER:VIEW + ROLE:VIEW mà trưởng đơn vị không có, sẽ khoá nhầm
          // đúng nhóm người mà tính năng uỷ quyền phục vụ.
          // Trang Thiết lập công cụ gom cả bảng cấu hình lẫn sáu công cụ quản lý, mỗi
          // thứ một quyền khác nhau — nên cổng route là phép HOẶC của tất cả, còn từng
          // mục bên trong tự lọc lại theo đúng quyền cũ của nó. Trưởng đơn vị chỉ có
          // AI_QUOTA:ALLOCATE vẫn vào được, và chỉ thấy đúng mục hạn mức AI.
          {
            element: (
              <PermissionRoute
                permission={[
                  'ORG:VIEW', 'KPI_CYCLE:CREATE', 'KPI_PERIOD:CREATE', 'OKR:MANAGE', 'BSC:MANAGE',
                  'REWARD:GRANT', 'REWARD:APPROVE', 'REWARD:CONFIG', 'REWARD:VIEW',
                  'WALLET:VIEW', 'WALLET:CONFIG', 'WALLET:RECONCILE', 'AI_QUOTA:ALLOCATE',
                ]}
              />
            ),
            children: [
              { path: '/settings/tools', element: <ToolSettingsPage /> },
              // Route cũ của từng công cụ giữ làm redirect cho link và bookmark.
              { path: '/ai-quota', element: <RedirectToSection to="/settings/tools" params={{ section: 'ai-quota' }} /> },
              { path: '/okr', element: <RedirectToSection to="/settings/tools" params={{ section: 'okr' }} /> },
              { path: '/rewards', element: <RedirectToSection to="/settings/tools" params={{ section: 'rewards' }} /> },
              { path: '/wallet', element: <RedirectToSection to="/settings/tools" params={{ section: 'wallet' }} /> },
              { path: '/bsc', element: <RedirectToSection to="/settings/tools" params={{ section: 'bsc' }} /> },
              { path: '/bsc/dashboard', element: <RedirectToSection to="/settings/tools" params={{ section: 'bsc', bsc: 'dashboard' }} /> },
              { path: '/bsc/strategy-map', element: <RedirectToSection to="/settings/tools" params={{ section: 'bsc', bsc: 'strategy-map' }} /> },
              { path: '/settings/modules', element: <RedirectToSection to="/settings/tools" params={{ section: 'modules' }} /> },
              { path: '/settings/scoring', element: <RedirectToSection to="/settings/tools" params={{ section: 'scoring' }} /> },
            ],
          },

          // Admin / HR Management (Strict)
          {
            element: <PermissionRoute permission={['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW']} requireAll={true} />,
            children: [
              // Mọi thiết lập cấp công ty gom về một trang, chọn khu vực bằng ?section=.
              { path: '/company', element: <CompanySettingsPage /> },
              // '/settings/tools' KHÔNG nằm ở đây: xem khối phép HOẶC bên trên.
              { path: '/org-units/:id', element: <OrgUnitDetailPage /> },
              // Các route cũ giữ làm redirect để link, bookmark và thông báo còn sống.
              { path: '/users', element: <RedirectToSection to="/company" params={{ section: 'users' }} /> },
              { path: '/roles', element: <RedirectToSection to="/company" params={{ section: 'roles' }} /> },
              { path: '/org-structure', element: <RedirectToSection to="/company" params={{ section: 'org-structure' }} /> },
              { path: '/settings', element: <RedirectToSection to="/company" params={{ section: 'sidebar' }} /> },
            ],
          },

          // Director + Head + Deputy
          {
            element: <PermissionRoute permission={['KPI:VIEW', 'SUBMISSION:REVIEW', 'USER:VIEW_LIST']} />,
            children: [
              { path: '/org-units/:id', element: <OrgUnitDetailPage /> },
              { path: '/employees/:userId/performance', element: <EmployeePerformancePage /> },
            ],
          },

          // Datasources & Reports
          { path: '/datasources', element: <DatasourcesPage /> },
          { path: '/datasources/:id', element: <DatasourceDetailPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/reports/:id', element: <ReportDetailPage /> },
          { path: '/analytics', element: <AnalyticsPage /> },
          { path: '/ai-assistant', element: <AiAssistantPage /> },

          // Không gian cá nhân gom về một trang. Không gác quyền ở route: bốn mục công
          // việc vốn mở cho mọi vai trò, còn hai mục ví tự lọc theo quyền và cờ tính năng.
          { path: '/me', element: <MySpacePage /> },
          // Route cũ giữ làm redirect; RedirectToSection bê nguyên query nên link
          // /evaluations?action=self-eval&periodId=… vẫn chạy đúng.
          { path: '/my-kpi', element: <RedirectToSection to="/me" params={{ section: 'my-kpi' }} /> },
          { path: '/submissions', element: <RedirectToSection to="/me" params={{ section: 'my-submissions' }} /> },
          { path: '/evaluations', element: <RedirectToSection to="/me" params={{ section: 'evaluations' }} /> },
          { path: '/my-adjustments', element: <RedirectToSection to="/me" params={{ section: 'my-adjustments' }} /> },
          { path: '/rewards/me', element: <RedirectToSection to="/me" params={{ section: 'my-rewards' }} /> },
          { path: '/wallet/me', element: <RedirectToSection to="/me" params={{ section: 'my-cash-wallet' }} /> },
          // Các trang chi tiết vẫn đứng riêng: chúng mở từ trong danh sách, không phải mục menu.
          { path: '/submissions/new', element: <NewSubmissionPage /> },
          { path: '/submissions/edit/:id', element: <NewSubmissionPage /> },
          { path: '/submissions/:id', element: <SubmissionDetailPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <ErrorPage code="404" />,
  },
])

