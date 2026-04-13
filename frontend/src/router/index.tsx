import { createBrowserRouter, Navigate } from 'react-router-dom'
import AuthLayout from '@/layouts/AuthLayout'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'

// Auth pages
import LoginPage from '@/features/auth/pages/LoginPage'
import RegisterPage from '@/features/auth/pages/RegisterPage'
import VerifyEmailPage from '@/features/auth/pages/VerifyEmailPage'
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage'

// Dashboard pages
import DirectorDashboard from '@/features/dashboard/pages/DirectorDashboard'
import HeadDashboard from '@/features/dashboard/pages/HeadDashboard'
import StaffDashboard from '@/features/dashboard/pages/StaffDashboard'

// Feature pages
import CompanySettingsPage from '@/features/company/pages/CompanySettingsPage'
import UsersPage from '@/features/users/pages/UsersPage'
import DepartmentsPage from '@/features/departments/pages/DepartmentsPage'
import DepartmentDetailPage from '@/features/departments/pages/DepartmentDetailPage'
import KpiCriteriaPage from '@/features/kpi/pages/KpiCriteriaPage'
import KpiApprovalPage from '@/features/kpi/pages/KpiApprovalPage'
import MyKpiPage from '@/features/kpi/pages/MyKpiPage'
import MySubmissionsPage from '@/features/submissions/pages/MySubmissionsPage'
import NewSubmissionPage from '@/features/submissions/pages/NewSubmissionPage'
import SubmissionDetailPage from '@/features/submissions/pages/SubmissionDetailPage'
import DeptSubmissionsPage from '@/features/submissions/pages/DeptSubmissionsPage'
import EvaluationsPage from '@/features/evaluations/pages/EvaluationsPage'
import ProfilePage from '@/features/profile/pages/ProfilePage'

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
            element: <RoleRoute allowedRoles={['DIRECTOR']} />,
            children: [
              { path: '/dashboard/director', element: <DirectorDashboard /> },
              { path: '/users', element: <UsersPage /> },
              { path: '/company', element: <CompanySettingsPage /> },
              { path: '/departments', element: <DepartmentsPage /> },
              { path: '/kpi-criteria/pending', element: <KpiApprovalPage /> },
            ],
          },

          // Director + Head + Deputy
          {
            element: <RoleRoute allowedRoles={['DIRECTOR', 'HEAD', 'DEPUTY_HEAD']} />,
            children: [
              { path: '/dashboard/head', element: <HeadDashboard /> },
              { path: '/departments/:id', element: <DepartmentDetailPage /> },
              { path: '/evaluations', element: <EvaluationsPage /> },
              { path: '/submissions/department', element: <DeptSubmissionsPage /> },
              { path: '/kpi-criteria', element: <KpiCriteriaPage /> },
            ],
          },

          // Staff only
          {
            element: <RoleRoute allowedRoles={['STAFF']} />,
            children: [
              { path: '/dashboard/staff', element: <StaffDashboard /> },
              { path: '/my-kpi', element: <MyKpiPage /> },
            ],
          },

          // All roles — submissions
          { path: '/submissions', element: <MySubmissionsPage /> },
          { path: '/submissions/new', element: <NewSubmissionPage /> },
          { path: '/submissions/:id', element: <SubmissionDetailPage /> },
        ],
      },
    ],
  },
])
