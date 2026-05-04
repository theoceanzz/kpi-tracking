import { createBrowserRouter, Navigate } from 'react-router-dom'
import AuthLayout from '@/layouts/AuthLayout'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from './ProtectedRoute'
import PermissionRoute from './PermissionRoute'

// Auth pages
import LoginPage from '@/features/auth/pages/LoginPage'
import RegisterPage from '@/features/auth/pages/RegisterPage'
import VerifyEmailPage from '@/features/auth/pages/VerifyEmailPage'
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage'
import RoleManagementPage from '@/features/organization/pages/RoleManagementPage'

// Dashboard pages
import DirectorDashboard from '@/features/dashboard/pages/DirectorDashboard'
import HeadDashboard from '@/features/dashboard/pages/HeadDashboard'
import StaffDashboard from '@/features/dashboard/pages/StaffDashboard'
import EmployeePerformancePage from '@/features/dashboard/pages/EmployeePerformancePage'

import { OrganizationStructurePage } from '@/features/organization/pages/OrganizationStructurePage'
import OrgUnitDetailPage from '@/features/organization/pages/OrgUnitDetailPage'
import UsersPage from '@/features/users/pages/UsersPage'
import CompanyPage from '@/features/orgunits/pages/CompanyPage'
import KpiCriteriaPage from '@/features/kpi/pages/KpiCriteriaPage'
import KpiApprovalPage from '@/features/kpi/pages/KpiApprovalPage'
import KpiAdjustmentApprovalPage from '../features/kpi/pages/KpiAdjustmentApprovalPage'
import MyKpiPage from '@/features/kpi/pages/MyKpiPage'
import MySubmissionsPage from '@/features/submissions/pages/MySubmissionsPage'
import NewSubmissionPage from '@/features/submissions/pages/NewSubmissionPage'
import SubmissionDetailPage from '@/features/submissions/pages/SubmissionDetailPage'
import OrgUnitSubmissionsPage from '@/features/submissions/pages/OrgUnitSubmissionsPage'
import EvaluationsPage from '@/features/evaluations/pages/EvaluationsPage'
import ProfilePage from '@/features/profile/pages/ProfilePage'
import NotificationsPage from '@/features/notifications/pages/NotificationsPage'
import MyAdjustmentsPage from '../features/kpi/pages/MyAdjustmentsPage'
import KpiPeriodsPage from '@/features/kpi/pages/KpiPeriodsPage'
import DatasourcesPage from '@/features/datasources/pages/DatasourcesPage'
import DatasourceDetailPage from '@/features/datasources/pages/DatasourceDetailPage'
import ReportsPage from '@/features/reports/pages/ReportsPage'
import ReportDetailPage from '@/features/reports/pages/ReportDetailPage'
import AnalyticsPage from '@/features/analytics/pages/AnalyticsPage'

// Dashboard router helper
import DashboardRedirect from '@/features/dashboard/pages/DashboardRedirect'

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardRedirect /> },
          { path: '/profile', element: <ProfilePage /> },

          // Director & KPI Managers
          {
            element: <PermissionRoute permission={['KPI:APPROVE', 'KPI_PERIOD:CREATE']} />,
            children: [
              { path: '/kpi-criteria/pending', element: <KpiApprovalPage /> },
              { path: '/kpi-adjustments/pending', element: <KpiAdjustmentApprovalPage /> },
              { path: '/kpi-periods', element: <KpiPeriodsPage /> },
            ],
          },

          // Admin / HR Management (Strict)
          {
            element: <PermissionRoute permission={['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW']} requireAll={true} />,
            children: [
              { path: '/dashboard/director', element: <DirectorDashboard /> },
              { path: '/users', element: <UsersPage /> },
              { path: '/company', element: <CompanyPage /> },
              { path: '/roles', element: <RoleManagementPage /> },
              { path: '/org-structure', element: <OrganizationStructurePage /> },
              { path: '/org-units/:id', element: <OrgUnitDetailPage /> },
            ],
          },

          // Director + Head + Deputy
          {
            element: <PermissionRoute permission={['KPI:VIEW', 'SUBMISSION:REVIEW']} />,
            children: [
              { path: '/dashboard/head', element: <HeadDashboard /> },
              { path: '/org-units/:id', element: <OrgUnitDetailPage /> },
              { path: '/kpi-criteria', element: <KpiCriteriaPage /> },
              { path: '/submissions/org-unit', element: <OrgUnitSubmissionsPage /> },
              { path: '/employees/:userId/performance', element: <EmployeePerformancePage /> },
            ],
          },

          // Staff only
          {
            element: <PermissionRoute permission="KPI:VIEW_MY" />,
            children: [
              { path: '/dashboard/staff', element: <StaffDashboard /> },
            ],
          },

          // Datasources & Reports
          { path: '/datasources', element: <DatasourcesPage /> },
          { path: '/datasources/:id', element: <DatasourceDetailPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/reports/:id', element: <ReportDetailPage /> },
          { path: '/analytics', element: <AnalyticsPage /> },

          // All roles — my KPI, submissions & evaluations
          { path: '/my-kpi', element: <MyKpiPage /> },
          { path: '/submissions', element: <MySubmissionsPage /> },
          { path: '/submissions/new', element: <NewSubmissionPage /> },
          { path: '/submissions/edit/:id', element: <NewSubmissionPage /> },
          { path: '/evaluations', element: <EvaluationsPage /> },
          { path: '/my-adjustments', element: <MyAdjustmentsPage /> },
          { path: '/submissions/:id', element: <SubmissionDetailPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
        ],
      },
    ],
  },
])
