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

import { OrganizationStructurePage } from '@/features/organization/pages/OrganizationStructurePage'
import OrgUnitDetailPage from '@/features/organization/pages/OrgUnitDetailPage'
import UsersPage from '@/features/users/pages/UsersPage'
import OrgUnitsPage from '@/features/orgunits/pages/OrgUnitsPage'
import CompanyPage from '@/features/orgunits/pages/CompanyPage'
import KpiCriteriaPage from '@/features/kpi/pages/KpiCriteriaPage'
import KpiApprovalPage from '@/features/kpi/pages/KpiApprovalPage'
import MyKpiPage from '@/features/kpi/pages/MyKpiPage'
import MySubmissionsPage from '@/features/submissions/pages/MySubmissionsPage'
import NewSubmissionPage from '@/features/submissions/pages/NewSubmissionPage'
import SubmissionDetailPage from '@/features/submissions/pages/SubmissionDetailPage'
import OrgUnitSubmissionsPage from '@/features/submissions/pages/OrgUnitSubmissionsPage'
import EvaluationsPage from '@/features/evaluations/pages/EvaluationsPage'
import ProfilePage from '@/features/profile/pages/ProfilePage'
import NotificationsPage from '@/features/notifications/pages/NotificationsPage'

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

          // Director only
          {
            element: <PermissionRoute permission={['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW']} requireAll={true} />,
            children: [
              { path: '/dashboard/director', element: <DirectorDashboard /> },
              { path: '/users', element: <UsersPage /> },
              { path: '/company', element: <CompanyPage /> },
              { path: '/org-units', element: <OrgUnitsPage /> },
              { path: '/roles', element: <RoleManagementPage /> },
              { path: '/org-structure', element: <OrganizationStructurePage /> },
              { path: '/org-units/:id', element: <OrgUnitDetailPage /> },
              { path: '/kpi-criteria/pending', element: <KpiApprovalPage /> },
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
            ],
          },

          // Staff only
          {
            element: <PermissionRoute permission="KPI:VIEW_MY" />,
            children: [
              { path: '/dashboard/staff', element: <StaffDashboard /> },
            ],
          },

          // All roles — my KPI, submissions & evaluations
          { path: '/my-kpi', element: <MyKpiPage /> },
          { path: '/submissions', element: <MySubmissionsPage /> },
          { path: '/submissions/new', element: <NewSubmissionPage /> },
          { path: '/evaluations', element: <EvaluationsPage /> },
          { path: '/submissions/:id', element: <SubmissionDetailPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
        ],
      },
    ],
  },
])
